"""Work-group presets + auto-assignment — the Python mirror of src/lib/workgroups.ts.

Kept byte-for-byte consistent with the TypeScript copy so an atomic claim gets the
SAME default preset whether it is assigned offline here (seed time) or recomputed in
the browser. A "work group" is an ordered set of figures (research / drafter / critic),
each with a model + effort.
"""

from __future__ import annotations

import re
from typing import Any

DEFAULT_PRESET = "standard_review"

# Research tools a figure can carry — mirrors RESEARCH_TOOL in src/lib/workgroups.ts.
#   cellar    -> EU CELLAR / EUR-Lex authority lookup & grounding.
#   web       -> open-web research via Perplexity, scoped to allow/deny domains.
#   knowledge -> the firm's private knowledge base (on-perimeter, open model).
RESEARCH_TOOL: dict[str, dict[str, str]] = {
    "cellar": {"label": "CELLAR", "icon": "gavel"},
    "web": {"label": "Web", "icon": "external-link"},
    "knowledge": {"label": "Firm knowledge", "icon": "lock"},
}

# Default allow-list for the web tool in an EU-law console.
DEFAULT_WEB_ALLOW = [
    "eur-lex.europa.eu",
    "curia.europa.eu",
    "edpb.europa.eu",
    "eba.europa.eu",
]

# preset id -> {"label", "figures": [{"role", "model", "effort", "desc", "tools?", "web?"}]}
PRESETS: dict[str, dict[str, Any]] = {
    "quick_scan": {
        "label": "Quick scan",
        "figures": [
            {
                "role": "critic",
                "model": "gemini-2.5-flash",
                "effort": "low",
                "desc": "Sanity-checks the claim for any stray legal assertion; no CELLAR lookup.",
            }
        ],
    },
    "standard_review": {
        "label": "Standard review",
        "figures": [
            {
                "role": "research",
                "model": "gemini-2.5-flash",
                "effort": "med",
                "desc": "Confirms the governing EU instrument for the claim.",
                "tools": ["cellar"],
            },
            {
                "role": "critic",
                "model": "claude-sonnet",
                "effort": "med",
                "desc": "Re-verifies the citation resolves and rates support + risk.",
            },
        ],
    },
    "authority_deep_dive": {
        "label": "Authority audit",
        "figures": [
            {
                "role": "research",
                "model": "claude-sonnet",
                "effort": "high",
                "desc": "Drives CELLAR / EUR-Lex over MCP to verify every authority the claim relies on.",
                "tools": ["cellar"],
            },
            {
                "role": "critic",
                "model": "claude-opus-4-8",
                "effort": "high",
                "desc": "Adversarially re-checks every CELEX resolves and stress-tests jurisdiction/deadline.",
            },
        ],
    },
    "web_augmented_audit": {
        "label": "Web-augmented audit",
        "figures": [
            {
                "role": "research",
                "model": "claude-sonnet",
                "effort": "high",
                "desc": "Drives CELLAR / EUR-Lex over MCP to verify every authority the claim relies on.",
                "tools": ["cellar"],
            },
            {
                "role": "research",
                "model": "claude-sonnet",
                "effort": "med",
                "desc": "Corroborates with targeted open-web research on trusted domains.",
                "tools": ["web"],
                "web": {"allow": list(DEFAULT_WEB_ALLOW), "deny": []},
            },
            {
                "role": "critic",
                "model": "claude-opus-4-8",
                "effort": "high",
                "desc": "Adversarially re-checks every CELEX resolves and stress-tests jurisdiction/deadline.",
            },
        ],
    },
    # Flagship manual preset: all three canonical researchers in parallel, then an Opus
    # critic. Manual-only — never returned by auto_preset, so it stays outside the
    # atomic_claim.assigned_preset DB enum (no migration).
    "full_research_panel": {
        "label": "Full research panel",
        "figures": [
            {
                "role": "research",
                "model": "claude-sonnet",
                "effort": "high",
                "desc": "EU Law researcher — drives CELLAR / EUR-Lex over MCP to verify every cited authority.",
                "tools": ["cellar"],
            },
            {
                "role": "research",
                "model": "claude-sonnet",
                "effort": "med",
                "desc": "Web researcher — targeted open-web corroboration via Perplexity on trusted domains.",
                "tools": ["web"],
                "web": {"allow": list(DEFAULT_WEB_ALLOW), "deny": []},
            },
            {
                "role": "research",
                "model": "nemotron",
                "effort": "med",
                "desc": "Firm knowledge researcher — consults the firm's private corpus on a self-hostable open model.",
                "tools": ["knowledge"],
            },
            {
                "role": "critic",
                "model": "claude-opus-4-8",
                "effort": "high",
                "desc": "Weighs all three researchers, re-checks every CELEX, and delivers the verdict + risk.",
            },
        ],
    },
}

