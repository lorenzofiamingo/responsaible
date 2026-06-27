"""The per-claim work group as a REAL Google ADK graph (parallel + loop).

This is System B — the offline ADK twin of the runtime per-claim analysis in
``src/lib/server/analyze.ts``. Where ``pipeline.py`` (System A) is a strictly
sequential ``SequentialAgent`` that produces a whole work product, this module
builds the per-CLAIM graph the runtime mirrors, using ADK's *workflow* agents so
the parallelism and the bounded escalation loop are expressed natively in ADK:

    SequentialAgent( itaily_claim_workgroup )
      ├─ grounding                LlmAgent            (Stage 0 — resolve cited CELEX)
      ├─ ParallelAgent( research_panel )              (Stage 1 — researchers concurrently)
      │     ├─ research_cellar     LlmAgent  [cellar]
      │     ├─ research_web        LlmAgent  [web]
      │     └─ research_knowledge  LlmAgent  [knowledge, open model]
      └─ LoopAgent( critic_escalation_loop, max_iterations=2 )   (Stage 2 + 3)
            ├─ critic              LlmAgent  [cellar_fetch]
            └─ escalation_gate     BaseAgent  → EventActions(escalate=True) to stop

The graph is BUILT FROM A WORK-GROUP PRESET (``workgroups.py`` PRESETS / figures),
exactly like the runtime resolves ``group.figures`` — so a claim routes to the same
figures (model + tool) offline here and online in the SvelteKit console.

LoopAgent semantics (verified against google-adk 2.3.0): the loop re-runs its
sub-agents until ``max_iterations`` OR a sub-agent yields an event with
``actions.escalate=True``. Our gate yields ``escalate=True`` when the critic is
already confident — so a confident claim stops after one pass, and an unsure claim
gets exactly one more critic pass before ``max_iterations=2`` halts it. That mirrors
the bounded ``MAX_ESCALATIONS = 1`` in analyze.ts.

ONE INTENTIONAL DIVERGENCE from analyze.ts: there the escalation pass swaps in a
*stronger* critic (``strongerVariant`` bumps effort→high, then model→opus). A
``LoopAgent`` re-runs the SAME critic agent instance, so here the escalation is
prompt-level — ``_critic_instruction`` injects an "ESCALATION pass … re-examine more
rigorously" directive when a previous verdict is in state — at the same model/effort,
not a model upgrade. The structure (bounded re-run when unsure) is faithful; the
"stronger" is a stronger prompt, not a stronger model.

ADK is imported at module load (this file is only used in the ADK env, Python
3.11–3.13). ``run_seed.py`` imports it LAZILY, only when ITAILY_CLAIM_WORKGROUP=1,
so the default seed run and the offline ``--dry-run`` never require it.
"""

from __future__ import annotations

import json
import re
import uuid
from typing import Any, AsyncGenerator

from google.adk.agents import (
    BaseAgent,
    LlmAgent,
    LoopAgent,
    ParallelAgent,
    SequentialAgent,
)
from google.adk.agents.invocation_context import InvocationContext
from google.adk.agents.readonly_context import ReadonlyContext
from google.adk.events import Event, EventActions
from google.genai import types

# Reuse the matter pipeline's CELLAR toolset builder (in-process functions, or the
# CELLAR MCP server when ITAILY_CELLAR_MCP=1) and the shared EU-law preamble, so the
# claim work group grounds against the exact same surface as System A.
from .models import model_for
from .pipeline import _DOMAIN_PREAMBLE, build_cellar_toolset
from .tools import cellar_fetch, firm_knowledge_search, web_search
from .workgroups import DEFAULT_WEB_ALLOW, PRESETS

# --- tunables — mirror the constants in src/lib/server/analyze.ts -----------------

