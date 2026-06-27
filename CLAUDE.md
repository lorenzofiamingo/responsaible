# Itaily respons[ai]ble

An AI legal-work **supervision console** for a global law firm. AI agents produce
work products (drafts, research memos, risk analyses); a supervising lawyer must
review, risk-triage, and sign them off **without manually reading everything**.

The app shows a risk-prioritised queue, then per item: an AI **agent trace**,
**citations** (verifiable against real EU law via the EU CELLAR / EUR-Lex API),
**confidence**, and structured **risk signals**. The lawyer takes a **supervisory
action** (approve / amend / reject / request rework / escalate / override — a written
reason is required for the serious ones), which appends to an insert-only,
**sha256 hash-chained audit trail** with a live `/api/audit/verify` tamper-evidence
endpoint. Domain is **EU law, in English**.

> "Itaily" is a fictitious company. The **Itaily Design System** (vendored at
> `itaily-design-system/`) is used **for visual identity only** — tokens, brand
> aesthetic, component look. Its "Italian-law copilot" product narrative is
> intentionally **not** adopted; this product is an EU-law supervision console.

Built for the Cambridge **Hack the Law** hackathon.

## Stack at a glance

- **SvelteKit** (Svelte 5, runes mode) on **Cloudflare Workers** via
  `@sveltejs/adapter-cloudflare`. The adapter is configured inside `vite.config.ts`
  (the `sveltekit({ adapter })` plugin option) — **there is no `svelte.config.js`**.
- **Tailwind v4** (`@tailwindcss/vite`) for layout utilities only. Colour, type, and
  elevation come from **Itaily CSS-variable tokens** (`src/lib/styles/itaily/`,
  imported in `src/app.css`) — the visual source of truth.
- **Cloudflare D1** (serverless SQLite) + **Drizzle ORM** for persistence;
  **Cloudflare KV** for caching CELLAR responses. Bindings `DB`, `KV` (see
  `wrangler.jsonc`). In `vite dev`, bindings are emulated via the adapter's
  platformProxy.
- **Node 24** is canonical (pinned via `mise.toml`); `.npmrc` sets
  `engine-strict=false` so Node 23.x also installs.
- Icons are vendored from `lucide-static` into `src/lib/icons/*.svg` and imported via
  Vite `?raw` (no build-on-install icon dependency).
- **Google ADK** (Python) runs **offline** to generate the seed work products and
  their agent trace into `data/seed/*.json`. The Cloudflare app never calls ADK at
  runtime.

## First-run setup

```sh
npm install
npm run db:migrate:local   # apply Drizzle migrations to local D1
npm run seed               # build data/seed/seed.sql from JSON, then load it
npm run dev                # Vite dev server with emulated D1/KV bindings
```

## Key commands

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server with emulated D1/KV. **Use this, not `wrangler dev`.** |
| `npm run build` | `vite build` |
| `npm run deploy` | `vite build && wrangler deploy` |
| `npm run db:generate` | `drizzle-kit generate` — generate migration SQL |
| `npm run db:migrate:local` / `db:migrate` | `wrangler d1 migrations apply` (local / remote) |
| `npm run seed` | build `seed.sql` from JSON via `scripts/load-seed.mjs`, then apply to local D1 |
| `npm run seed:remote` | build + apply seed to remote D1 |
| `npm run check` | `svelte-check` type/diagnostics |

> Migrations are applied with `wrangler d1 migrations apply` — **not**
> `drizzle-kit push`. drizzle-kit only *generates* SQL here.

## Ground rules

- **Run via `npm run dev`** so the D1/KV bindings are emulated. Run
  `db:migrate:local` + `seed` before the first dev run.
- **Node 24** (mise). Secrets are **server-only**; the app makes **no client-side
  AI/legal-API calls with secrets**.
- The **`supervisory_action` table is INSERT-ONLY** (no UPDATE / DELETE). That, plus
  the hash chain, is what makes the audit trail defensible. Never mutate audit rows.
- **Styling:** use Itaily CSS-variable tokens for colour/type/elevation; Tailwind only
  for layout. The design system is a **visual reference only**.
- **Pre-seed everything.** CELLAR / AI live calls are an *enhancement* with cached
  fallback — the demo must work fully from seeded data with no network.

## Documentation

- [`docs/PROBLEM.md`](docs/PROBLEM.md) — the challenge framing, the four asks, and how each is addressed.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — stack rationale, request flow, data model, the audit hash chain, CELLAR integration, the offline ADK pipeline, Cloudflare specifics.
- [`docs/TASKS.md`](docs/TASKS.md) — phased checklist (P0 done, P1 in progress, P2 stretch).
- [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md) — code conventions and the Itaily brand/visual rules.
