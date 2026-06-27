"""CELLAR grounding tools for the research agent.

These are plain Python functions. ADK turns a plain function into a tool
automatically when you put it in an ``LlmAgent(tools=[...])`` list — it reads the
function name, type hints and docstring to build the tool schema the model sees.
So the docstrings below are the model-facing tool descriptions: keep them crisp.

What they do
------------
``cellar_search``  - SPARQL query against the EU CELLAR endpoint to find EU legal
                     acts by keyword, returning their CELEX ids + titles.
``cellar_fetch``   - REST retrieval by CELEX to CONFIRM a citation resolves and to
                     pull a usable source URL / metadata.
``celex_from_cite``- pure helper turning a human cite ("2016/679", "regulation")
                     into a CELEX id ("32016R0679"). No network.

CELLAR is public (no auth). We keep concurrency low, set short timeouts, send a
descriptive User-Agent, and ALWAYS fail soft: every function returns a dict with
an ``ok`` flag instead of raising, so a flaky network never crashes a seed run.

These functions are usable standalone (``python -m itaily_agents.tools``).
"""

from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Any

import httpx

# --- CELLAR endpoints / constants -------------------------------------------------

SPARQL_ENDPOINT = "https://publications.europa.eu/webapi/rdf/sparql"
# REST retrieval of a resource by CELEX number.
CELEX_RESOURCE_BASE = "http://publications.europa.eu/resource/celex"
# Public-facing EUR-Lex URL we store as the citation's ``sourceUrl``.
EURLEX_TXT_BASE = "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:"
# ELI base (European Legislation Identifier), used to build the ``eli`` field.
ELI_BASE = "http://data.europa.eu/eli"

# English only. CELLAR is multilingual; without a language filter a SPARQL query
# returns one row per language and explodes. The authority URI for English:
LANG_ENG = "<http://publications.europa.eu/resource/authority/language/ENG>"

# CDM is the Common Data Model ontology CELLAR is described in.
CDM_PREFIX = "PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>"

# Be a polite, identifiable client.
USER_AGENT = "ItailyLegalSeedBot/0.1 (+https://github.com/itaily/hackthelaw; hackathon offline seed generator)"

# Defensive defaults. Short timeouts so a stalled request never hangs a run.
DEFAULT_TIMEOUT_S = 20.0
# Title CONTAINS scans over the full CELLAR title index can take 20-30s for some
# token combinations, so the SPARQL search gets a more generous ceiling than the
# cheap by-CELEX existence check.
SEARCH_TIMEOUT_S = 60.0
DEFAULT_LIMIT = 5

# Dropped from the free-text query before building the per-word title filters:
# short connective words that match almost every title and only add scan cost.
_SEARCH_STOPWORDS = {
    "the", "and", "for", "with", "under", "from", "into", "eu", "of", "to",
    "in", "on", "a", "an", "by", "or", "its", "per",
}


# --- CELEX helpers ----------------------------------------------------------------

# Map a human "kind" of act to its CELEX descriptor letter and (usually) sector 3.
#   Regulation     -> R
#   Directive      -> L
#   Decision       -> D
# CELEX layout for secondary legislation: sector(3) + year(YYYY) + type-letter +
# zero-padded running number(4). e.g. Regulation (EU) 2016/679 -> 3 2016 R 0679.
_CELEX_TYPE_LETTER = {
    "regulation": "R",
    "reg": "R",
    "directive": "L",
    "dir": "L",
    "decision": "D",
    "dec": "D",
}