#: At most this many researcher branches (deduped by tool) — mirrors MAX_RESEARCH_CALLS.
MAX_RESEARCH_FIGURES = 3
#: Critic passes: initial + at most one escalation — mirrors MAX_ESCALATIONS = 1.
MAX_CRITIC_ITERATIONS = 2
#: The critic is "confident enough" to stop the loop at/above this — mirrors ESCALATE_CONFIDENCE.
ESCALATE_CONFIDENCE = 0.45

#: Per-effort sampling, byte-for-byte the EFFORT_PARAMS table in analyze.ts, so an
#: offline figure samples like its runtime twin (temperature + output-token budget).
EFFORT_PARAMS: dict[str, tuple[int, float]] = {
    "low": (512, 0.2),
    "med": (768, 0.3),
    "high": (1024, 0.4),
}

USER_ID = "offline-claim-workgroup"


def _gen_config(effort: str) -> types.GenerateContentConfig:
    """A GenerateContentConfig derived from a figure's effort (mirrors EFFORT_PARAMS)."""
    max_tokens, temperature = EFFORT_PARAMS.get(effort, EFFORT_PARAMS["med"])
    return types.GenerateContentConfig(temperature=temperature, max_output_tokens=max_tokens)

# --- shared state keys (written via output_key, read by later agents + the runner) -

CLAIM_TEXT_KEY = "claim_text"
CLAIM_CITES_KEY = "claim_citations"
GROUNDING_KEY = "claim_grounding"
VERDICT_KEY = "claim_verdict"
#: One distinct output_key per parallel branch — REQUIRED so concurrent researchers
#: don't clobber each other's slot in shared session state.
RESEARCH_KEYS: dict[str, str] = {
    "cellar": "research_cellar",
    "web": "research_web",
    "knowledge": "research_knowledge",
}

# Model tier rank (small/medium/large) for picking the decisive critic — mirrors
# TIER_RANK + MODELS[...].tier so the highest-tier critic figure leads.
_TIER_RANK: dict[str, int] = {
    "gemini-2.5-flash": 1,
    "claude-haiku": 1,
    "perplexity": 1,
    "claude-sonnet": 2,
    "gemini-2.5-pro": 3,
    "claude-opus-4-8": 3,
    "nemotron": 3,
}

# Role rank for the no-critic tie-break — mirrors ROLE_RANK in analyze.ts (leadFigure).
_ROLE_RANK: dict[str, int] = {"research": 1, "drafter": 2, "critic": 3}

_VERDICTS = {"supported", "weak", "unsupported", "flag"}
_RISK_CATS = {"hallucination", "jurisdiction", "missing_authority", "conflict", "deadline"}
_SEVERITIES = {"low", "med", "high"}
_MARKER_RE = re.compile(r"\[(\d+)\]")


# --- small local helpers (kept independent of run_seed to avoid an import cycle) ---


def _parse_json(raw: Any) -> dict[str, Any]:
    """Best-effort parse of a model reply into a dict (strips ``` fences, grabs {...})."""
    if isinstance(raw, dict):
        return raw
    if not isinstance(raw, str):
        return {}
    s = raw.strip()
    if s.startswith("```"):
        s = s.strip("`")
        s = s[s.find("{") :] if "{" in s else s
    start, end = s.find("{"), s.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return {}
    try:
        return json.loads(s[start : end + 1])
    except json.JSONDecodeError:
        return {}


def _clamp(value: Any, default: float = 0.5) -> float:
    try:
        return max(0.0, min(1.0, float(value)))
    except (TypeError, ValueError):
        return default


def _markers_in(text: str) -> list[int]:
    return [int(m) for m in _MARKER_RE.findall(text or "")]


def format_claim_citations(claim_text: str, doc_citations: list[dict[str, Any]]) -> str:
    """Render the doc citations a claim's [n] markers point at, for the agents' prompts."""
    markers = set(_markers_in(claim_text))
    lines: list[str] = []
    for c in doc_citations or []:
        marker = c.get("marker")
        if marker is None or marker not in markers:
            continue
        celex = c.get("celex") or "none"
        locator = c.get("locator") or "no locator"
        claim = c.get("claim") or ""
        lines.append(f"[{marker}] {c.get('title', '')} (CELEX {celex}, {locator}) — supports: {claim}")
    return "\n".join(lines) if lines else "(this claim cites no authority)"


