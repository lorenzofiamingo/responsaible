"""Entry point: run the ADK pipeline over seed matters and emit work-products.json.

Run with:
    python -m itaily_agents.run_seed            # full run (needs API keys + net)
    python -m itaily_agents.run_seed --dry-run  # no LLM/network; emits a fixture

For each seed matter we:
  1. Drive the SequentialAgent pipeline with an ADK ``Runner``.
  2. Collect ``session.events`` (the AUTHENTIC trace of what the AI did).
  3. Transform those events into the console's ``trace`` shape.
  4. Pull the drafter's + critic's structured JSON out of session state and turn
     it into ``citations`` / ``riskSignals`` / ``confidence``.
  5. Assemble one work-product object matching the app's loader exactly.
  6. Write the array to ``agents/out/work-products.json``.

Robustness: each matter is wrapped in try/except. A failure on one matter is
logged and skipped; everything that succeeded is still written. ``createdAt`` is
stamped with the real wall-clock time at runtime.

The output shape MUST match ``scripts/load-seed.mjs`` and the existing
``data/seed/work-products.json``. See the README for the field contract.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import re

from dotenv import load_dotenv

from .models import get_model_label
from .workgroups import PRESETS, auto_preset


def _truthy(name: str) -> bool:
    """Read a boolean env flag (mirrors pipeline._truthy)."""
    return os.getenv(name, "").strip().lower() in ("1", "true", "yes", "on")

# Output location. A human copies this into the app and runs `npm run seed`.
OUT_DIR = Path(__file__).resolve().parent.parent / "out"
OUT_FILE = OUT_DIR / "work-products.json"

APP_NAME = "itaily_legal_pipeline"
USER_ID = "offline-seed-generator"

# The agent display names the console shows, keyed by work-product type — mirrors
# the names in the shipped seed data ("Itaily Research/Risk/Drafting Agent").
AGENT_NAME_BY_TYPE = {
    "memo": "Itaily Research Agent",
    "risk_analysis": "Itaily Risk Agent",
    "draft": "Itaily Drafting Agent",
    "opinion": "Itaily Advisory Agent",
}


# --- seed matters -----------------------------------------------------------------


@dataclass
class SeedMatter:
    """One illustrative matter to run through the pipeline."""

    id: str
    matter_ref: str
    matter_name: str
    expected_type: str  # "draft" | "memo" | "risk_analysis"
    priority: int
    prompt: str


# ~3 illustrative matters spanning the three product types and EU-law topics.
SEED_MATTERS: list[SeedMatter] = [
    SeedMatter(
        id="wp_seed_gdpr_transfers",
        matter_ref="MAT-2026-0201",
        matter_name="Helios — US processor data transfers",
        expected_type="memo",
        priority=72,
        prompt=(
            "Write a MEMO assessing the lawful basis for transferring EU personal "
            "data to a US-based cloud processor. Cover Chapter V GDPR, SCCs under "
            "Article 46, and the EU-US Data Privacy Framework adequacy decision. "
            "Identify the controlling EU instruments by CELEX and recommend a "
            "transfer mechanism."
        ),
    ),
    SeedMatter(
        id="wp_seed_aiact_classification",
        matter_ref="MAT-2026-0202",
        matter_name="Aurora — AI recruitment screening tool",
        expected_type="risk_analysis",
        priority=88,
        prompt=(
            "Produce a RISK_ANALYSIS classifying an AI system that ranks job "
            "applicants under the EU AI Act. Determine whether it is high-risk "
            "(Annex III) and map the resulting provider obligations (risk "
            "management, data governance, human oversight, conformity assessment). "
            "Cite the AI Act by CELEX."
        ),
    ),
    SeedMatter(
        id="wp_seed_dsa_obligations",
        matter_ref="MAT-2026-0203",
        matter_name="Nimbus — online marketplace terms",
        expected_type="draft",
        priority=54,
        prompt=(
            "DRAFT notice-and-action and trader-traceability clauses for an online "
            "marketplace to comply with the Digital Services Act. Ground the "
            "clauses in the relevant DSA articles (notice-and-action for hosting "
            "services; trader traceability for marketplaces) and cite the DSA by "
            "CELEX."
        ),
    ),
    SeedMatter(
        id="wp_seed_gatekeeper_opinion",
        matter_ref="MAT-2026-0204",
        matter_name="Meridian — DMA gatekeeper designation",
        expected_type="opinion",
        priority=66,
        prompt=(
            "Write a formal legal OPINION on whether a large online platform meets "
            "the gatekeeper designation thresholds under the Digital Markets Act and "
            "what the core-platform-service obligations would entail. Identify the "
            "controlling EU instrument by CELEX and give a reasoned conclusion."
        ),
    ),
]


# --- ADK event -> console trace mapping -------------------------------------------

# Map an ADK sub-agent author name to the console's actorAgent label. The three
# claim agents get their own labels so the trace attributes claim-splitting,
# graphing and per-claim analysis to the agent that actually did it (instead of
# silently collapsing them onto "research").
_ACTOR_BY_AUTHOR = {
    "research": "research",
    "drafter": "drafter",
    "critic": "critic",
    "claim_splitter": "splitter",
    "claim_grapher": "grapher",
    "claim_analyzer": "analyzer",
}

# Map a CELLAR tool name to a trace ``kind``.
_KIND_BY_TOOL = {
    "cellar_search": "search",
    "cellar_fetch": "retrieve",
    "celex_from_cite": "retrieve",
}


@dataclass
class TraceBuilder:
    """Accumulates console trace steps derived from the ADK event stream."""

    steps: list[dict[str, Any]] = field(default_factory=list)

    def _actor(self, author: str | None) -> str:
        return _ACTOR_BY_AUTHOR.get(author or "", "research")

    def add(self, kind: str, author: str | None, summary: str, detail: dict | None = None) -> None:
        step = {
            "step": len(self.steps) + 1,
            "kind": kind,
            "actorAgent": self._actor(author),
            "summary": summary,
        }
        if detail:
            step["detail"] = detail
        self.steps.append(step)

    def from_event(self, event: Any) -> None:
        """Translate one ADK event into zero or more trace steps.

        ADK Event surface used (VERIFY against installed version):
          - ``event.author``                 -> which sub-agent emitted it
          - ``event.get_function_calls()``   -> tool invocations (.name, .args)
          - ``event.get_function_responses()``-> tool results   (.name, .response)
          - ``event.content.parts[*].text``  -> model text turns
          - ``event.is_final_response()``     -> the displayable final turn
        """
        author = getattr(event, "author", None)

        # 1. Tool calls -> search/retrieve steps.
        try:
            calls = event.get_function_calls() or []
        except Exception:  # API shape differs across versions; fail soft.
            calls = []
        for call in calls:
            name = getattr(call, "name", "tool")
            args = getattr(call, "args", {}) or {}
            self.add(
                kind=_KIND_BY_TOOL.get(name, "retrieve"),
                author=author,
                summary=f"Called {name}({_short_args(args)}).",
                detail={"tool": name, "args": args},
            )

        # 2. Tool responses -> a 'cite' step when we learned whether an act resolves.
        try:
            responses = event.get_function_responses() or []
        except Exception:
            responses = []
        for resp in responses:
            name = getattr(resp, "name", "tool")
            result = getattr(resp, "response", {}) or {}
            if name == "cellar_fetch":
                resolves = result.get("resolves")
                celex = result.get("celex")
                self.add(
                    kind="cite",
                    author=author,
                    summary=(
                        f"Verified {celex}: {'resolves' if resolves else 'DOES NOT resolve'}."
                        if celex
                        else "Verified a citation."
                    ),
                    detail={"tool": name, "result": result},
                )

        # 3. Model text turns -> reason/draft/critique steps (keyed by author).
        text = _event_text(event)
        if text and not calls and not responses:
            actor = self._actor(author)
            # Keyed by actor label; stays within the agent_action.kind enum
            # (search/retrieve/reason/draft/cite/critique). Claim splitting and
            # graphing read as "reason"; per-claim analysis reads as "critique".
            kind = {
                "research": "reason",
                "drafter": "draft",
                "critic": "critique",
                "splitter": "reason",
                "grapher": "reason",
                "analyzer": "critique",
            }.get(actor, "reason")
            self.add(
                kind=kind,
                author=author,
                summary=_first_sentence(text),
                detail={"chars": len(text)},
            )


# --- per-event helpers ------------------------------------------------------------


def _event_text(event: Any) -> str:
    """Concatenate text parts of an event's content, if any."""
    content = getattr(event, "content", None)
    parts = getattr(content, "parts", None) if content else None
    if not parts:
        return ""
    chunks = [getattr(p, "text", "") or "" for p in parts]
    return "".join(chunks).strip()


