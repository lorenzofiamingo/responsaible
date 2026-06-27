# Architecture

## Overview

Itaily Oversight is a **SvelteKit app deployed as a single Cloudflare Worker**. It is
a thin, server-rendered console over a small relational model in **Cloudflare D1**
(serverless SQLite), accessed through **Drizzle ORM**. There are no client-side data
fetches with secrets and no runtime AI calls: the AI work products are produced
**offline** by a Google ADK pipeline and loaded as seed data, and the console's job is
to **supervise** them. The only outbound integration at runtime is **citation
verification against the EU CELLAR / EUR-Lex API**, cached in **Cloudflare KV**, and
layered as an optional enhancement over fully self-sufficient seed data.

```
                  offline (Python)                 runtime (Cloudflare Worker)
  Google ADK  ──▶  data/seed/*.json  ──▶  seed.sql  ──▶  D1  ◀──▶  SvelteKit (SSR + form actions)
  (Gemini/Claude)        ▲                  (scripts/        │                │
                         │                   load-seed.mjs)  │            CELLAR API
                  agent traces,                              │            (cached in KV)
                  citations, risks                       /api/audit/verify
```

## Stack rationale

- **SvelteKit on Cloudflare Workers.** Server `load` functions and form `actions` run
  at the edge with direct, low-latency access to D1 and KV bindings. A supervision
  console is read-heavy with discrete write actions — a perfect fit for SSR + form
  actions and progressive enhancement. The adapter is `@sveltejs/adapter-cloudflare`,
  configured **inside `vite.config.ts`** (`sveltekit({ adapter: adapter() })`); this
  newer SvelteKit has **no `svelte.config.js`**.
- **Svelte 5, runes mode forced.** `vite.config.ts` sets
  `compilerOptions.runes` true for all non-`node_modules` files, so the codebase is
  uniformly runes-based.
- **D1 + Drizzle.** D1 gives a real SQL database that lives inside the Worker platform
  (no connection pool, no separate host). Drizzle gives typed queries and a schema we
  can generate migrations from, while staying close to SQL.
- **KV for the CELLAR cache.** Citation resolution is read-mostly and highly
  cacheable; KV is the natural edge cache and keeps EUR-Lex out of the hot path.
- **Tailwind v4 for layout only; Itaily tokens for the look.** Colour, type, and
  elevation are CSS variables from the vendored Itaily design system, so the brand is
  the visual source of truth and Tailwind never dictates appearance. See
  [CONVENTIONS.md](CONVENTIONS.md).
- **Vendored Lucide SVGs.** Icons live in `src/lib/icons/*.svg` and are imported via
  Vite `?raw`, so there is no build-on-install icon dependency and icons are inlined.

## Request flow (Workers)

All data access happens **server-side** via the platform bindings. The pattern:

1. A request hits the Worker. `src/hooks.server.ts` sets
   `event.locals.actorEmail` — the supervising lawyer's identity. (Demo: a fixed
   address; in production this would come from SSO.)
2. A route's server `load` resolves a Drizzle client from the platform binding via
   `dbFrom(platform)` (`src/lib/server/db/client.ts`), which reads `platform.env.DB`
   and throws a clear error if the binding is missing.
3. Queries live in `src/lib/server/db/queries.ts` and return plain rows that are
   passed to the page as serializable data.

**Routes:**

| Route | Kind | Responsibility |
|---|---|---|
| `src/routes/+page.server.ts` / `+page.svelte` | load | The **review queue** — `getQueue()` plus per-item risk-signal counts and citation counts, and headline stats. |
| `src/routes/work-products/[id]/+page.server.ts` / `+page.svelte` | load + `act` action | The **detail view** (trace, citations, risk signals, audit) and the **supervisory action** form action. |
| `src/routes/api/audit/verify/+server.ts` | GET | Live **hash-chain verification** of the whole audit ledger. |
| `src/routes/api/cellar/verify/+server.ts` | POST | **Verify a work product's citations** against CELLAR and persist the verdicts. |
| `src/routes/+layout.server.ts` | load | Exposes `actorEmail` to the layout. |

**The `act` form action** (the one write path) does, in order: validate the action is
in the allow-list; require a written reason for the serious actions
(`REASON_REQUIRED` = reject / request_rework / escalate / override); confirm the work
product exists; compute the next audit hash over the previous tip
(`getLastHash` → `computeHash`); **insert** the new `supervisory_action` row; and
update the work product's `status`. The insert is append-only — existing audit rows are
never touched.

## Data model

Five Drizzle tables (`src/lib/server/db/schema.ts`). Client components import the
mirrored, server-free row shapes from `src/lib/types.ts` instead of the schema types,
so no server-only module leaks into the client bundle.