# --- instruction providers (callable instructions read live session state) ---------
# ADK accepts ``instruction`` as ``Callable[[ReadonlyContext], str]`` — we pull the
# claim + upstream findings out of ctx.state so each agent sees them deterministically.


def _grounding_instruction(ctx: ReadonlyContext) -> str:
    s = ctx.state
    return (
        f"{_DOMAIN_PREAMBLE}\n\n"
        "ROLE: Grounding (Stage 0). Resolve the authorities ONE atomic claim relies on.\n"
        f"CLAIM:\n{s.get(CLAIM_TEXT_KEY, '')}\n\n"
        f"CITED AUTHORITIES:\n{s.get(CLAIM_CITES_KEY, '')}\n\n"
        "For EACH cited CELEX call `cellar_fetch` to confirm it resolves (a 200). Be fast and "
        "factual — you only establish whether the cited authorities exist, not whether they "
        "support the claim (the researchers and critic do that).\n"
        'Return ONLY JSON: {"resolved": int, "total": int, "notes": "one sentence"}.'
    )


def _cellar_research_instruction(ctx: ReadonlyContext) -> str:
    s = ctx.state
    return (
        f"{_DOMAIN_PREAMBLE}\n\n"
        "ROLE: EU Law researcher (Stage 1). Verify the authority THIS claim relies on.\n"
        f"CLAIM:\n{s.get(CLAIM_TEXT_KEY, '')}\n\n"
        f"CITED AUTHORITIES:\n{s.get(CLAIM_CITES_KEY, '')}\n\n"
        "Use `celex_from_cite` / `cellar_fetch` to confirm each cited CELEX resolves, and "
        "`cellar_search` to find the governing act if the claim cites none. Never assert an "
        "authority `cellar_fetch` reports as not resolving.\n"
        'Return ONLY JSON: {"resolves": true|false|null, "assessment": "1-2 sentences on '
        'whether the cited authority resolves AND supports the claim", "sources": '
        '[{"title": str, "url": str}]}.'
    )


def _make_web_research_instruction(allow: list[str], deny: list[str]):
    allow_csv = ",".join(allow)
    deny_csv = ",".join(deny)

    def provider(ctx: ReadonlyContext) -> str:
        s = ctx.state
        return (
            f"{_DOMAIN_PREAMBLE}\n\n"
            "ROLE: Open-web researcher (Stage 1). Corroborate the claim with scoped open-web "
            "sources — secondary to CELLAR; never let the open web override a non-resolving CELEX.\n"
            f"CLAIM:\n{s.get(CLAIM_TEXT_KEY, '')}\n\n"
            f'Call `web_search` with allow_domains="{allow_csv}" and deny_domains="{deny_csv}" to '
            "find regulator guidance / EUR-Lex / case summaries bearing on the claim.\n"
            'Return ONLY JSON: {"assessment": "1-2 sentences", "sources": [{"title": str, "url": str}]}.'
        )

    return provider


def _knowledge_research_instruction(ctx: ReadonlyContext) -> str:
    s = ctx.state
    return (
        f"{_DOMAIN_PREAMBLE}\n\n"
        "ROLE: Firm-knowledge researcher (Stage 1). The claim may touch the firm's own "
        "precedents / playbooks. This material is CONFIDENTIAL and PRIVILEGED: inform the "
        "analysis, do not reproduce it verbatim, and never send it to any external service "
        "(you run on an open, self-hostable model for exactly this reason).\n"
        f"CLAIM:\n{s.get(CLAIM_TEXT_KEY, '')}\n\n"
        "Call `firm_knowledge_search` with the claim's key topics, then summarise how the firm's "
        "position bears on it.\n"
        'Return ONLY JSON: {"assessment": "1-2 sentences", "sources": [{"title": str, "ref": str}]}.'
    )