def celex_from_cite(citation: str, act_type: str = "regulation") -> dict[str, Any]:
    """Build a CELEX id from a human citation. Pure, no network.

    Args:
        citation: A "year/number" cite, e.g. "2016/679" or "Directive 2011/83".
            If the word "regulation", "directive" or "decision" appears in the
            text it is used to pick the type letter, so you don't have to set
            ``act_type`` separately.
        act_type: "regulation" | "directive" | "decision" (default regulation).
            Pass this when the citation text doesn't name the instrument kind —
            getting it wrong yields the wrong CELEX letter and a 404 on fetch.

    Returns:
        ``{"ok": True, "celex": "32016R0679", "eli": "...", "source_url": "..."}``
        or ``{"ok": False, "error": "..."}`` if the citation can't be parsed.
    """
    # Infer the instrument kind from the citation text when the caller left the
    # default ("regulation") or passed something unrecognised, so "Directive
    # 2011/83" does not silently become a Regulation CELEX (wrong letter -> 404).
    chosen = (act_type or "").strip().lower()
    lowered = citation.lower()
    inferred = (
        "directive" if "directive" in lowered
        else "decision" if "decision" in lowered
        else "regulation" if "regulation" in lowered
        else None
    )
    if inferred and chosen in ("", "regulation") and chosen != inferred:
        chosen = inferred

    letter = _CELEX_TYPE_LETTER.get(chosen)
    if not letter:
        return {"ok": False, "error": f"unknown act_type {act_type!r}"}

    # Pull the first "YYYY/NNN" pair out of arbitrary surrounding text.
    m = re.search(r"(\d{4})\s*/\s*(\d{1,4})", citation)
    if not m:
        return {"ok": False, "error": f"could not parse year/number from {citation!r}"}

    year, number = m.group(1), m.group(2)
    celex = f"3{year}{letter}{int(number):04d}"

    # ELI path differs slightly per type (reg / dir / dec_impl etc.). We build the
    # common case; the critic/research agent can refine if needed.
    eli_type = {"R": "reg", "L": "dir", "D": "dec"}[letter]
    eli = f"{ELI_BASE}/{eli_type}/{year}/{int(number)}/oj"

    return {
        "ok": True,
        "celex": celex,
        "eli": eli,
        "source_url": f"{EURLEX_TXT_BASE}{celex}",
    }


# --- internal HTTP helper ---------------------------------------------------------


def _client(timeout: float = DEFAULT_TIMEOUT_S) -> httpx.Client:
    """A short-lived, identifiable, low-concurrency HTTP client."""
    return httpx.Client(
        timeout=timeout,
        headers={"User-Agent": USER_AGENT},
        # Keep it modest; we are a polite offline batch job, not a crawler.
        limits=httpx.Limits(max_connections=2, max_keepalive_connections=1),
        follow_redirects=True,
    )


# --- the two ADK tools ------------------------------------------------------------