```
work_product 1───* agent_action       (the trace: search/retrieve/reason/draft/cite/critique)
             1───* citation           (celex / eli / verify_status — resolvable vs CELLAR)
             1───* risk_signal         (category, severity low/med/high, rationale, confidence)
             1───* supervisory_action  (INSERT-ONLY, hash-chained audit ledger)
```

- **`work_product`** — one AI deliverable. `type` (draft / memo / risk_analysis),
  `title`, `summary`, `body` (with inline `[n]` citation markers), matter ref/name,
  `agentName`, `status` (pending / approved / amended / rejected / rework / escalated),
  `priority` (higher = more urgent), `confidence` (0..1), `model`, `createdAt`.
  Indexed on `status` and `priority`.
- **`agent_action`** — one step of the trace: `step`, `kind`, `actorAgent`, `summary`,
  optional JSON `detail`. Indexed on `workProductId`.
- **`citation`** — `marker` (the inline `[n]`), `claim`, EU identifiers
  (`celex` canonical, `eli`, `sourceUrl`), `title`, `snippet`, `locator` (pinpoint,
  e.g. `Art. 6(1)(f)`), `supportsClaim`, and the verification fields `verified` /
  `verifyStatus` (unchecked / verified / unresolved) / `verifiedAt`.
- **`risk_signal`** — `category` (hallucination / jurisdiction / missing_authority /
  conflict / deadline), `severity` (low / med / high), `rationale`, `confidence`.
- **`supervisory_action`** — the audit ledger. `actorEmail`, `action` (approve / amend
  / reject / request_rework / escalate / override), `reason`, `prevHash`, `hash`,
  `createdAt`. **Insert-only — never UPDATE or DELETE.** Indexed on `workProductId`
  and `createdAt`.

## The audit hash chain

The `supervisory_action` ledger is what makes supervision **defensible**. It is
append-only and **tamper-evident** via a sha256 hash chain implemented in
`src/lib/server/audit.ts`.

Each row's hash is computed over the previous row's hash plus the row's own content:

```
hash = sha256( prevHash | workProductId | actorEmail | action | reason | createdAt )
```

The field order and the `|` separator are **load-bearing** (`auditInput()`). The first
("genesis") link uses `GENESIS_HASH` = 64 zeros. Because each link binds to the one
before it:

- **Altering** any field of a past row changes its hash, so the next row's `prevHash`
  no longer matches → detected as *altered content (hash mismatch)*.
- **Deleting or reordering** a row breaks the `prevHash` continuity → detected as
  *broken link (prevHash mismatch)*.

`verifyChain()` recomputes the entire chain oldest-first and returns
`{ ok, length, brokenAt, reason }`, naming the **index of the first failing row**.
The route `GET /api/audit/verify` runs this over the live ledger — a one-call,
real-time proof that the supervisory trail has not been tampered with.

**One continuous chain across seed and live actions.** The exact pre-image format in
`scripts/load-seed.mjs` mirrors `src/lib/server/audit.ts` byte-for-byte. The seed
loader collects every seeded audit action **globally**, sorts by `createdAt`, and
chains from genesis; live actions appended at runtime continue from the last tip
(`getLastHash`). Seeded history and live decisions therefore verify as a **single,
unbroken chain**. If you change the hash format, you **must** change it in both files.

## CELLAR citation verification

Each citation stores a **CELEX** number (the canonical EU document identifier), an
**ELI**, and a EUR-Lex source URL. The bonus feature resolves these against the live
**EU CELLAR** repository to confirm the cited act actually exists, and writes the
result back to `verify_status` (`verified` / `unresolved`), surfaced by
`VerifyBadge.svelte`. An unresolved citation is a **hallucination signal**.

Implementation (`src/lib/server/cellar.ts` + `POST /api/cellar/verify`):

- **`resolveCelex(celex, kv)`** GETs the public CELLAR resource resolver
  (`http://publications.europa.eu/resource/celex/<CELEX>`) and reads the HTTP status:
  `200` → **verified** (the act exists), `4xx` → **unresolved** (likely a
  hallucination), network error / `5xx` → **unchecked** (inconclusive — *never*
  penalise a citation for a flaky network). CELLAR is public, so **no auth/key** is
  needed; the request carries a descriptive User-Agent and a 12s timeout.
- **`POST /api/cellar/verify`** takes `{ workProductId }`, resolves each citation's
  CELEX **sequentially** (low concurrency, to respect CELLAR), **persists** the verdict
  back to the `citation` row (`verifyStatus`, `verified`, `verifiedAt`), and returns
  per-citation results plus a summary.

Design constraints:

- **Server-only.** Verification runs in the Worker, never the client, so no upstream
  URLs or future keys leak into the browser bundle.