def _critic_instruction(ctx: ReadonlyContext) -> str:
    s = ctx.state
    findings = []
    for tool, key in RESEARCH_KEYS.items():
        val = s.get(key)
        if val:
            findings.append(f"- {tool} researcher: {val}")
    findings_block = "\n".join(findings) if findings else "(no researcher findings)"
    prev = s.get(VERDICT_KEY)
    escalation_note = (
        "\nThis is an ESCALATION pass: a previous verdict was not confident enough. Re-examine "
        f"the claim MORE rigorously and only revise if the evidence warrants it.\nPREVIOUS VERDICT:\n{prev}\n"
        if prev
        else ""
    )
    return (
        f"{_DOMAIN_PREAMBLE}\n\n"
        "ROLE: Decisive critic (Stage 2). Weigh the grounding and EVERY researcher finding to "
        "deliver the verdict on ONE atomic claim, protecting the human supervisor from bad work.\n"
        f"CLAIM:\n{s.get(CLAIM_TEXT_KEY, '')}\n\n"
        f"CITED AUTHORITIES:\n{s.get(CLAIM_CITES_KEY, '')}\n\n"
        f"GROUNDING (Stage 0):\n{s.get(GROUNDING_KEY, '(none)')}\n\n"
        f"RESEARCH PANEL FINDINGS (Stage 1):\n{findings_block}\n"
        f"{escalation_note}\n"
        "Independently re-check any cited CELEX with `cellar_fetch`. Rules: if a cited CELEX does "
        "NOT resolve, the verdict is 'unsupported' or 'flag' and you MUST raise a 'hallucination' "
        "risk; an obligation stated with no citation -> 'weak' + a 'missing_authority' risk.\n"
        'Return ONLY JSON: {"verdict": "supported|weak|unsupported|flag", "confidence": 0.0-1.0, '
        '"summary": "one sentence on whether the cited authority supports the claim", '
        '"risk": {"category": "hallucination|jurisdiction|missing_authority|conflict|deadline", '
        '"severity": "low|med|high", "rationale": "..."}|null, '
        '"citationMarkers": [the [n] markers that genuinely support the claim]}.'
    )


# --- the escalation gate — a custom BaseAgent that ends the LoopAgent --------------


class EscalationGate(BaseAgent):
    """Loop controller: stop when the critic is confident, else allow one more pass.

    Reads the critic's verdict from ``state[VERDICT_KEY]`` and yields an event with
    ``actions.escalate=True`` to break ``LoopAgent`` once the verdict is confident and
    free of a hallucination flag. When it is not, it yields ``escalate=False`` and the
    loop runs the critic again (until ``max_iterations``). This is the ADK-native
    embodiment of ``shouldEscalate`` + the bounded retry in analyze.ts.
    """

    async def _run_async_impl(self, ctx: InvocationContext) -> AsyncGenerator[Event, None]:
        verdict = _parse_json(ctx.session.state.get(VERDICT_KEY, ""))
        confidence = _clamp(verdict.get("confidence"), default=0.0)
        risk = verdict.get("risk") or {}
        category = risk.get("category") if isinstance(risk, dict) else None
        confident = confidence >= ESCALATE_CONFIDENCE and category != "hallucination"
        # escalate=True ⇒ LoopAgent exits. We exit when satisfied; otherwise we let the
        # loop give the critic exactly one more (more-rigorously-prompted) pass before
        # max_iterations halts it.
        yield Event(
            invocation_id=ctx.invocation_id,
            author=self.name,
            actions=EventActions(escalate=confident),
        )


# --- graph construction ------------------------------------------------------------