def cellar_search(query: str, limit: int = DEFAULT_LIMIT) -> dict[str, Any]:
    """Search EU legislation in CELLAR by keyword and return matching acts.

    Use this to FIND the EU legal act(s) relevant to a legal question before
    citing them. Returns CELEX ids and English titles you can then verify with
    ``cellar_fetch``.

    Args:
        query: Free-text legal topic, e.g. "international data transfers GDPR".
        limit: Max number of acts to return (kept small on purpose).

    Returns:
        ``{"ok": True, "results": [{"celex","title","work","source_url"}, ...]}``
        or ``{"ok": False, "error": "...", "results": []}`` on any failure.
    """
    limit = max(1, min(int(limit), 25))
    # Search over the English titles of EU *legislation*. Three things make this
    # actually return results (verified against the live endpoint 2026-06):
    #   1. Walk work<-expression via `cdm:expression_belongs_to_work` (the INVERSE
    #      direction). The forward `cdm:work_has_expression` is not populated and
    #      returns zero rows.
    #   2. Restrict to CELEX sector 3 (secondary legislation: Regulations,
    #      Directives, Decisions) so parliamentary questions, case law and
    #      opinions don't drown the controlling instruments.
    #   3. Require the two MOST DISCRIMINATIVE query words (the longest, e.g.
    #      "intelligence"+"artificial") as independent CONTAINS filters rather than
    #      the whole phrase. Words in any order match, and capping at two keeps a
    #      longer query like "artificial intelligence high-risk" from over-
    #      constraining to zero rows (no title carries every word).
    tokens = _search_tokens(query)
    if tokens:
        title_filters = "\n  ".join(
            f'FILTER(CONTAINS(LCASE(STR(?title)), "{_sparql_escape(t)}"))' for t in tokens
        )
    else:  # query was all stopwords/punctuation — fall back to the raw phrase.
        title_filters = f'FILTER(CONTAINS(LCASE(STR(?title)), "{_sparql_escape(query.lower())}"))'

    sparql = f"""{CDM_PREFIX}
SELECT DISTINCT ?work ?celex ?title WHERE {{
  ?exp cdm:expression_belongs_to_work ?work .
  ?work cdm:resource_legal_id_celex ?celex .
  ?exp cdm:expression_uses_language {LANG_ENG} .
  ?exp cdm:expression_title ?title .
  FILTER(STRSTARTS(STR(?celex), "3"))
  {title_filters}
}}
LIMIT {limit}"""

    try:
        with _client(SEARCH_TIMEOUT_S) as client:
            resp = client.post(
                SPARQL_ENDPOINT,
                data={"query": sparql, "format": "application/sparql-results+json"},
                headers={"Accept": "application/sparql-results+json"},
            )
            resp.raise_for_status()
            payload = resp.json()
    except (httpx.HTTPError, ValueError) as exc:  # network, status, or bad JSON
        return {"ok": False, "error": f"cellar_search failed: {exc}", "results": []}

    results: list[dict[str, str]] = []
    for row in payload.get("results", {}).get("bindings", []):
        celex = row.get("celex", {}).get("value", "")
        results.append(
            {
                "celex": celex,
                "title": row.get("title", {}).get("value", ""),
                "work": row.get("work", {}).get("value", ""),
                "source_url": f"{EURLEX_TXT_BASE}{celex}" if celex else "",
            }
        )

    return {"ok": True, "results": results, "count": len(results)}


def cellar_fetch(celex: str, fmt: str = "identifiers") -> dict[str, Any]:
    """Confirm an EU act resolves in CELLAR by its CELEX id and return metadata.

    Use this to VERIFY that a citation actually exists before relying on it (the
    critic agent depends on this to catch hallucinated authorities). A 200 means
    the act is real and citable; a 404/410 means it does not resolve.

    Args:
        celex: The CELEX id, e.g. "32016R0679".
        fmt: "identifiers" (cheap metadata, default) or "html" (full text URL).

    Returns:
        ``{"ok": True, "resolves": bool, "status": int, "celex": ...,
           "source_url": ..., "content_type": ...}`` or
        ``{"ok": False, "error": "...", "resolves": False}`` on failure.
    """
    celex = (celex or "").strip().upper()
    if not re.fullmatch(r"[0-9A-Z]{6,}", celex):
        return {"ok": False, "error": f"invalid CELEX {celex!r}", "resolves": False}

    # ``notice=identifiers`` returns a small XML notice (cheap "does it exist?"
    # check). ``text/html`` returns the consolidated text page.
    if fmt == "html":
        accept = "text/html"
    else:
        accept = "application/xml; notice=identifiers"

    url = f"{CELEX_RESOURCE_BASE}/{celex}"
    try:
        with _client() as client:
            # HEAD-like cheap check via GET (CELLAR doesn't reliably support HEAD);
            # we only read status + headers, not the whole body where possible.
            resp = client.get(
                url,
                headers={"Accept": accept, "Accept-Language": "en"},
            )
    except httpx.HTTPError as exc:
        return {"ok": False, "error": f"cellar_fetch failed: {exc}", "resolves": False}

    resolves = resp.status_code == 200
    return {
        "ok": True,
        "resolves": resolves,
        "status": resp.status_code,
        "celex": celex,
        # The stable public page a human can open from the console:
        "source_url": f"{EURLEX_TXT_BASE}{celex}",
        "content_type": resp.headers.get("content-type", ""),
    }


