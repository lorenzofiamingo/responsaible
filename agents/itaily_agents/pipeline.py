"""The sequential multi-agent ADK pipeline: research -> drafter -> critic.

We compose three ``LlmAgent``s inside a ``SequentialAgent``. The SequentialAgent
runs the sub-agents in order, sharing one session/state, so the drafter sees the
research output and the critic sees the draft — and crucially the *whole* run
produces ONE event stream that ``run_seed.py`` captures as the transparency trace.

Each agent writes its structured result into shared session state via an
``output_key`` so the next agent can read it, and so ``run_seed.py`` can pull the
final structured JSON out of state after the run.

ADK API points to VERIFY against your installed version (see README):
  - ``from google.adk.agents import LlmAgent, SequentialAgent``
  - ``LlmAgent(..., output_key="...")`` to persist a sub-agent's reply to state.
  - The exact ``tools=[...]`` plain-function support (auto FunctionTool wrapping).
"""

from __future__ import annotations

# VERIFY: these import paths are the documented ADK 1.x surface. Newer ADK may
# also expose ``from google.adk import Agent`` (alias of LlmAgent). If an import
# fails, check `python -c "import google.adk, inspect; help(google.adk)"`.
from google.adk.agents import LlmAgent, SequentialAgent

from .models import get_model
from .tools import cellar_fetch, cellar_search, celex_from_cite

# --- shared output keys (also read back by run_seed.py) ---------------------------

RESEARCH_OUTPUT_KEY = "research_findings"
DRAFT_OUTPUT_KEY = "draft_product"
CRITIC_OUTPUT_KEY = "critique"

# Common domain framing prepended (conceptually) to every agent. EU law only.
_DOMAIN_PREAMBLE = (
    "You are part of Itaily, a legal-AI supervision system. You work ONLY with "
    "European Union law (Regulations, Directives, Decisions, CJEU case law). "
    "Every legal proposition must be grounded in a real EU instrument identified "
    "by its CELEX number. Never invent an authority. If you are unsure an act "
    "exists, say so explicitly rather than guessing. A human supervisor reviews "
    "everything you produce, so be transparent about uncertainty."
)


def build_research_agent() -> LlmAgent:
    """Agent 1: find and verify the governing EU authorities (uses CELLAR tools)."""
    return LlmAgent(
        name="research",
        model=get_model(),
        # Plain functions in `tools` are auto-wrapped as FunctionTools by ADK.
        tools=[cellar_search, cellar_fetch, celex_from_cite],
        output_key=RESEARCH_OUTPUT_KEY,
        instruction=(
            f"{_DOMAIN_PREAMBLE}\n\n"
            "ROLE: Legal research. Given a matter prompt, identify the controlling "
            "EU instruments. Workflow:\n"
            "1. Call `cellar_search` to find candidate acts by topic.\n"
            "2. For any act you intend to cite, derive its CELEX with "
            "`celex_from_cite` and CONFIRM it resolves with `cellar_fetch`. Do not "
            "cite anything `cellar_fetch` reports as not resolving.\n"
            "3. Return a compact JSON object: {\"topic\": str, \"authorities\": "
            "[{\"celex\": str, \"title\": str, \"eli\": str, \"source_url\": str, "
            "\"resolves\": bool, \"relevant_articles\": [str], \"why\": str}], "
            "\"notes\": str}.\n"
            "Prefer 2-3 strong authorities over many weak ones. Output ONLY the JSON."
        ),
    )


def build_drafter_agent() -> LlmAgent:
    """Agent 2: write the work product, inserting [1] [2] citation markers."""
    return LlmAgent(
        name="drafter",
        model=get_model(),
        output_key=DRAFT_OUTPUT_KEY,
        instruction=(
            f"{_DOMAIN_PREAMBLE}\n\n"
            "ROLE: Legal drafter. You are given the matter prompt and the research "
            f"agent's findings (in state key '{RESEARCH_OUTPUT_KEY}'). Produce the "
            "work product requested (a draft, a memo, or a risk_analysis).\n"
            "Rules:\n"
            "- Ground every legal claim in one of the verified authorities and mark "
            "it inline with [1], [2], ... matching a citations list.\n"
            "- Be concise, precise, and practitioner-grade. No filler.\n"
            "Return ONLY a JSON object: {\"type\": \"draft|memo|risk_analysis\", "
            "\"title\": str, \"summary\": str, \"body\": str (with [n] markers), "
            "\"citations\": [{\"marker\": int, \"claim\": str, \"celex\": str, "
            "\"eli\": str, \"title\": str, \"sourceUrl\": str, \"snippet\": str, "
            "\"locator\": str (e.g. 'Art. 6(1)(f)'), \"supportsClaim\": bool}]}."
        ),
    )


def build_critic_agent() -> LlmAgent:
    """Agent 3: re-verify citations and emit risk signals + a confidence score."""
    return LlmAgent(
        name="critic",
        model=get_model(),
        # The critic also gets the tools so it can independently re-check that
        # each cited CELEX truly resolves — this is what catches hallucinations.
        tools=[cellar_fetch],
        output_key=CRITIC_OUTPUT_KEY,
        instruction=(
            f"{_DOMAIN_PREAMBLE}\n\n"
            "ROLE: Adversarial reviewer. You are given the drafter's JSON (state "
            f"key '{DRAFT_OUTPUT_KEY}'). Your job is to protect the human "
            "supervisor from bad work.\n"
            "Steps:\n"
            "1. For EVERY citation, call `cellar_fetch` on its CELEX. If it does "
            "not resolve, raise a 'hallucination' risk at high severity.\n"
            "2. Check each [n] marker in the body maps to a real, supporting "
            "citation. Missing/weak support -> 'missing_authority' risk.\n"
            "3. Watch for jurisdiction issues (Directive vs Regulation, national "
            "transposition), internal conflicts, and time-sensitive deadlines.\n"
            "4. Set an overall confidence in [0,1]: high when all citations "
            "resolve and support the claims, low when any are unverified.\n"
            "Return ONLY JSON: {\"confidence\": float, \"riskSignals\": "
            "[{\"category\": \"hallucination|jurisdiction|missing_authority|"
            "conflict|deadline\", \"severity\": \"low|med|high\", \"rationale\": "
            "str, \"confidence\": float}], \"citationChecks\": [{\"marker\": int, "
            "\"celex\": str, \"resolves\": bool}]}."
        ),
    )


def build_pipeline() -> SequentialAgent:
    """Compose the three agents into one ordered pipeline.

    Returns a ``SequentialAgent`` whose ``run_async`` (driven by a Runner in
    run_seed.py) emits a single event stream covering research -> draft -> critique.
    """
    return SequentialAgent(
        name="itaily_legal_pipeline",
        sub_agents=[
            build_research_agent(),
            build_drafter_agent(),
            build_critic_agent(),
        ],
    )


# Module-level instance. ADK's `adk web` / `adk run` autodiscovery looks for a
# variable named ``root_agent``; exposing it lets you also poke the pipeline
# interactively with the ADK dev UI during development.
root_agent = build_pipeline()
