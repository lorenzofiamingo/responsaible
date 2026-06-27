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

import os
import sys

# VERIFY: these import paths are the documented ADK 1.x surface. Newer ADK may
# also expose ``from google.adk import Agent`` (alias of LlmAgent). If an import
# fails, check `python -c "import google.adk, inspect; help(google.adk)"`.
from google.adk.agents import LlmAgent, SequentialAgent

from .models import get_model, get_open_model
from .tools import (
    cellar_fetch,
    cellar_search,
    celex_from_cite,
    firm_knowledge_search,
    web_search,
)

# --- shared output keys (also read back by run_seed.py) ---------------------------

RESEARCH_OUTPUT_KEY = "research_findings"
DRAFT_OUTPUT_KEY = "draft_product"
CLAIMS_OUTPUT_KEY = "claims"
CLAIM_EDGES_OUTPUT_KEY = "claim_edges"
CLAIM_ANALYSES_OUTPUT_KEY = "claim_analyses"
CRITIC_OUTPUT_KEY = "critique"
WEB_RESEARCH_OUTPUT_KEY = "web_findings"
KNOWLEDGE_OUTPUT_KEY = "firm_knowledge"


def _truthy(name: str) -> bool:
    return os.getenv(name, "").strip().lower() in ("1", "true", "yes", "on")


