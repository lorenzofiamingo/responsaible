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
import sys
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import re

from dotenv import load_dotenv

from .models import get_model_label
from .workgroups import auto_preset

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
]


# --- ADK event -> console trace mapping -------------------------------------------

# Map an ADK sub-agent author name to the console's actorAgent enum.
_ACTOR_BY_AUTHOR = {"research": "research", "drafter": "drafter", "critic": "critic"}

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
            kind = {"research": "reason", "drafter": "draft", "critic": "critique"}.get(
                actor, "reason"
            )
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
) -> list[dict[str, Any]]:
    """Merge the splitter's atomic claims with the per-claim analyses into the loader shape.

    Each claim is stamped with its auto-assigned work-group preset (so the offline
    default matches the in-browser one) and the citation markers it carries.
    """
    by_idx = {a.get("idx"): a for a in (analyses_raw or [])}
    claims: list[dict[str, Any]] = []
    for c in claims_raw or []:
        text = c.get("text", "")
        kind = c.get("kind", "assertion")
        markers = [int(m) for m in _MARKER_RE.findall(text)]
        a = by_idx.get(c.get("idx"), {})
        claims.append(
            {
                "idx": c.get("idx"),
                "text": text,
                "charStart": c.get("charStart", 0),
                "charEnd": c.get("charEnd", 0),
                "kind": kind,
                "assignedPreset": auto_preset(text, kind),
                "citationMarkers": a.get("citationMarkers") or markers,
                "analysis": {
                    "verdict": a.get("verdict", "supported"),
                    "confidence": _clamp(a.get("confidence"), default=0.7),
                    "summary": a.get("summary", ""),
                    "riskCategory": a.get("riskCategory"),
                    "riskSeverity": a.get("riskSeverity"),
                    "riskRationale": a.get("riskRationale", ""),
                    "figureTrace": None,
                },
            }
        )
    return claims


def assemble_work_product(
    matter: SeedMatter,
    draft: dict[str, Any],
    critique: dict[str, Any],
    trace: list[dict[str, Any]],
    created_at: str,
    claims: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Build the final work-product object in the EXACT shape the app loads."""
    wp_type = draft.get("type") or matter.expected_type
    confidence = _clamp(critique.get("confidence"), default=0.7)

    citations = []
    for i, c in enumerate(draft.get("citations", []) or [], start=1):
        citations.append(
            {
                "marker": c.get("marker", i),
                "claim": c.get("claim", ""),
                "celex": c.get("celex"),
                "eli": c.get("eli"),
                "title": c.get("title", ""),
                "sourceUrl": c.get("sourceUrl") or c.get("source_url"),
                "snippet": c.get("snippet", ""),
                "locator": c.get("locator", ""),
                "supportsClaim": bool(c.get("supportsClaim", True)),
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
    }


# --- running one matter through ADK -----------------------------------------------


async def run_matter(matter: SeedMatter) -> dict[str, Any]:
    """Drive the pipeline for one matter and return an assembled work product.

    ADK runtime pattern (VERIFY against installed version — see README):
      - ``InMemorySessionService`` + ``Runner(agent, app_name, session_service)``
      - ``await session_service.create_session(app_name, user_id, session_id)``
      - ``async for event in runner.run_async(user_id, session_id, new_message)``
      - read final structured state from the session after the loop.
    """
    # Imported here so --dry-run never requires ADK to be installed.
    from google.adk.runners import Runner
    from google.adk.sessions import InMemorySessionService
    from google.genai import types

    from .pipeline import (
        CLAIM_ANALYSES_OUTPUT_KEY,
        CLAIMS_OUTPUT_KEY,
        CRITIC_OUTPUT_KEY,
        DRAFT_OUTPUT_KEY,
        build_pipeline,
    )

    session_service = InMemorySessionService()
    session_id = f"seed-{matter.id}-{uuid.uuid4().hex[:8]}"

    # create_session is async in current ADK. (Older builds were sync — if this
    # raises "coroutine was never awaited", drop the await.)
    await session_service.create_session(
        app_name=APP_NAME, user_id=USER_ID, session_id=session_id
    )

    runner = Runner(
        agent=build_pipeline(),
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
    critique = _parse_json_blob(state.get(CRITIC_OUTPUT_KEY, ""))
    claims_raw = _parse_json_blob(state.get(CLAIMS_OUTPUT_KEY, "")).get("claims", [])
    analyses_raw = _parse_json_blob(state.get(CLAIM_ANALYSES_OUTPUT_KEY, "")).get("analyses", [])
    claims = build_claims(claims_raw, analyses_raw, draft.get("body", ""))

    created_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    return assemble_work_product(matter, draft, critique, builder.steps, created_at, claims)


# --- dry-run fixture (offline, no ADK / no network) -------------------------------


def dry_run_product(matter: SeedMatter) -> dict[str, Any]:
    """Produce a deterministic offline fixture matching the output contract.

    Lets you exercise the whole write/seed path without API keys or network, and
    documents exactly what a real run emits.
    """
    created_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    body = "This is a placeholder body produced by --dry-run [1]."
    claims = [
        {
            "idx": 0,
            "text": body,
            "charStart": 0,
            "charEnd": len(body),
            "kind": "citation_ref",
            "assignedPreset": auto_preset(body, "citation_ref"),
            "citationMarkers": [1],
            "analysis": {
                "verdict": "supported",
                "confidence": 0.7,
                "summary": "Placeholder claim grounded in the dry-run citation.",
                "riskCategory": None,
                "riskSeverity": None,
                "riskRationale": "",
                "figureTrace": None,
            },
        }
    ]
    trace = [
        {"step": 1, "kind": "search", "actorAgent": "research",
         "summary": "Called cellar_search(query='…').",
         "detail": {"tool": "cellar_search", "args": {"query": matter.matter_name}}},
        {"step": 2, "kind": "cite", "actorAgent": "research",
         "summary": "Verified the governing CELEX: resolves.",
         "detail": {"tool": "cellar_fetch", "result": {"resolves": True}}},
        {"step": 3, "kind": "draft", "actorAgent": "drafter",
         "summary": "Drafted the work product with grounded citations."},
        {"step": 4, "kind": "critique", "actorAgent": "critic",
         "summary": "Re-verified citations and set confidence."},
    ]
    return {
        "id": matter.id,
        "type": matter.expected_type,
        "title": f"[DRY RUN] {matter.matter_name}",
        "summary": "Offline fixture — replace by running the real ADK pipeline.",
        "body": body,
        "matterRef": matter.matter_ref,
        "matterName": matter.matter_name,
        "agentName": AGENT_NAME_BY_TYPE.get(matter.expected_type, "Itaily Research Agent"),
        "status": "pending",
        "priority": matter.priority,
        "confidence": 0.7,
        "model": get_model_label(),
        "createdAt": created_at,
        "trace": trace,
        "citations": [
            {"marker": 1, "claim": "Placeholder grounded claim.", "celex": "32016R0679",
             "eli": "http://data.europa.eu/eli/reg/2016/679/oj",
             "title": "Regulation (EU) 2016/679 (GDPR)",
             "sourceUrl": "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32016R0679",
             "snippet": "…", "locator": "Art. 1", "supportsClaim": True}
        ],
        "riskSignals": [],
        "claims": claims,
    }


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
                      f"{len(wp['citations'])} citations)")
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