def _short_args(args: dict[str, Any]) -> str:
    items = ", ".join(f"{k}={v!r}" for k, v in list(args.items())[:2])
    return items[:80]


def _first_sentence(text: str, limit: int = 160) -> str:
    text = " ".join(text.split())
    cut = text[:limit]
    return cut + ("…" if len(text) > limit else "")


# --- structured-output extraction -------------------------------------------------


def _parse_json_blob(raw: Any) -> dict[str, Any]:
    """Best-effort parse of a model reply into a dict.

    Models sometimes wrap JSON in prose or ```json fences. We strip fences and
    grab the outermost {...}. Returns {} if nothing parses.
    """
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


def _clamp(value: Any, lo: float = 0.0, hi: float = 1.0, default: float = 0.5) -> float:
    try:
        return max(lo, min(hi, float(value)))
    except (TypeError, ValueError):
        return default


# --- assembling one work product --------------------------------------------------


_MARKER_RE = re.compile(r"\[(\d+)\]")


def build_claims(
    claims_raw: list[dict[str, Any]],
    analyses_raw: list[dict[str, Any]],
    body: str,
    figure_traces: dict[int, list[dict[str, Any]]] | None = None,
) -> list[dict[str, Any]]:
    """Merge the splitter's atomic claims with the per-claim analyses into the loader shape.

    Each claim is stamped with its auto-assigned work-group preset (so the offline
    default matches the in-browser one) and the citation markers it carries.

    Character offsets are RECOMPUTED here by locating each claim's exact text in
    the body, not trusted from the splitter: LLMs cannot reliably count character
    positions (Gemini got nearly all of them wrong), but the claim text itself is
    an exact substring, so the span is derived deterministically. A running cursor
    keeps repeated phrases in document order.

    ``figure_traces`` (idx -> per-figure trace): when the per-claim ADK WORK GROUP
    rated the claims, each claim's ``analysis.figureTrace`` is filled with the real
    multi-figure trace from that run; otherwise it stays ``None`` (the batch analyzer
    makes no per-figure calls).
    """
    figure_traces = figure_traces or {}
    by_idx = {a.get("idx"): a for a in (analyses_raw or [])}
    claims: list[dict[str, Any]] = []
    cursor = 0
    for c in sorted(claims_raw or [], key=lambda x: x.get("idx") or 0):
        text = c.get("text", "")
        kind = c.get("kind", "assertion")
        markers = [int(m) for m in _MARKER_RE.findall(text)]
        # Locate the exact text; fall back to a global search, then to the
        # splitter's own offsets if the text isn't a verbatim substring.
        pos = body.find(text, cursor) if text else -1
        if pos == -1 and text:
            pos = body.find(text)
        if pos == -1:
            char_start, char_end = c.get("charStart", 0), c.get("charEnd", 0)
        else:
            char_start, char_end = pos, pos + len(text)
            cursor = char_end
        idx = c.get("idx")
        a = by_idx.get(idx)
        if a is None:
            # The per-claim analyzer produced no entry for this claim — don't
            # fabricate a confident "supported". Flag it for the supervisor so a
            # missing analysis is visibly distinct from a real positive verdict.
            analysis = {
                "verdict": "flag",
                "confidence": 0.4,
                "summary": "No per-claim analysis was produced for this claim.",
                "riskCategory": "missing_authority",
                "riskSeverity": "low",
                "riskRationale": "The per-claim reviewer returned no verdict for this claim.",
                "figureTrace": figure_traces.get(idx),
            }
            citation_markers = markers
        else:
            analysis = {
                "verdict": a.get("verdict", "supported"),
                "confidence": _clamp(a.get("confidence"), default=0.7),
                "summary": a.get("summary", ""),
                "riskCategory": a.get("riskCategory"),
                "riskSeverity": a.get("riskSeverity"),
                "riskRationale": a.get("riskRationale", ""),
                "figureTrace": figure_traces.get(idx),
            }
            citation_markers = a.get("citationMarkers") or markers
        claims.append(
            {
                "idx": c.get("idx"),
                "text": text,
                "charStart": char_start,
                "charEnd": char_end,
                "kind": kind,
                "assignedPreset": auto_preset(text, kind),
                "citationMarkers": citation_markers,
                "analysis": analysis,
            }
        )
    return claims


