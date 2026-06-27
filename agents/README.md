# Itaily Agents — offline ADK seed generator

This directory is a **Python-only, offline** [Google Agent Development Kit
(ADK)](https://google.github.io/adk-docs/) pipeline. It generates the SEED
dataset for the Itaily legal-work supervision console.

It is **not deployed**. The SvelteKit app (Cloudflare Workers) never runs ADK at
runtime. ADK runs here, on your laptop, once, to produce a JSON file. The whole
point of using ADK is that its **event stream** (what tools each agent called,
what each agent said) becomes the authentic "what the AI did" trace shown in the
console — we capture `session.events` from the ADK `Runner` and serialize it.

```
matter prompt
   ──► [ research ─► drafter ─► claim_splitter ─► claim_grapher ─► claim_analyzer ─► critic ]
         │ CELLAR        │            │ atomic      │ reasoning      │ per-claim       │ re-verify
         │ tools         │            │ claims      │ edges          │ verdicts        │ CELEX
         ▼               ▼            ▼             ▼                ▼                 ▼
                       session.events  ──►  transform  ──►  work-products.json
                                                               │
                                   human copies into the app ──┘  ──► npm run seed
```

## What the agents do

One ADK `SequentialAgent` runs six sub-agents in order, sharing one session so
each sees the previous outputs and the whole run yields ONE event stream:

| Agent            | Role | Tools |
|------------------|------|-------|
| `research`       | Find the controlling EU instruments; confirm each CELEX resolves. | `cellar_search`, `cellar_fetch`, `celex_from_cite` |
| `drafter`        | Write the draft/memo/opinion/risk_analysis with `[1] [2]` citation markers. | — |
| `claim_splitter` | Split the body into atomic claims with exact character offsets. | — |
| `claim_grapher`  | Map the directed premise/definition/elaboration/qualification/conflict edges between claims. | — |
| `claim_analyzer` | Rate each claim (verdict + confidence + risk), re-checking cited CELEX. | `cellar_fetch` |
| `critic`         | Re-verify every cited CELEX, flag hallucination / missing-authority / jurisdiction / deadline risks, set a confidence. | `cellar_fetch` |

Grounding is against the public **EU CELLAR** API (no auth): a SPARQL endpoint
for search and a REST-by-CELEX endpoint to confirm an act actually exists. The
tools are in `itaily_agents/tools.py` and are usable standalone.

## Setup

Requires Python **3.11–3.13**. (Not 3.14 yet: the `google-adk → google-genai →
pydantic` stack fails to import on 3.14 with a `typing._eval_type` error.)

```bash
cd agents
python3.12 -m venv .venv           # any 3.11–3.13 interpreter
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -e .                   # installs google-adk, litellm, httpx, dotenv
```

Configure credentials:

```bash
cp .env.example .env
# edit .env — set ITAILY_MODEL_PROVIDER and the matching API key(s)
```

## Choosing the model

One env var switches the model for all six agents (see `itaily_agents/models.py`):

```bash
# Native Gemini (default)
ITAILY_MODEL_PROVIDER=gemini
GOOGLE_API_KEY=...            # or the Vertex AI vars in .env.example

# Anthropic Claude (via ADK's LiteLlm wrapper)
ITAILY_MODEL_PROVIDER=claude
ANTHROPIC_API_KEY=...
```

## Run

```bash
# Offline smoke test — no keys, no network. Builds deterministic fixtures and
# runs them through the SAME assembly the real run uses, so it is a genuine
# end-to-end contract test of the output (verified citations, atomic claims with
# exact offsets, reasoning edges, six-actor trace).
python -m itaily_agents.run_seed --dry-run

# Real run — drives the ADK pipeline over the seed matters (needs keys + net).
python -m itaily_agents.run_seed
```

Output is written to `agents/out/work-products.json`. A partial failure (one
matter erroring — including a drafter reply that doesn't parse into a body) is
logged and skipped; everything that succeeded is still written. `createdAt` is
stamped with the real time at runtime.

You can also poke the pipeline interactively with the ADK dev UI (it discovers
the module-level `root_agent` in `itaily_agents/pipeline.py`):

```bash
adk web         # or: adk run itaily_agents
```

## Wire the output into the app

From the **repo root**:

```bash
cp agents/out/work-products.json data/seed/work-products.json
npm run seed     # builds data/seed/seed.sql and applies it to local D1
```

`scripts/load-seed.mjs` consumes the JSON unchanged — the pipeline emits the same
shape the loader reads (verified end-to-end: `--dry-run` output loads with exit 0).
Note the **currently shipped** `data/seed/work-products.json` is a hand-authored
demo set (9 matters), not the output of this pipeline; a real run produces the
~4 `SEED_MATTERS` defined in `run_seed.py`. Decide whether to replace the demo
set wholesale, merge, or keep the generated set under a different file.

> Generated products are freshly produced and carry **no** `auditSeed` history
> (correct — no human has acted on them yet). If you overwrite a demo product
> that had seeded supervisor history, that history is not regenerated. Don't
> fabricate audit rows in the generator: an authentic, empty audit trail is the
> point of the hash chain.

## Output contract (must match `scripts/load-seed.mjs`)

Each work product:

```jsonc
{
  "id": "wp_...", "type": "draft|memo|opinion|risk_analysis",
  "title": "...", "summary": "...", "body": "... [1] [2] ...",
  "matterRef": "MAT-...", "matterName": "...",
  "agentName": "Itaily Research Agent", "status": "pending",
  "priority": 72, "confidence": 0.86,
  "model": "gemini-2.5-flash (ADK)", "createdAt": "2026-…Z",
  "trace": [ { "step": 1, "kind": "search|retrieve|reason|draft|cite|critique",
               "actorAgent": "research|drafter|splitter|grapher|analyzer|critic",
               "summary": "...", "detail": { } } ],
  "citations": [ { "marker": 1, "claim": "...", "celex": "32016R0679",
                   "eli": "http://data.europa.eu/eli/reg/2016/679/oj",
                   "title": "...", "sourceUrl": "https://eur-lex.europa.eu/…",
                   "snippet": "...", "locator": "Art. 6(1)(f)", "supportsClaim": true,
                   "verified": true, "verifyStatus": "verified", "verifiedAt": "2026-…Z" } ],
  "riskSignals": [ { "category": "hallucination|jurisdiction|missing_authority|conflict|deadline",
                     "severity": "low|med|high", "rationale": "...", "confidence": 0.9 } ],
  "claims": [ { "idx": 0, "text": "...", "charStart": 0, "charEnd": 42,
                "kind": "assertion|obligation|citation_ref|…", "assignedPreset": "standard_review",
                "citationMarkers": [1],
                "analysis": { "verdict": "supported|weak|unsupported|flag", "confidence": 0.8,
                              "summary": "...", "riskCategory": null, "riskSeverity": null,
                              "riskRationale": "", "figureTrace": null } } ],
  "edges": [ { "from": 1, "to": 0, "relation": "premise", "rationale": "...", "ordering": true } ]
}
```

`trace` entries are DERIVED from ADK `session.events`: tool calls become
`search`/`retrieve` steps, `cellar_fetch` results become `cite` steps, and each
agent's model turn becomes a `reason`/`draft`/`critique` step keyed by author
(all six sub-agents are mapped). `citations` carry `verified`/`verifyStatus`/
`verifiedAt`, folded back from the critic's per-CELEX re-checks. The top-level
`auditSeed[]` the loader also accepts is intentionally **not** emitted — see the
audit note above.

## Verified against the live stack

Sanity-checked end-to-end (2026-06, `google-adk` 2.3.0 on Python 3.12), so the
"verify against your version" caveats are settled for this combination:

- Imports resolve: `from google.adk.agents import LlmAgent, SequentialAgent`,
  `…runners import Runner`, `…sessions import InMemorySessionService`,
  `…models.lite_llm import LiteLlm`.
- `LlmAgent(model=, instruction=, tools=[plain_fn], output_key=)` and
  `SequentialAgent(sub_agents=[…])` accept these fields; plain functions are
  auto-wrapped as tools.
- `session_service.create_session(...)` / `get_session(...)` are **async** (we
  `await` them); `runner.run_async(user_id=, session_id=, new_message=)` yields
  `Event`s exposing `author`, `get_function_calls()`, `get_function_responses()`,
  `is_final_response()`, `content.parts[*].text`.
- CELLAR is live: `cellar_fetch` confirms `32016R0679` (200) and rejects a fake
  CELEX (404); `cellar_search` returns EU legislation (e.g. the AI Act for
  "artificial intelligence"). The only thing a real run still needs is a model
  API key — the ADK/CELLAR plumbing is exercised.

## Files

```
agents/
├── pyproject.toml              deps + `itaily-seed` entry point
├── .env.example                env var documentation
├── README.md                   this file
├── out/work-products.json      generated output (gitignored)
└── itaily_agents/
    ├── __init__.py
    ├── models.py               Gemini|Claude switch (one place)
    ├── tools.py                CELLAR search/fetch + CELEX helper
    ├── workgroups.py           per-claim preset auto-assignment (mirrors src/lib/workgroups.ts)
    ├── pipeline.py             research → drafter → splitter → grapher → analyzer → critic
    └── run_seed.py             entry point: run, capture events, emit JSON
```
