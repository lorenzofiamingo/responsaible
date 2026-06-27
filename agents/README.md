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
matter prompt ──► [ research ─► drafter ─► critic ]  (one ADK SequentialAgent)
                         │ CELLAR tools   │            │ re-verify CELEX
                         ▼                ▼            ▼
                  session.events  ──►  transform  ──►  work-products.json
                                                          │
                              human copies into the app ──┘  ──► npm run seed
```

## What the agents do

| Agent      | Role | Tools |
|------------|------|-------|
| `research` | Find the controlling EU instruments; confirm each CELEX resolves. | `cellar_search`, `cellar_fetch`, `celex_from_cite` |
| `drafter`  | Write the draft/memo/risk_analysis with `[1] [2]` citation markers. | — |
| `critic`   | Re-verify every cited CELEX, flag hallucination / missing-authority / jurisdiction / deadline risks, set a confidence. | `cellar_fetch` |

Grounding is against the public **EU CELLAR** API (no auth): a SPARQL endpoint
for search and a REST-by-CELEX endpoint to confirm an act actually exists. The
tools are in `itaily_agents/tools.py` and are usable standalone.

## Setup

Requires Python **3.11+**.

```bash
cd agents
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -e .                   # installs google-adk, litellm, httpx, dotenv
```

Configure credentials:

```bash
cp .env.example .env
# edit .env — set ITAILY_MODEL_PROVIDER and the matching API key(s)
```

## Choosing the model

One env var switches the model for all three agents (see `itaily_agents/models.py`):

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
# Offline smoke test — no keys, no network, emits deterministic fixtures.
python -m itaily_agents.run_seed --dry-run

# Real run — drives the ADK pipeline over the seed matters.
python -m itaily_agents.run_seed
```

Output is written to `agents/out/work-products.json`. A partial failure (one
matter erroring) still writes everything that succeeded. `createdAt` is stamped
with the real time at runtime.

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
shape the shipped seed file uses, so the loader doesn't need to know ADK exists.

## Output contract (must match `scripts/load-seed.mjs`)

Each work product:

```jsonc
{
  "id": "wp_...", "type": "draft|memo|risk_analysis",
  "title": "...", "summary": "...", "body": "... [1] [2] ...",
  "matterRef": "MAT-...", "matterName": "...",
  "agentName": "Itaily Research Agent", "status": "pending",
  "priority": 72, "confidence": 0.86,
  "model": "gemini-2.5 (ADK)", "createdAt": "2026-…Z",
  "trace": [ { "step": 1, "kind": "search|retrieve|reason|draft|cite|critique",
               "actorAgent": "research|drafter|critic",
               "summary": "...", "detail": { } } ],
  "citations": [ { "marker": 1, "claim": "...", "celex": "32016R0679",
                   "eli": "http://data.europa.eu/eli/reg/2016/679/oj",
                   "title": "...", "sourceUrl": "https://eur-lex.europa.eu/…",
                   "snippet": "...", "locator": "Art. 6(1)(f)",
                   "supportsClaim": true } ],
  "riskSignals": [ { "category": "hallucination|jurisdiction|missing_authority|conflict|deadline",
                     "severity": "low|med|high", "rationale": "...", "confidence": 0.9 } ]
}
```

`trace` entries are DERIVED from ADK `session.events`: tool calls become
`search`/`retrieve` steps, `cellar_fetch` results become `cite` steps, and each
agent's model turn becomes a `reason`/`draft`/`critique` step keyed by author.
The loader also reads optional citation fields (`verified`, `verifyStatus`,
`verifiedAt`) and an optional top-level `auditSeed[]` — this generator leaves
those out (they default sensibly); add them later if you want seeded supervisor
history.

## ADK API points to verify against your installed version

ADK's Python API has moved between 1.x and 2.x. This skeleton targets the widely
documented 1.x surface. If an import or call fails, check these against your
installed `google-adk`:

- `from google.adk.agents import LlmAgent, SequentialAgent`
- `from google.adk.runners import Runner`
- `from google.adk.sessions import InMemorySessionService`
- `from google.adk.models.lite_llm import LiteLlm`  (Claude path)
- `LlmAgent(..., output_key="...")` to persist a sub-agent reply into state.
- Plain functions in `tools=[...]` are auto-wrapped as `FunctionTool`.
- `await session_service.create_session(app_name=, user_id=, session_id=)` and
  `await session_service.get_session(...)` — these are **async** in current ADK
  (older builds were sync; drop the `await` if you see "coroutine never awaited").
- `runner.run_async(user_id=, session_id=, new_message=Content(...))` yields
  events; we read `event.author`, `event.get_function_calls()`,
  `event.get_function_responses()`, `event.content.parts[*].text`,
  `event.is_final_response()`.
- CELLAR SPARQL schema (`cdm:` predicates in `tools.py`) — confirm the title and
  CELEX predicates return rows for a known topic the first time you run it.

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
    ├── pipeline.py             research → drafter → critic SequentialAgent
    └── run_seed.py             entry point: run, capture events, emit JSON
```
