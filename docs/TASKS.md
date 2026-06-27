# Tasks

A phased checklist. **P0** is the demonstrable core (done). **P1** is the chosen bonus
(in progress). **P2** is stretch / production hardening.

## P0 — Core supervision console (done)

The end-to-end supervision loop, fully working from seed data with no network.

- [x] **Project scaffold** — SvelteKit (Svelte 5, runes), Cloudflare adapter in
  `vite.config.ts`, Tailwind v4 + Itaily tokens wired in `src/app.css`, Node 24 via
  `mise.toml`.
- [x] **Data model** — five Drizzle tables (`work_product`, `agent_action`,
  `citation`, `risk_signal`, `supervisory_action`) in `schema.ts`; client-safe row
  types mirrored in `src/lib/types.ts`.
- [x] **Migrations** — generated into `drizzle/`; applied with
  `wrangler d1 migrations apply` (`db:migrate:local` / `db:migrate`).
- [x] **Seed pipeline** — `data/seed/work-products.json` (8 realistic EU-law work
  products) → `scripts/load-seed.mjs` → `seed.sql` → local D1 (`npm run seed`).
- [x] **Review queue** — risk-prioritised ordering (priority desc, then confidence
  asc), per-item risk-signal + citation counts, headline stats
  (`+page.server.ts` / `+page.svelte`).
- [x] **Detail view** — agent **trace** timeline, **citations** with locators and
  snippets, **risk signals**, **confidence** meter, and the audit trail
  (`work-products/[id]/`).
- [x] **Supervisory actions** — `act` form action: approve / amend / reject /
  request_rework / escalate / override, with **required reason** for the serious ones
  (`REASON_REQUIRED`); updates work-product status.
- [x] **Insert-only hash-chained audit ledger** — `src/lib/server/audit.ts`; the
  seed loader chains seeded history with the **same** canonical format so seed + live
  form one chain.
- [x] **Live tamper-evidence endpoint** — `GET /api/audit/verify` recomputes the chain
  and reports `{ ok, length, brokenAt, reason }`.
- [x] **Itaily visual layer** — brand primitives and supervision components in
  `src/lib/components/` (Button, Card, Badge, ConfidenceMeter, SourceCard,
  TraceTimeline, RiskSignalPanel, SupervisoryActions, AuditTrail, VerifyBadge, …);
  vendored Lucide icons via `?raw`.

## P1 — Citation verification vs CELLAR (in progress) — the bonus

Detect hallucinated authorities by resolving each citation's CELEX against the live EU
CELLAR / EUR-Lex API.

- [x] **Schema + UI support** — `citation.verify_status` (unchecked / verified /
  unresolved), `verified`, `verifiedAt`; `VerifyBadge.svelte` renders the state;
  seed citations carry CELEX / ELI / source URL.
- [x] **`src/lib/server/cellar.ts`** — server-only client. `resolveCelex()` GETs the
  public CELLAR resource resolver for a CELEX and reads the HTTP status: 200 →
  `verified`, 4xx → `unresolved`, network/5xx → `unchecked` (never penalise). No
  auth/key required. Includes a `buildCelex()` helper.
- [x] **KV caching** — `resolveCelex` caches verdicts in the `KV` binding (keyed
  `cellar:celex:<CELEX>`, 24h TTL); CELLAR docs are immutable per CELEX so caching is
  aggressive. Inconclusive (5xx/network) results are not cached.
- [x] **`/api/cellar/verify` endpoint** — `POST` with `{ workProductId }`: resolves
  each citation's CELEX sequentially (low concurrency), **persists** `verify_status` /
  `verified` / `verifiedAt` back to the `citation` rows, and returns per-citation
  verdicts plus a summary.
- [ ] **Detail-view wiring** — trigger verification from the citation panel and reflect
  the updated badges (the `VerifyBadge` component and the endpoint exist; the on-demand
  trigger UI is the remaining piece).

## P2 — Stretch / production hardening

- [ ] **Deploy to Cloudflare Workers** — create real D1 + KV (`wrangler d1 create`,
  `wrangler kv namespace create`), replace the placeholder ids in `wrangler.jsonc`,
  run `db:migrate` + `seed:remote`, then `npm run deploy`.
- [~] **Live ADK re-run** — the offline Google ADK pipeline exists in `agents/`
  (`itaily_agents/`: `pipeline.py` research → drafter → critic `SequentialAgent`,
  `tools.py` CELLAR search/fetch/CELEX tools, `models.py` Gemini-default /
  Claude-via-LiteLLM switch). Remaining: a `run_seed.py` runner to drive the pipeline
  and emit `data/seed/*.json` from the captured ADK event stream.
- [ ] **Firm-standards comparison** — check each work product against firm
  house-style / policy and surface deviations as additional risk signals.
- [ ] **Real supervisor identity** — replace the fixed `locals.actorEmail` in
  `hooks.server.ts` with SSO-backed auth.
- [ ] **Richer triage** — filters, search, and grouping over the queue; per-category
  risk drill-down.