_EDGE_RELATIONS = {"premise", "definition", "elaboration", "qualification", "conflict"}
_ORDERING_RELATIONS = {"premise", "definition", "elaboration"}


def build_edges(edges_raw: list[dict[str, Any]], n_claims: int) -> list[dict[str, Any]]:
    """Validate the claim-grapher's edges into the loader shape.

    `from` (the dependent) RESTS ON `to` (the premise/target). Drop anything with an
    unknown relation, an out-of-range claim idx, or a self-loop, and stamp `ordering`
    (the risk-propagating premise/definition/elaboration family).
    """
    out: list[dict[str, Any]] = []
    for e in edges_raw or []:
        rel = e.get("relation")
        if rel not in _EDGE_RELATIONS:
            continue
        try:
            frm, to = int(e.get("from")), int(e.get("to"))
        except (TypeError, ValueError):
            continue
        if frm == to or not (0 <= frm < n_claims) or not (0 <= to < n_claims):
            continue
        out.append(
            {
                "from": frm,
                "to": to,
                "relation": rel,
                "rationale": e.get("rationale", ""),
                "ordering": rel in _ORDERING_RELATIONS,
            }
        )
    return out


def assemble_work_product(
    matter: SeedMatter,
    draft: dict[str, Any],
    critique: dict[str, Any],
    trace: list[dict[str, Any]],
    created_at: str,
    claims: list[dict[str, Any]] | None = None,
    edges: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Build the final work-product object in the EXACT shape the app loads."""
    wp_type = draft.get("type") or matter.expected_type
    confidence = _clamp(critique.get("confidence"), default=0.7)

    # The critic re-fetched every cited CELEX (citationChecks); fold that result
    # back onto each citation so the console shows verified/unresolved instead of
    # leaving everything 'unchecked'. Indexed by marker, then by CELEX.
    checks_by_marker: dict[int, bool] = {}
    checks_by_celex: dict[str, bool] = {}
    for chk in critique.get("citationChecks", []) or []:
        resolves = bool(chk.get("resolves"))
        marker = chk.get("marker")
        if marker is not None:
            try:
                checks_by_marker[int(marker)] = resolves
            except (TypeError, ValueError):
                pass
        if chk.get("celex"):
            checks_by_celex[str(chk["celex"]).strip().upper()] = resolves

    citations = []
    for i, c in enumerate(draft.get("citations", []) or [], start=1):
        marker = c.get("marker", i)
        celex = c.get("celex")
        resolves = checks_by_marker.get(marker)
        if resolves is None and celex:
            resolves = checks_by_celex.get(str(celex).strip().upper())
        if not celex or resolves is None:
            verify_status, verified, verified_at = "unchecked", False, None
        elif resolves:
            verify_status, verified, verified_at = "verified", True, created_at
        else:
            verify_status, verified, verified_at = "unresolved", False, None
        citations.append(
            {
                "marker": marker,
                "claim": c.get("claim", ""),
                "celex": celex,
                "eli": c.get("eli"),
                "title": c.get("title", ""),
                "sourceUrl": c.get("sourceUrl") or c.get("source_url"),
                "snippet": c.get("snippet", ""),
                "locator": c.get("locator", ""),
                "supportsClaim": bool(c.get("supportsClaim", True)),
                "verified": verified,
                "verifyStatus": verify_status,
                "verifiedAt": verified_at,
            }
        )

    risk_signals = []
    for r in critique.get("riskSignals", []) or []:
        risk_signals.append(
            {
                "category": r.get("category", "missing_authority"),
                "severity": r.get("severity", "med"),
                "rationale": r.get("rationale", ""),
                "confidence": _clamp(r.get("confidence"), default=0.6),
            }
        )

    return {
        "id": matter.id,
        "type": wp_type,
        "title": draft.get("title") or matter.matter_name,
        "summary": draft.get("summary", ""),
        "body": draft.get("body", ""),
        "matterRef": matter.matter_ref,
        "matterName": matter.matter_name,
        "agentName": AGENT_NAME_BY_TYPE.get(wp_type, "Itaily Research Agent"),
        "status": "pending",
        "priority": matter.priority,
        "confidence": confidence,
        "model": get_model_label(),
        "createdAt": created_at,
        "trace": trace,
        "citations": citations,
        "riskSignals": risk_signals,
        "claims": claims or [],
        "edges": edges or [],
    }


# --- running one matter through ADK -----------------------------------------------


async def _analyze_claims_with_workgroup(
    claims_raw: list[dict[str, Any]],
    draft_citations: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], dict[int, list[dict[str, Any]]]]:
    """Rate every atomic claim with the per-claim ADK WORK GROUP (System B).

    For each claim, the deterministic ``auto_preset`` picks the same work-group preset
    the console would pick, and that preset's figures are run as a real ADK graph
    (grounding → parallel researchers → critic/escalation loop) via
    ``claim_workgroup.run_claim_workgroup``. Returns the per-claim analyses (same shape
    the batch analyzer produced) plus a map of idx -> per-figure trace.

    Claims are run concurrently with a small bound (ITAILY_CLAIM_CONCURRENCY, default 2)
    so a matter's claims don't fan out into an unbounded burst of model calls. A claim
    that errors is skipped (its analysis falls back to the "flag" path in build_claims).
    """
    from .claim_workgroup import run_claim_workgroup

    sem = asyncio.Semaphore(max(1, int(os.getenv("ITAILY_CLAIM_CONCURRENCY", "2"))))

    async def one(claim: dict[str, Any]) -> tuple[int, dict[str, Any], list[dict[str, Any]]] | None:
        idx = claim.get("idx")
        text = claim.get("text", "")
        kind = claim.get("kind", "assertion")
        figures = PRESETS.get(auto_preset(text, kind), PRESETS["standard_review"])["figures"]
        async with sem:
            try:
                analysis, figure_trace = await run_claim_workgroup(text, idx, draft_citations, figures)
            except Exception as exc:  # one claim failing must not lose the matter
                print(f"    [claim {idx}] work group failed: {exc!r}", file=sys.stderr)
                return None
        return idx, analysis, figure_trace

    results = await asyncio.gather(*[one(c) for c in claims_raw])
    analyses_raw: list[dict[str, Any]] = []
    traces: dict[int, list[dict[str, Any]]] = {}
    for r in results:
        if r is None:
            continue
        idx, analysis, figure_trace = r
        analyses_raw.append(analysis)
        if idx is not None:
            traces[idx] = figure_trace
    return analyses_raw, traces


async def run_matter(matter: SeedMatter) -> dict[str, Any]:
    """Drive the pipeline for one matter and return an assembled work product.

    ADK runtime pattern (VERIFY against installed version — see README):
      - ``InMemorySessionService`` + ``Runner(agent, app_name, session_service)``
      - ``await session_service.create_session(app_name, user_id, session_id)``
      - ``async for event in runner.run_async(user_id, session_id, new_message)``
      - read final structured state from the session after the loop.

    When ITAILY_CLAIM_WORKGROUP=1, the batch ``claim_analyzer`` is dropped from the
    pipeline and each atomic claim is instead rated by the per-claim ADK WORK GROUP
    (System B): parallel researchers + a bounded critic/escalation loop.
    """
    # Imported here so --dry-run never requires ADK to be installed.
    from google.adk.runners import Runner
    from google.adk.sessions import InMemorySessionService
    from google.genai import types

    from .pipeline import (
        CLAIM_ANALYSES_OUTPUT_KEY,
        CLAIM_EDGES_OUTPUT_KEY,
        CLAIMS_OUTPUT_KEY,
        CRITIC_OUTPUT_KEY,
        DRAFT_OUTPUT_KEY,
        build_pipeline,
    )

    use_workgroup = _truthy("ITAILY_CLAIM_WORKGROUP")

    session_service = InMemorySessionService()
    session_id = f"seed-{matter.id}-{uuid.uuid4().hex[:8]}"

    # create_session is async in current ADK. (Older builds were sync — if this
    # raises "coroutine was never awaited", drop the await.)
    await session_service.create_session(
        app_name=APP_NAME, user_id=USER_ID, session_id=session_id
    )

    runner = Runner(
        # Drop the batch analyzer when the per-claim work group will rate the claims.
        agent=build_pipeline(include_claim_analyzer=not use_workgroup),
        app_name=APP_NAME,
        session_service=session_service,
    )

    new_message = types.Content(role="user", parts=[types.Part(text=matter.prompt)])

    builder = TraceBuilder()
    # Stream events as they happen — THIS is the authentic trace.
    async for event in runner.run_async(
        user_id=USER_ID, session_id=session_id, new_message=new_message
    ):
        builder.from_event(event)

    # Pull the agents' structured JSON out of shared session state.
    session = await session_service.get_session(
        app_name=APP_NAME, user_id=USER_ID, session_id=session_id
    )
    state = getattr(session, "state", {}) or {}
    draft = _parse_json_blob(state.get(DRAFT_OUTPUT_KEY, ""))
    # If the drafter's reply did not parse into a body, fail this matter loudly
    # rather than writing a blank, confident-looking product the loader accepts.
    if not draft.get("body", "").strip():
        raise ValueError(
            "drafter produced no parseable body; refusing to emit a blank work "
            f"product (state head: {str(state.get(DRAFT_OUTPUT_KEY, ''))[:120]!r})"
        )
    critique = _parse_json_blob(state.get(CRITIC_OUTPUT_KEY, ""))
    claims_raw = _parse_json_blob(state.get(CLAIMS_OUTPUT_KEY, "")).get("claims", [])
    edges_raw = _parse_json_blob(state.get(CLAIM_EDGES_OUTPUT_KEY, "")).get("edges", [])

    if use_workgroup:
        # System B: rate each atomic claim with the parallel-researchers + critic-loop
        # ADK work group, and capture its authentic per-figure trace.
        analyses_raw, claim_traces = await _analyze_claims_with_workgroup(
            claims_raw, draft.get("citations", []) or []
        )
    else:
        analyses_raw = _parse_json_blob(state.get(CLAIM_ANALYSES_OUTPUT_KEY, "")).get("analyses", [])
        claim_traces = None

    claims = build_claims(claims_raw, analyses_raw, draft.get("body", ""), claim_traces)
    edges = build_edges(edges_raw, len(claims))

    created_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    return assemble_work_product(
        matter, draft, critique, builder.steps, created_at, claims, edges
    )


# --- dry-run fixture (offline, no ADK / no network) -------------------------------


def dry_run_product(matter: SeedMatter) -> dict[str, Any]:
    """Produce a deterministic offline fixture — through the REAL assembly path.

    Builds the same intermediate shapes a live run pulls out of session state
    (draft / critique / claims / analyses / edges), then runs them through the
    exact ``build_claims`` / ``build_edges`` / ``assemble_work_product`` the live
    pipeline uses. So ``--dry-run`` is a genuine end-to-end contract test of the
    output — verified citations, atomic claims with exact offsets, reasoning
    edges, six-actor trace — without API keys, ADK, or the network.
    """
    created_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    body = (
        "Under the cited EU instrument, the controlling rule applies to this "
        "matter [1]. A compliant transfer mechanism must therefore be in place "
        "before any processing begins [2]."
    )
    _gdpr = {
        "celex": "32016R0679",
        "eli": "http://data.europa.eu/eli/reg/2016/679/oj",
        "title": "Regulation (EU) 2016/679 (GDPR)",
        "sourceUrl": "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32016R0679",
        "snippet": "…",
    }
    draft = {
        "type": matter.expected_type,
        "title": f"[DRY RUN] {matter.matter_name}",
        "summary": "Offline fixture — exercises the real assembly/loader contract.",
        "body": body,
        "citations": [
            {"marker": 1, "claim": "The controlling rule applies.", "locator": "Art. 1",
             "supportsClaim": True, **_gdpr},
            {"marker": 2, "claim": "A transfer mechanism must be in place.", "locator": "Art. 46",
             "supportsClaim": True, **_gdpr},
        ],
    }
    critique = {
        "confidence": 0.7,
        "riskSignals": [
            {"category": "missing_authority", "severity": "low",
             "rationale": "Illustrative risk signal for the dry-run fixture.",
             "confidence": 0.6}
        ],
        # Both citations "re-verified" as resolving -> assembly marks them verified.
        "citationChecks": [
            {"marker": 1, "celex": "32016R0679", "resolves": True},
            {"marker": 2, "celex": "32016R0679", "resolves": True},
        ],
    }

    # Atomic claims with exact offsets into `body` (body[start:end] == text).
    claims_raw: list[dict[str, Any]] = []
    for idx, m in enumerate(re.finditer(r"[^.]*\.", body)):
        text = m.group(0).strip()
        if not text:
            continue
        start = body.index(text)
        markers = [int(x) for x in _MARKER_RE.findall(text)]
        claims_raw.append(
            {
                "idx": idx,
                "text": text,
                "charStart": start,
                "charEnd": start + len(text),
                "kind": "citation_ref" if markers else "assertion",
            }
        )
    analyses_raw = [
        {
            "idx": c["idx"], "verdict": "supported", "confidence": 0.7,
            "summary": "Grounded in the cited EU authority.",
            "riskCategory": None, "riskSeverity": None, "riskRationale": "",
            "citationMarkers": [int(x) for x in _MARKER_RE.findall(c["text"])],
        }
        for c in claims_raw
    ]
    # Claim 1 (the obligation) rests on claim 0 (the controlling rule).
    edges_raw = (
        [{"from": 1, "to": 0, "relation": "premise",
          "rationale": "The obligation depends on the controlling rule."}]
        if len(claims_raw) >= 2 else []
    )

    trace = [
        {"step": 1, "kind": "search", "actorAgent": "research",
         "summary": "Called cellar_search(query='…').",
         "detail": {"tool": "cellar_search", "args": {"query": matter.matter_name}}},
        {"step": 2, "kind": "cite", "actorAgent": "research",
         "summary": "Verified 32016R0679: resolves.",
         "detail": {"tool": "cellar_fetch", "result": {"celex": "32016R0679", "resolves": True}}},
        {"step": 3, "kind": "draft", "actorAgent": "drafter",
         "summary": "Drafted the work product with grounded citations."},
        {"step": 4, "kind": "reason", "actorAgent": "splitter",
         "summary": "Split the body into atomic claims."},
        {"step": 5, "kind": "reason", "actorAgent": "grapher",
         "summary": "Mapped premise edges between the claims."},
        {"step": 6, "kind": "critique", "actorAgent": "analyzer",
         "summary": "Rated each claim against its cited authority."},
        {"step": 7, "kind": "critique", "actorAgent": "critic",
         "summary": "Re-verified citations and set confidence."},
    ]

    claims = build_claims(claims_raw, analyses_raw, body)
    edges = build_edges(edges_raw, len(claims))
    return assemble_work_product(matter, draft, critique, trace, created_at, claims, edges)


# --- orchestration / IO -----------------------------------------------------------


def _write_output(products: list[dict[str, Any]]) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    OUT_FILE.write_text(json.dumps(products, indent=2, ensure_ascii=False) + "\n", "utf-8")
    print(f"Wrote {len(products)} work product(s) -> {OUT_FILE}")


async def _main_async(dry_run: bool) -> int:
    load_dotenv()  # load agents/.env if present
    products: list[dict[str, Any]] = []

    for matter in SEED_MATTERS:
        try:
            if dry_run:
                products.append(dry_run_product(matter))
                print(f"  [dry-run] {matter.id}")
            else:
                wp = await run_matter(matter)
                products.append(wp)
                print(f"  [ok] {matter.id} ({len(wp['trace'])} trace steps, "
                      f"{len(wp['citations'])} citations, {len(wp['claims'])} claims, "
                      f"{len(wp['edges'])} edges)")
        except Exception as exc:  # one matter failing must not lose the rest
            print(f"  [FAIL] {matter.id}: {exc!r}", file=sys.stderr)

    if not products:
        print("No work products produced — nothing written.", file=sys.stderr)
        return 1

    _write_output(products)
    print("\nNext: cp agents/out/work-products.json data/seed/work-products.json && npm run seed")
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate the Itaily seed dataset via ADK.")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Offline: emit deterministic fixtures without ADK, keys, or network.",
    )
    args = parser.parse_args()
    raise SystemExit(asyncio.run(_main_async(dry_run=args.dry_run)))


if __name__ == "__main__":
    main()