def _sparql_escape(value: str) -> str:
    """Escape a string for safe inlining into a SPARQL string literal."""
    return value.replace("\\", "\\\\").replace('"', '\\"')


def _search_tokens(query: str, keep: int = 2) -> list[str]:
    """The ``keep`` most discriminative (longest) words from a free-text topic.

    Significant = longer than two chars and not a connective stopword. Returning
    the longest few keeps the per-word title AND from over-constraining to zero
    rows on a multi-word query.
    """
    words = re.findall(r"[a-z0-9]+", (query or "").lower())
    significant = [w for w in words if len(w) > 2 and w not in _SEARCH_STOPWORDS]
    # Keep the longest `keep`, preserving original order among those chosen.
    chosen = set(sorted(significant, key=len, reverse=True)[:keep])
    return [w for w in significant if w in chosen]


# --- web research tool (Perplexity) -----------------------------------------------

PERPLEXITY_URL = "https://api.perplexity.ai/chat/completions"
PERPLEXITY_DEFAULT_MODEL = "sonar"


def _csv(value: str) -> list[str]:
    """Split a comma/space-separated domain string into a clean list."""
    return [d.strip().lower() for d in re.split(r"[,\s]+", value or "") if d.strip()]


def web_search(query: str, allow_domains: str = "", deny_domains: str = "") -> dict[str, Any]:
    """Research a legal question on the OPEN WEB via Perplexity, scoped to domains.

    Use this to corroborate or supplement CELLAR with secondary sources (regulator
    guidance, EUR-Lex, case summaries). You control the scope:

    Args:
        query: The legal question or topic to research.
        allow_domains: Comma-separated domains to restrict the search to, e.g.
            "eur-lex.europa.eu,edpb.europa.eu". Empty = open web.
        deny_domains: Comma-separated domains to exclude (sent as `-domain`).

    Returns:
        ``{"ok": True, "answer": str, "sources": [{"title","url"}]}`` or
        ``{"ok": False, "error": "...", "sources": []}`` (e.g. no key / network).
    """
    key = os.getenv("PERPLEXITY_API_KEY")
    if not key:
        return {"ok": False, "error": "PERPLEXITY_API_KEY not set", "sources": []}

    domain_filter = _csv(allow_domains) + [f"-{d}" for d in _csv(deny_domains)]
    domain_filter = domain_filter[:10]  # Perplexity caps the filter list.

    body: dict[str, Any] = {
        "model": os.getenv("PERPLEXITY_MODEL", PERPLEXITY_DEFAULT_MODEL),
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are an EU-law research assistant. Answer concisely in 2-3 "
                    "sentences using only what the retrieved sources support. Never "
                    "invent an authority."
                ),
            },
            {"role": "user", "content": query},
        ],
        "temperature": 0.1,
        "max_tokens": 400,
    }
    if domain_filter:
        body["search_domain_filter"] = domain_filter

    try:
        with _client() as client:
            resp = client.post(
                PERPLEXITY_URL,
                json=body,
                headers={"Authorization": f"Bearer {key}"},
            )
            resp.raise_for_status()
            payload = resp.json()
    except (httpx.HTTPError, ValueError) as exc:
        return {"ok": False, "error": f"web_search failed: {exc}", "sources": []}

    answer = (payload.get("choices") or [{}])[0].get("message", {}).get("content", "").strip()
    sources: list[dict[str, str]] = []
    for s in payload.get("search_results") or []:
        if s.get("url"):
            sources.append({"title": s.get("title") or s["url"], "url": s["url"]})
    if not sources:
        for url in payload.get("citations") or []:
            sources.append({"title": url, "url": url})

    return {"ok": True, "answer": answer, "sources": sources[:6]}