def _build_grounding_agent() -> LlmAgent:
    return LlmAgent(
        name="grounding",
        # Grounding is the cheap existence check — keep it on a fast model regardless of
        # the figures; the heavy reasoning is the researchers' + critic's job.
        model=model_for("gemini-2.5-flash"),
        tools=[cellar_fetch],
        output_key=GROUNDING_KEY,
        instruction=_grounding_instruction,
        generate_content_config=_gen_config("low"),
    )


def _build_researcher(figure: dict[str, Any], tool: str) -> LlmAgent:
    model = model_for(figure.get("model", "gemini-2.5-flash"))
    config = _gen_config(figure.get("effort", "med"))
    if tool == "web":
        web = figure.get("web") or {}
        allow = web.get("allow") or list(DEFAULT_WEB_ALLOW)
        deny = web.get("deny") or []
        return LlmAgent(
            name="research_web",
            model=model,
            tools=[web_search],
            output_key=RESEARCH_KEYS["web"],
            instruction=_make_web_research_instruction(allow, deny),
            generate_content_config=config,
        )
    if tool == "knowledge":
        return LlmAgent(
            name="research_knowledge",
            model=model,  # nemotron → open NIM model via model_for (stays on-perimeter)
            tools=[firm_knowledge_search],
            output_key=RESEARCH_KEYS["knowledge"],
            instruction=_knowledge_research_instruction,
            generate_content_config=config,
        )
    return LlmAgent(
        name="research_cellar",
        model=model,
        tools=build_cellar_toolset(),
        output_key=RESEARCH_KEYS["cellar"],
        instruction=_cellar_research_instruction,
        generate_content_config=config,
    )


def _default_critic_figure() -> dict[str, Any]:
    return {"role": "critic", "model": "claude-sonnet", "effort": "med", "desc": "Re-verifies and rates the claim."}


def _lead_figure(figures: list[dict[str, Any]]) -> dict[str, Any]:
    """Highest-tier figure overall, role as tie-break — mirrors leadFigure in analyze.ts."""
    return max(
        figures,
        key=lambda f: (_TIER_RANK.get(f.get("model", ""), 1), _ROLE_RANK.get(f.get("role", ""), 0)),
    )


def pick_critic(figures: list[dict[str, Any]]) -> dict[str, Any]:
    """The decisive critic — mirrors pickCritic in analyze.ts.

    Highest-tier explicit ``critic`` figure; if there is none, the lead figure (highest
    tier overall) — which is an ELEMENT of ``figures`` so the trace's identity check
    holds. Only a truly empty figure list falls back to a hardcoded default.
    """
    if not figures:
        return _default_critic_figure()
    critics = [f for f in figures if f.get("role") == "critic"]
    if critics:
        return max(critics, key=lambda f: _TIER_RANK.get(f.get("model", ""), 1))
    return _lead_figure(figures)


def _research_tasks(figures: list[dict[str, Any]]) -> list[tuple[dict[str, Any], str]]:
    """The (figure, tool) research tasks — one per DISTINCT tool, capped.

    Iterates EVERY tool each research figure carries (so a multi-tool figure expands
    into one branch per tool), deduping by tool across figures and capping at
    MAX_RESEARCH_FIGURES — exactly the task-building loop in analyze.ts.
    """
    tasks: list[tuple[dict[str, Any], str]] = []
    seen: set[str] = set()
    for fig in figures:
        if fig.get("role") != "research":
            continue
        for tool in fig.get("tools") or ["cellar"]:
            if tool in seen or len(tasks) >= MAX_RESEARCH_FIGURES:
                continue
            seen.add(tool)
            tasks.append((fig, tool))
    return tasks


def _build_critic_agent(figure: dict[str, Any]) -> LlmAgent:
    return LlmAgent(
        name="critic",
        model=model_for(figure.get("model", "claude-sonnet")),
        # The critic re-checks every cited CELEX itself — this is what catches hallucinations.
        tools=[cellar_fetch],
        output_key=VERDICT_KEY,
        instruction=_critic_instruction,
        generate_content_config=_gen_config(figure.get("effort", "med")),
    )