def build_cellar_toolset():
    """The CELLAR tools for the research agent.

    Default: in-process FunctionTools (zero setup, works offline immediately).
    Opt-in (``ITAILY_CELLAR_MCP=1``): consume the standalone CELLAR MCP server via
    ADK's ``MCPToolset`` — the same capability exposed over the Model Context
    Protocol, demonstrating the agent-as-MCP-client paradigm.
    """
    if not _truthy("ITAILY_CELLAR_MCP"):
        return [cellar_search, cellar_fetch, celex_from_cite]

    # Lazy import so a default run never requires the `mcp` package. VERIFY the
    # exact symbols against your installed ADK (mcp_tool surface moved across 1.x).
    from google.adk.tools.mcp_tool.mcp_toolset import MCPToolset, StdioServerParameters

    return [
        MCPToolset(
            connection_params=StdioServerParameters(
                command=sys.executable,
                args=["-m", "itaily_agents.mcp_cellar_server"],
            )
        )
    ]

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
    """Agent 1: find and verify the governing EU authorities (uses CELLAR tools).

    This is the offline twin of the runtime "EU Law Researcher" figure: the SvelteKit
    console drives the same CELLAR surface (search / fetch / celex) over MCP at runtime
    via src/routes/api/mcp/cellar + src/lib/server/mcp/cellarClient.ts. Set
    ITAILY_CELLAR_MCP=1 to make this offline agent consume CELLAR over MCP too.
    """
    return LlmAgent(
        name="research",
        model=get_model(),
        # CELLAR tools — in-process functions, or the CELLAR MCP server when
        # ITAILY_CELLAR_MCP=1 (see build_cellar_toolset).
        tools=build_cellar_toolset(),
        output_key=RESEARCH_OUTPUT_KEY,
        instruction=(
            f"{_DOMAIN_PREAMBLE}\n\n"
            "ROLE: Legal research. Given a matter prompt, identify the controlling "
            "EU instruments. Workflow:\n"
            "1. Call `cellar_search` to find candidate acts by topic.\n"
            "2. For any act you intend to cite, derive its CELEX with "
            "`celex_from_cite` (name the instrument kind — regulation/directive/"
            "decision — in the citation text or via act_type so the CELEX letter is "
            "correct) and CONFIRM it resolves with `cellar_fetch`. Do not cite "
            "anything `cellar_fetch` reports as not resolving.\n"
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
            "work product requested. Pick `type`: 'draft' (clauses/contract text), "
            "'memo' (advice to a client/colleague), 'opinion' (a formal advisory "
            "legal opinion), or 'risk_analysis' (a structured risk assessment).\n"
            "Rules:\n"
            "- Ground every legal claim in one of the verified authorities and mark "
            "it inline with [1], [2], ... matching a citations list.\n"
            "- Be concise, precise, and practitioner-grade. No filler.\n"
            "Return ONLY a JSON object: {\"type\": \"draft|memo|opinion|risk_analysis\", "
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


def build_claim_splitter_agent() -> LlmAgent:
    """Agent 3a: split the drafted body into atomic claims (the smallest verifiable units)."""
    return LlmAgent(
        name="claim_splitter",
        model=get_model(),
        output_key=CLAIMS_OUTPUT_KEY,
        instruction=(
            f"{_DOMAIN_PREAMBLE}\n\n"
            "ROLE: Claim splitter. You are given the drafter's JSON (state key "
            f"'{DRAFT_OUTPUT_KEY}'). Split its `body` into ATOMIC CLAIMS — the smallest "
            "independently-verifiable statements (usually one per sentence). For each "
            "claim, keep its EXACT substring of the body and the character offsets that "
            "delimit it, so the app can highlight it in place.\n"
            "Classify each claim's `kind` as one of: heading, recital, obligation, "
            "definition, citation_ref (carries a [n] marker), assertion, boilerplate.\n"
            "Return ONLY JSON: {\"claims\": [{\"idx\": int, \"text\": str, "
            "\"charStart\": int, \"charEnd\": int, \"kind\": str}]}. Offsets are "
            "0-based indexes into the body; body[charStart:charEnd] MUST equal text."
        ),
    )


def build_claim_grapher_agent() -> LlmAgent:
    """Agent 3a-bis: map the dependency / consistency relations between atomic claims.

    Runs after the splitter, before the per-claim analyzer. It does NOT re-judge
    claims; it only records how they depend on one another, so the console can
    propagate risk (a conclusion is no more reliable than the premise it rests on)
    and surface load-bearing claims, qualifications and potential conflicts.
    """
    return LlmAgent(
        name="claim_grapher",
        model=get_model(),
        output_key=CLAIM_EDGES_OUTPUT_KEY,
        instruction=(
            f"{_DOMAIN_PREAMBLE}\n\n"
            "ROLE: Claim structure mapper. You are given the atomic claims (state key "
            f"'{CLAIMS_OUTPUT_KEY}') and the drafter's JSON (state key '{DRAFT_OUTPUT_KEY}'). "
            "Identify how the claims relate to one another. Each edge is DIRECTED: "
            "`from` is the DEPENDENT claim and `to` is the claim it relies on.\n"
            "Relation vocabulary:\n"
            "- premise: `from` (a conclusion/obligation/recommendation) only holds if "
            "`to` holds. This is the main risk-propagating relation.\n"
            "- definition: `from` uses a term that `to` defines.\n"
            "- elaboration: `from` specialises or operationalises the rule in `to`.\n"
            "- qualification: `from` narrows, caveats or carves out an exception to `to` "
            "(lateral — surfaced for consistency, not risk propagation).\n"
            "- conflict: `from` and `to` may contradict each other (lateral).\n"
            "Be sparse and meaningful: only connect claims with a real logical link; do "
            "NOT link headings or boilerplate. Prefer premise/elaboration edges from "
            "conclusions back to the rules they stand on. Never create a cycle among "
            "premise/definition/elaboration edges.\n"
            "Return ONLY JSON: {\"edges\": [{\"from\": int, \"to\": int, \"relation\": "
            "\"premise|definition|elaboration|qualification|conflict\", \"rationale\": "
            "str (one short sentence)}]}. `from`/`to` are claim idx values; from != to."
        ),
    )


def build_claim_analyzer_agent() -> LlmAgent:
    """Agent 3b: rate each atomic claim — verdict, confidence, risk, supporting markers."""
    return LlmAgent(
        name="claim_analyzer",
        model=get_model(),
        tools=[cellar_fetch],
        output_key=CLAIM_ANALYSES_OUTPUT_KEY,
        instruction=(
            f"{_DOMAIN_PREAMBLE}\n\n"
            "ROLE: Per-claim reviewer. You are given the atomic claims (state key "
            f"'{CLAIMS_OUTPUT_KEY}') and the drafter's citations (state key "
            f"'{DRAFT_OUTPUT_KEY}'). For EACH claim, decide whether its cited authority "
            "(the [n] markers it contains) genuinely supports it. Use `cellar_fetch` to "
            "confirm any cited CELEX resolves — if it does NOT, the verdict is "
            "'unsupported' and you must raise a 'hallucination' risk.\n"
            "Return ONLY JSON: {\"analyses\": [{\"idx\": int, "
            "\"verdict\": \"supported|weak|unsupported|flag\", \"confidence\": float, "
            "\"summary\": str (one sentence), \"riskCategory\": \"hallucination|"
            "jurisdiction|missing_authority|conflict|deadline\"|null, "
            "\"riskSeverity\": \"low|med|high\"|null, \"riskRationale\": str, "
            "\"citationMarkers\": [int]}]}. One entry per claim, same idx."
        ),
    )


def build_web_research_agent() -> LlmAgent:
    """Optional Agent: corroborate the CELLAR research with scoped open-web sources.

    Uses the Perplexity-backed ``web_search`` tool, restricted to trusted domains.
    Included only when ``ITAILY_ENABLE_WEB=1`` (it needs PERPLEXITY_API_KEY)."""
    return LlmAgent(
        name="web_research",
        model=get_model(),
        tools=[web_search],
        output_key=WEB_RESEARCH_OUTPUT_KEY,
        instruction=(
            f"{_DOMAIN_PREAMBLE}\n\n"
            "ROLE: Open-web corroboration. You are given the matter prompt and the "
            f"CELLAR research findings (state key '{RESEARCH_OUTPUT_KEY}'). Call "
            "`web_search` to corroborate the governing authorities and surface "
            "regulator guidance, restricting to trusted domains such as "
            "'eur-lex.europa.eu,curia.europa.eu,edpb.europa.eu'. Treat the open web "
            "as secondary to CELLAR; never let it override a non-resolving CELEX.\n"
            "Return ONLY JSON: {\"corroboration\": str, \"sources\": "
            "[{\"title\": str, \"url\": str}], \"notes\": str}."
        ),
    )


def build_knowledge_research_agent() -> LlmAgent:
    """Optional Agent: consult the firm's PRIVATE knowledge base on an OPEN model.

    Retrieval (``firm_knowledge_search``) is on-perimeter and the model is Nemotron
    via NIM (``get_open_model``), so confidential firm material never leaves the
    boundary. Included only when ``ITAILY_ENABLE_KNOWLEDGE=1``."""
    return LlmAgent(
        name="knowledge_research",
        # Open, self-hostable model — privacy requirement for confidential input.
        model=get_open_model(),
        tools=[firm_knowledge_search],
        output_key=KNOWLEDGE_OUTPUT_KEY,
        instruction=(
            f"{_DOMAIN_PREAMBLE}\n\n"
            "ROLE: Firm knowledge. The matter may touch the firm's own precedents and "
            "playbooks. Call `firm_knowledge_search` with the key topics to retrieve "
            "relevant internal documents, then summarise how they bear on the matter. "
            "This material is CONFIDENTIAL and PRIVILEGED: inform the work, but do not "
            "reproduce it verbatim, and never send it to any external service.\n"
            "Return ONLY JSON: {\"applicable\": bool, \"guidance\": str, \"documents\": "
            "[{\"title\": str, \"ref\": str}]}."
        ),
    )


def build_pipeline() -> SequentialAgent:
    """Compose the agents into one ordered pipeline.

    Returns a ``SequentialAgent`` whose ``run_async`` (driven by a Runner in
    run_seed.py) emits a single event stream covering research -> (web) ->
    (firm knowledge) -> draft -> claim-split -> per-claim analysis -> critique.

    The optional web / firm-knowledge research agents are inserted right after the
    CELLAR researcher when enabled via env (they need extra keys), so the default
    run stays fully functional with just the Gemini/Claude credentials.
    """
    sub_agents = [build_research_agent()]
    if _truthy("ITAILY_ENABLE_WEB"):
        sub_agents.append(build_web_research_agent())
    if _truthy("ITAILY_ENABLE_KNOWLEDGE"):
        sub_agents.append(build_knowledge_research_agent())
    sub_agents += [
        build_drafter_agent(),
        build_claim_splitter_agent(),
        build_claim_grapher_agent(),
        build_claim_analyzer_agent(),
        build_critic_agent(),
    ]
    return SequentialAgent(name="itaily_legal_pipeline", sub_agents=sub_agents)


# Module-level instance. ADK's `adk web` / `adk run` autodiscovery looks for a
# variable named ``root_agent``; exposing it lets you also poke the pipeline
# interactively with the ADK dev UI during development.
root_agent = build_pipeline()