# --- firm knowledge tool (on-perimeter, no network) -------------------------------

# The private corpus lives in the app's seed dir: repo_root/data/seed/firm-knowledge.
_FIRM_KB_DIR = Path(__file__).resolve().parents[2] / "data" / "seed" / "firm-knowledge"
_STOPWORDS = {
    "the", "and", "for", "with", "that", "this", "from", "are", "was", "has", "have",
    "not", "but", "any", "all", "its", "under", "where", "shall", "must", "may",
}


def _kb_terms(text: str) -> list[str]:
    """Content words (length >= 3) of a string, de-duplicated, lowercased."""
    seen: dict[str, None] = {}
    for w in re.findall(r"[a-z]{3,}", text.lower()):
        if w not in _STOPWORDS:
            seen.setdefault(w, None)
    return list(seen)


def _parse_frontmatter(raw: str) -> tuple[dict[str, str], str]:
    """Minimal `---`-delimited frontmatter parser (no YAML dependency)."""
    meta: dict[str, str] = {}
    body = raw
    m = re.match(r"^---\n(.*?)\n---\n?", raw, re.DOTALL)
    if m:
        for line in m.group(1).splitlines():
            if ":" in line:
                key, _, val = line.partition(":")
                if key.strip():
                    meta[key.strip()] = val.strip()
        body = raw[m.end():]
    return meta, body.strip()


def firm_knowledge_search(query: str, k: int = 3) -> dict[str, Any]:
    """Search the firm's PRIVATE knowledge base. Runs ON-PERIMETER — no network call.

    The corpus (internal memos, precedents, playbook clauses) is confidential and
    privileged. Reasoning over the results must use an open, self-hostable model so
    nothing leaves the firm boundary. This tool only does lexical retrieval locally.

    Args:
        query: The claim or topic to look up in the firm's materials.
        k: Max number of documents to return.

    Returns:
        ``{"ok": True, "results": [{"title","ref","snippet"}]}`` or
        ``{"ok": False, "error": "...", "results": []}`` if the corpus is missing.
    """
    if not _FIRM_KB_DIR.is_dir():
        return {"ok": False, "error": f"corpus not found at {_FIRM_KB_DIR}", "results": []}

    qterms = _kb_terms(query)
    if not qterms:
        return {"ok": True, "results": []}

    scored: list[tuple[int, dict[str, str]]] = []
    for path in sorted(_FIRM_KB_DIR.glob("*.md")):
        meta, body = _parse_frontmatter(path.read_text(encoding="utf-8"))
        title = meta.get("title", path.stem)
        tags = meta.get("tags", "")
        hay_title, hay_tags, hay_body = title.lower(), tags.lower(), body.lower()
        score = 0
        for t in qterms:
            score += hay_title.count(t) * 3 + hay_tags.count(t) * 2 + min(hay_body.count(t), 4)
        if score > 0:
            # First sentence mentioning a query term, else the opening.
            sentences = re.split(r"(?<=[.!?])\s+", body)
            snippet = next((s for s in sentences if any(t in s.lower() for t in qterms)), body)
            snippet = snippet.strip()
            if len(snippet) > 240:
                snippet = snippet[:237].rstrip() + "…"
            scored.append((score, {"title": title, "ref": meta.get("ref", path.stem), "snippet": snippet}))

    scored.sort(key=lambda x: x[0], reverse=True)
    return {"ok": True, "results": [r for _, r in scored[: max(1, k)]]}


# --- standalone smoke test --------------------------------------------------------

if __name__ == "__main__":
    # Quick manual check: `python -m itaily_agents.tools`
    # (Requires network. Safe to run repeatedly; read-only.)
    print("celex_from_cite('2016/679'):", celex_from_cite("2016/679"))
    print("cellar_fetch('32016R0679'):", cellar_fetch("32016R0679"))
    print("cellar_search('data transfers'):", cellar_search("data transfers", limit=3))