def build_claim_workgroup(
    figures: list[dict[str, Any]],
) -> tuple[SequentialAgent, dict[str, dict[str, Any]], list[tuple[dict[str, Any], str]], dict[str, Any]]:
    """Compose a work-group preset's figures into the per-claim ADK graph.

    Returns the ``SequentialAgent`` (grounding → ParallelAgent → LoopAgent), a registry
    mapping each agent name to the figure metadata it embodies, the (figure, tool)
    research tasks (so the trace can attribute each branch to its owning figure), and
    the chosen decisive critic figure.
    """
    registry: dict[str, dict[str, Any]] = {}

    grounding = _build_grounding_agent()
    registry[grounding.name] = {"role": "research", "model": "gemini-2.5-flash", "effort": "low", "tool": "cellar"}

    # One researcher branch per (figure, distinct tool) — the parallel panel.
    tasks = _research_tasks(figures)
    branches: list[LlmAgent] = []
    for fig, tool in tasks:
        agent = _build_researcher(fig, tool)
        branches.append(agent)
        registry[agent.name] = {
            "role": "research",
            "model": fig.get("model", "gemini-2.5-flash"),
            "effort": fig.get("effort", "med"),
            "tool": tool,
        }

    critic_fig = pick_critic(figures)
    critic = _build_critic_agent(critic_fig)
    registry[critic.name] = {
        "role": "critic",
        "model": critic_fig.get("model", "claude-sonnet"),
        "effort": critic_fig.get("effort", "med"),
        "tool": None,
    }

    sub_agents: list[BaseAgent] = [grounding]
    if branches:
        sub_agents.append(ParallelAgent(name="research_panel", sub_agents=branches))
    sub_agents.append(
        LoopAgent(
            name="critic_escalation_loop",
            max_iterations=MAX_CRITIC_ITERATIONS,
            sub_agents=[critic, EscalationGate(name="escalation_gate")],
        )
    )
    return SequentialAgent(name="itaily_claim_workgroup", sub_agents=sub_agents), registry, tasks, critic_fig


# --- running the graph against one claim -------------------------------------------


def _event_text(event: Any) -> str:
    content = getattr(event, "content", None)
    parts = getattr(content, "parts", None) if content else None
    if not parts:
        return ""
    return "".join(getattr(p, "text", "") or "" for p in parts).strip()


def _first_sentence(text: str, limit: int = 200) -> str:
    text = " ".join((text or "").split())
    return text[:limit] + ("…" if len(text) > limit else "")


def _assemble_analysis(verdict: dict[str, Any], claim_text: str, idx: int) -> dict[str, Any]:
    """Shape the critic's verdict into the per-claim analysis the loader/build_claims expect."""
    risk = verdict.get("risk") or {}
    if not isinstance(risk, dict):
        risk = {}
    category = risk.get("category") if risk.get("category") in _RISK_CATS else None
    severity = risk.get("severity") if (category and risk.get("severity") in _SEVERITIES) else None
    markers = [int(m) for m in (verdict.get("citationMarkers") or []) if str(m).lstrip("-").isdigit()]
    return {
        "idx": idx,
        "verdict": verdict.get("verdict") if verdict.get("verdict") in _VERDICTS else "weak",
        "confidence": _clamp(verdict.get("confidence"), default=0.6),
        "summary": str(verdict.get("summary", "")).strip()[:400],
        "riskCategory": category,
        "riskSeverity": severity,
        "riskRationale": str(risk.get("rationale", "")) if category else "",
        "citationMarkers": markers or _markers_in(claim_text),
    }


def _ms_for(per_author: dict[str, dict[str, Any]], name: str) -> int:
    evt = per_author.get(name, {})
    return max(int(round(((evt.get("t1", 0.0) - evt.get("t0", 0.0)) or 0.0) * 1000)), 0)


