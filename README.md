# Itaily Oversight

> An AI legal-work **supervision console** for a global law firm. AI agents produce
> work products; a supervising lawyer reviews, risk-triages, and signs them off —
> without manually reading everything. Domain: **EU law, in English.**
>
> Built for the Cambridge **Hack the Law** hackathon.

AI agents already draft memos, run legal research, and produce risk analyses faster
than any human can read them. The bottleneck — and the accountability gap — is
**supervision**. Itaily Oversight is the console a supervising lawyer uses to stay
accountable at scale:

1. **Triage** — a queue sorted by risk and confidence surfaces the riskiest work first.
2. **Understand** — each item exposes the AI **agent trace** (what each sub-agent did,
   step by step), its **citations**, **confidence**, and structured **risk signals**.
3. **Verify** — citations resolve against **real EU law** via the EU CELLAR / EUR-Lex
   API, so a fabricated authority can be caught (hallucination detection).
4. **Act & account** — the lawyer approves / amends / rejects / requests rework /
   escalates / overrides (a written reason is required for the serious ones). Every
   action appends to an **insert-only, sha256 hash-chained audit trail**, with a live
   `/api/audit/verify` endpoint that re-computes the chain to prove it is
   tamper-evident.

> **About the name.** "Itaily" is a fictitious company. The vendored **Itaily Design
> System** (`itaily-design-system/`) supplies the *visual identity only* — tokens,
> brand aesthetic, component look. Its "Italian-law copilot" product story is
> intentionally **not** adopted; this is an EU-law supervision console.

## Quick start

```sh
npm install
npm run db:migrate:local   # apply Drizzle migrations to local Cloudflare D1
npm run seed               # build seed SQL from JSON and load it into local D1
npm run dev                # Vite dev server with emulated D1/KV bindings
```

Open the printed local URL. The home page is the **review queue**; click any item
for the detail view (trace, citations, risk signals, supervisory actions). The audit
chain can be checked live at `/api/audit/verify`.

> Use `npm run dev` (Vite), **not** `wrangler dev` — the Cloudflare adapter emulates
> the `DB` and `KV` bindings in the Vite dev server.

## Stack

| Layer | Choice |
|---|---|
| Framework | **SvelteKit**, Svelte 5 (runes mode) |
| Runtime | **Cloudflare Workers** (`@sveltejs/adapter-cloudflare`, configured in `vite.config.ts`) |
| Database | **Cloudflare D1** (serverless SQLite) + **Drizzle ORM** |
| Cache | **Cloudflare KV** (for CELLAR citation-resolution responses) |
| Styling | **Itaily CSS-variable tokens** (source of truth) + **Tailwind v4** (layout utilities only) |
| Icons | Vendored Lucide SVGs in `src/lib/icons`, imported via Vite `?raw` |
| Offline content | **Google ADK** (Python) generates seed work products + agent traces into `data/seed/*.json` |
| Node | **24** (pinned via `mise.toml`) |

There is **no `svelte.config.js`** — this SvelteKit configures the Cloudflare adapter
inside `vite.config.ts` via the `sveltekit({ adapter })` plugin option.

## Project layout

```
src/
  app.css                  # imports Itaily tokens, then Tailwind
  hooks.server.ts          # sets locals.actorEmail (demo supervisor identity)
  routes/
    +page.svelte / .ts     # the risk-prioritised review queue
    work-products/[id]/    # detail view + `act` form action (supervisory actions)
    api/audit/verify/      # live hash-chain verification endpoint
    api/cellar/verify/     # verify a work product's citations vs CELLAR (P1 bonus)
  lib/
    components/            # Itaily primitives + supervision components
    server/                # server-only: db/, audit.ts (hash chain), cellar.ts (CELLAR)
    styles/itaily/         # vendored Itaily design tokens
    icons/                 # vendored Lucide SVGs
    types.ts               # client-safe row shapes
    format.ts              # enum -> label / icon / tone presentation maps
data/seed/                 # work-products.json (authoring) + generated seed.sql
scripts/load-seed.mjs      # JSON -> seed.sql, computes the seeded audit chain
agents/                    # offline Google ADK pipeline (research -> drafter -> critic)
drizzle/                   # generated migration SQL + meta
itaily-design-system/      # vendored brand/design system (visual reference only)
```

## Documentation

- [`docs/PROBLEM.md`](docs/PROBLEM.md) — challenge framing and how each ask is addressed.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — design, request flow, audit chain, CELLAR, ADK pipeline.
- [`docs/TASKS.md`](docs/TASKS.md) — phased build checklist (P0 / P1 / P2).
- [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md) — code conventions and Itaily brand/visual rules.
- [`CLAUDE.md`](CLAUDE.md) — concise project entry point for AI sessions.