# The palette of ready-made figures the supervisor can drop into a work group —
# three researchers pre-tuned to excel in their field (each wired to one tool), plus
# the generic drafter / critic. Mirrors FIGURE_PRESETS in src/lib/workgroups.ts.
FIGURE_PRESETS: dict[str, dict[str, Any]] = {
    "cellar_researcher": {
        "label": "EU Law researcher",
        "icon": "gavel",
        "figure": {
            "role": "research",
            # Claude Sonnet 4.6 drives the CELLAR/EUR-Lex tools over MCP: best tool-use
            # discipline and the lowest rate of inventing a CELEX that doesn't resolve.
            "model": "claude-sonnet",
            "effort": "high",
            "desc": "Drives CELLAR / EUR-Lex over MCP to verify every authority the claim cites — never invents one.",
            "tools": ["cellar"],
        },
    },
    "web_researcher": {
        "label": "Web researcher",
        "icon": "external-link",
        "figure": {
            "role": "research",
            "model": "claude-sonnet",
            "effort": "med",
            "desc": "Targeted open-web research via Perplexity, scoped to trusted EU domains.",
            "tools": ["web"],
            "web": {"allow": list(DEFAULT_WEB_ALLOW), "deny": []},
        },
    },
    "knowledge_researcher": {
        "label": "Firm knowledge researcher",
        "icon": "lock",
        "figure": {
            "role": "research",
            "model": "nemotron",
            "effort": "med",
            "desc": "Consults the firm's private knowledge base on a self-hostable open model (stays on-perimeter).",
            "tools": ["knowledge"],
        },
    },
    # No drafter palette figure: at verification time drafting is already done, so it
    # is not offered as a runtime figure. The 'drafter' role stays valid for the offline
    # pipeline (its drafter writes the seed work products).
    "critic": {
        "label": "Critic",
        "icon": "shield-alert",
        "figure": {
            "role": "critic",
            "model": "claude-sonnet",
            "effort": "med",
            "desc": "Re-verifies the citation resolves and rates support + risk.",
        },
    },
}


_MODAL_OBLIGATION = re.compile(r"\b(shall|must|is required to|may not|prohibited|obliged)\b", re.IGNORECASE)
_CITATION_MARKER = re.compile(r"\[\d+\]")


def auto_preset(text: str, kind: str = "assertion") -> str:
    """Deterministic preset for a claim — identical logic to autoPreset() in TS. First match wins."""
    text = text or ""
    if kind in ("heading", "boilerplate") or len(text.strip()) < 40:
        return "quick_scan"
    if _CITATION_MARKER.search(text) or kind in ("citation_ref", "obligation") or _MODAL_OBLIGATION.search(text):
        return "authority_deep_dive"
    return "standard_review"


def figure_trace_for(preset_id: str, summary: str = "") -> list[dict[str, Any]]:
    """A per-figure trace skeleton from a preset's figures (the app fills ms/summary live)."""
    preset = PRESETS.get(preset_id, PRESETS[DEFAULT_PRESET])
    trace = []
    for f in preset["figures"]:
        tool = (f.get("tools") or [None])[0] if f["role"] == "research" else None
        kind = "search" if tool in ("web",) else "retrieve" if f["role"] == "research" else "draft" if f["role"] == "drafter" else "critique"
        step: dict[str, Any] = {
            "role": f["role"],
            "model": f["model"],
            "effort": f["effort"],
            "kind": kind,
            "summary": summary if f["role"] == "critic" and summary else f["desc"],
            "ms": 150 + {"low": 1, "med": 2, "high": 3}[f["effort"]] * 120,
        }
        if tool:
            step["tool"] = tool
        trace.append(step)
    return trace