def _sources_from(state: dict[str, Any], tool: str) -> list[dict[str, Any]]:
    finding = _parse_json(state.get(RESEARCH_KEYS.get(tool, ""), ""))
    raw = finding.get("sources") if isinstance(finding, dict) else None
    if not isinstance(raw, list):
        return []
    out: list[dict[str, Any]] = []
    for s in raw:
        if not isinstance(s, dict):
            continue
        src: dict[str, Any] = {"title": str(s.get("title", ""))}
        if s.get("url"):
            src["url"] = s["url"]
        if s.get("ref"):
            src["ref"] = s["ref"]
        out.append(src)
    return out[:6]


def _research_step(
    fig: dict[str, Any], tool: str, per_author: dict[str, dict[str, Any]], state: dict[str, Any]
) -> dict[str, Any]:
    evt = per_author.get(f"research_{tool}", {})
    step: dict[str, Any] = {
        "role": "research",
        "model": fig.get("model", ""),
        "effort": fig.get("effort", "med"),
        "kind": "search" if tool == "web" else "retrieve",
        "tool": tool,
        "summary": _first_sentence(evt.get("text", "")) or fig.get("desc", ""),
        "ms": _ms_for(per_author, f"research_{tool}"),
    }
    sources = _sources_from(state, tool)
    if sources:
        step["sources"] = sources
    return step


def _build_figure_trace(
    figures: list[dict[str, Any]],
    research_tasks: list[tuple[dict[str, Any], str]],
    critic_fig: dict[str, Any],
    per_author: dict[str, dict[str, Any]],
    state: dict[str, Any],
    critic_passes: int,
) -> list[dict[str, Any]]:
    """Derive the console's per-figure trace from the ADK event stream + final state.

    Mirrors the traceByFigure logic in analyze.ts: each research figure contributes a
    step per tool it OWNS (a tool whose branch another figure already claimed yields a
    "shared" step), and the decisive critic figure contributes the critique step (also
    when a research figure is itself the lead/critic).
    """
    owned: dict[int, list[str]] = {}
    for fig, tool in research_tasks:
        owned.setdefault(id(fig), []).append(tool)

    verdict_summary = _first_sentence(str(_parse_json(state.get(VERDICT_KEY, "")).get("summary", "")))

    def critique_step(fig: dict[str, Any]) -> dict[str, Any]:
        step: dict[str, Any] = {
            "role": fig.get("role", "critic"),
            "model": fig.get("model", ""),
            "effort": fig.get("effort", "med"),
            "kind": "critique",
            "summary": verdict_summary or fig.get("desc", "") or "Rated the claim.",
            "ms": _ms_for(per_author, "critic"),
        }
        if critic_passes > 1:
            step["escalated"] = True
        return step

    trace: list[dict[str, Any]] = []
    for fig in figures:
        is_critic = fig is critic_fig
        if fig.get("role") == "research":
            tools = owned.get(id(fig))
            if tools:
                trace.extend(_research_step(fig, tool, per_author, state) for tool in tools)
            else:
                # This figure's tool branch was claimed by an earlier figure (dedup).
                tool = (fig.get("tools") or ["cellar"])[0]
                trace.append(
                    {
                        "role": "research",
                        "model": fig.get("model", ""),
                        "effort": fig.get("effort", "med"),
                        "kind": "search" if tool == "web" else "retrieve",
                        "tool": tool,
                        "summary": "Shared the research already gathered for this claim.",
                        "ms": 0,
                    }
                )
            if is_critic:  # a research figure that is also the lead/critic
                trace.append(critique_step(fig))
            continue
        if is_critic:
            trace.append(critique_step(fig))
            continue
        # A non-decisive critic or a drafter makes no decisive call at verification time.
        trace.append(
            {
                "role": fig.get("role", "critic"),
                "model": fig.get("model", ""),
                "effort": fig.get("effort", "med"),
                "kind": "draft" if fig.get("role") == "drafter" else "critique",
                "summary": "Deferred to the lead reviewer for the decisive verdict.",
                "ms": 0,
            }
        )
    return trace


