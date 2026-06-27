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

# preset id -> {"label", "figures": [{"role", "model", "effort", "desc"}]}
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
                "model": "gemini-2.5-pro",
                "effort": "high",
                "desc": "Exhaustively searches CELLAR for every authority the claim relies on.",
            },
            {
                "role": "drafter",
                "model": "claude-opus-4-8",
                "effort": "high",
                "desc": "Re-states the claim and pins each [n] to an article locator.",
            },
            {
                "role": "critic",
                "model": "claude-opus-4-8",
                "effort": "high",
                "desc": "Adversarially re-checks every CELEX resolves and stress-tests jurisdiction/deadline.",
            },
        ],
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
        kind = "retrieve" if f["role"] == "research" else "draft" if f["role"] == "drafter" else "critique"
        trace.append(
            {
                "role": f["role"],
                "model": f["model"],
                "effort": f["effort"],
                "kind": kind,
                "summary": summary if f["role"] == "critic" and summary else f["desc"],
                "ms": 150 + {"low": 1, "med": 2, "high": 3}[f["effort"]] * 120,
            }
        )
    return trace