- **Cached in KV.** Verdicts are cached in Cloudflare KV (key `cellar:celex:<CELEX>`,
  24h TTL). CELLAR documents are immutable per CELEX, so caching is aggressive;
  inconclusive (5xx / network) results are deliberately not cached.
- **Enhancement with fallback.** Seed citations already ship with `verify_status`, so
  the console is fully usable offline; live verification only upgrades the state.

> Status: the CELLAR client, KV caching, and the `/api/cellar/verify` endpoint are
> implemented. The remaining P1 item is the detail-view UI that triggers verification
> on demand — see [TASKS.md](TASKS.md).

## The offline ADK pipeline

The realistic work products, their agent traces, citations, and risk signals are
**not** generated at runtime. A **Google ADK** (Python) pipeline in `agents/` runs
**offline** to produce them as JSON, which is copied into
`data/seed/work-products.json` and loaded by `scripts/load-seed.mjs`. Keeping authoring
(JSON) separate from loading (SQL) means the pipeline can emit the same JSON shape and
reuse the loader unchanged.

The pipeline (`agents/itaily_agents/`) is a three-agent `SequentialAgent`
(`pipeline.py`) that shares one session/state, so each agent sees the previous one's
output and the whole run produces **one event stream** captured as the transparency
trace:

1. **research** — finds and *verifies* the governing EU authorities. It has CELLAR
   tools (`tools.py`): `cellar_search` (SPARQL over the CELLAR endpoint, English-only),
   `cellar_fetch` (REST resolve a CELEX to confirm it exists), and `celex_from_cite`
   (pure helper turning a "year/number" cite into a CELEX). It must not cite anything
   `cellar_fetch` reports as not resolving.
2. **drafter** — writes the work product with inline `[n]` citation markers, grounding
   every claim in a verified authority.
3. **critic** — adversarially re-checks every cited CELEX with `cellar_fetch` (a
   non-resolving CELEX → a high-severity `hallucination` risk), checks marker support,
   and emits the `risk_signal`s and overall `confidence`. This is the offline mirror of
   the runtime CELLAR verification.

The model is abstracted behind `models.py` (`get_model()`): **Gemini by default**, or
**Claude via ADK's LiteLLM wrapper** by setting `ITAILY_MODEL_PROVIDER=claude` — the
only line to change to swap models. The chosen model is stamped onto each work
product's `model` field (e.g. `gemini-2.5 (ADK)`). The package is a standard
`pyproject.toml` project (`google-adk`, `litellm`, `httpx`); the `itaily-seed` runner
that drives the pipeline and emits the JSON from the ADK event stream is the one
remaining piece (see [TASKS.md](TASKS.md)).

The Cloudflare app **never calls ADK at runtime** — this keeps the demo deterministic,
fast, offline-capable, and free of model latency or cost in the review loop.

## Seed pipeline (JSON → SQL → D1)

`scripts/load-seed.mjs` reads `data/seed/work-products.json` and emits
`data/seed/seed.sql`: an idempotent reset (deletes children-first) followed by INSERTs
for work products, trace actions, citations, risk signals, and the **chained**
supervisory actions (computed exactly as the runtime does). `npm run seed` builds the
SQL then applies it to local D1 with `wrangler d1 execute --local --file`.

## Cloudflare D1 / KV specifics

- **Bindings** (`wrangler.jsonc`): `DB` (D1, database `itaily_oversight`) and `KV`.
  The `database_id` and KV `id` are placeholders — replace with real ids from
  `wrangler d1 create` / `wrangler kv namespace create` before deploying.
- **Local dev emulates bindings.** `npm run dev` (Vite) uses the adapter's
  platformProxy to emulate `DB`/`KV` from `wrangler.jsonc`, so `platform.env.DB`
  works without a real Cloudflare connection. **Use `npm run dev`, not `wrangler dev`.**
- **Migrations are applied by Wrangler, not Drizzle.** `drizzle-kit` only **generates**
  migration SQL (`drizzle.config.ts`, dialect sqlite, output `drizzle/`); migrations
  are **applied** with `wrangler d1 migrations apply` (local/remote). Never run
  `drizzle-kit push` — it would fight Wrangler over the same database.
- **`nodejs_als` compatibility flag** is enabled and `observability` is on.

## The "Itaily visual-only" decision

The vendored `itaily-design-system/` describes a consumer "Italian-law copilot"
product. We deliberately adopt **only its visual identity** — design tokens (colour,
type, elevation, motion), the brand aesthetic, and component *look* — and **not** its
product narrative. Itaily Oversight is an **EU-law supervision console**, not an
Italian-law copilot. Concretely: we reuse the tokens (`src/lib/styles/itaily/`) and
recreate the brand's component look in `src/lib/components/`, but the UI copy, domain
(EU law, English), and information architecture are the supervision product's own. See
[CONVENTIONS.md](CONVENTIONS.md) for the brand rules we follow.