async def run_claim_workgroup(
    claim_text: str,
    claim_idx: int,
    doc_citations: list[dict[str, Any]],
    figures: list[dict[str, Any]],
    *,
    app_name: str = "itaily_claim_workgroup",
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """Drive the per-claim ADK work group once and return (analysis, figureTrace).

    Pre-seeds the session state with the claim + its cited authorities, runs the
    SequentialAgent (grounding → parallel researchers → critic/escalation loop) with a
    ``Runner``, then reads the critic's verdict back out of state. The figure trace is
    derived from the run's event stream — the authentic "what each figure did".
    """
    from google.adk.runners import Runner
    from google.adk.sessions import InMemorySessionService
    from google.genai import types

    workgroup, _registry, research_tasks, critic_fig = build_claim_workgroup(figures)

    session_service = InMemorySessionService()
    session_id = f"claim-{claim_idx}-{uuid.uuid4().hex[:8]}"
    await session_service.create_session(
        app_name=app_name,
        user_id=USER_ID,
        session_id=session_id,
        state={
            CLAIM_TEXT_KEY: claim_text,
            CLAIM_CITES_KEY: format_claim_citations(claim_text, doc_citations),
        },
    )

    runner = Runner(agent=workgroup, app_name=app_name, session_service=session_service)
    message = types.Content(
        role="user",
        parts=[types.Part(text="Analyse the atomic claim held in session state and return the verdict JSON.")],
    )

    # Accumulate per-author timing + final text so we can attribute the trace to figures.
    # ``critic_passes`` counts the critic's INVOCATIONS, not its events: a tool-using
    # turn emits a non-final (function-call) event before its final answer, so we count
    # only ``is_final_response()`` events — one per invocation — to detect a real loop
    # re-run (escalation) without false positives from cellar_fetch calls.
    per_author: dict[str, dict[str, Any]] = {}
    critic_passes = 0
    async for event in runner.run_async(user_id=USER_ID, session_id=session_id, new_message=message):
        author = getattr(event, "author", "") or ""
        ts = float(getattr(event, "timestamp", 0.0) or 0.0)
        slot = per_author.setdefault(author, {"t0": ts, "t1": ts, "text": ""})
        slot["t0"] = min(slot["t0"], ts) if slot["t0"] else ts
        slot["t1"] = max(slot["t1"], ts)
        text = _event_text(event)
        if text:
            slot["text"] = text
        is_final = bool(getattr(event, "is_final_response", lambda: False)())
        if author == "critic" and is_final:
            critic_passes += 1

    session = await session_service.get_session(app_name=app_name, user_id=USER_ID, session_id=session_id)
    state = getattr(session, "state", {}) or {}
    verdict = _parse_json(state.get(VERDICT_KEY, ""))
    analysis = _assemble_analysis(verdict, claim_text, claim_idx)
    figure_trace = _build_figure_trace(figures, research_tasks, critic_fig, per_author, state, critic_passes)
    return analysis, figure_trace


# Module-level instance for the ADK dev UI (`adk web` / `adk run itaily_agents`).
# Built from the flagship preset so the parallel panel + loop are visible end-to-end.
root_agent, *_ = build_claim_workgroup(PRESETS["full_research_panel"]["figures"])


if __name__ == "__main__":
    # Quick structural check: `python -m itaily_agents.claim_workgroup`
    def _show(agent, depth: int = 0) -> None:
        kind = type(agent).__name__
        extra = f" max_iterations={getattr(agent, 'max_iterations', '')}" if kind == "LoopAgent" else ""
        print(f"{'  ' * depth}- {agent.name} [{kind}]{extra}")
        for sub in getattr(agent, "sub_agents", []) or []:
            _show(sub, depth + 1)

    print("itaily_claim_workgroup (preset: full_research_panel)\n")
    _show(root_agent)
