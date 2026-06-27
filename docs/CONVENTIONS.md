# Conventions

Two halves: **code conventions** (how the app is built) and **Itaily brand / visual
rules** (how it looks and reads). The brand rules are distilled from the vendored
design system (`itaily-design-system/project/SKILL.md` and `readme.md`) and applied
**for visual identity only** — see the note at the end.

---

## Code conventions

### Svelte 5, runes mode

- Runes mode is **forced** for the whole project (`vite.config.ts` sets
  `compilerOptions.runes` true for everything outside `node_modules`). Use the runes
  API — `$state`, `$derived`, `$props`, `$effect` — not the legacy
  `export let` / reactive-`$:` style.
- Components are `.svelte` files in `src/lib/components/`.

### TypeScript & module boundaries

- The project is TypeScript throughout. Run `npm run check` (svelte-check) for
  type/diagnostics.
- **`$lib/server` is server-only.** Anything under `src/lib/server/` (the Drizzle
  client, queries, schema, `audit.ts`) must never be imported into client code —
  SvelteKit enforces this, and it keeps D1/KV access and any future secrets out of the
  browser bundle.
- **Client components import client-safe types from `src/lib/types.ts`**, which
  mirrors the Drizzle row shapes, rather than importing the server `schema.ts` types.
  This prevents a server-only module from leaking into the client graph.
- **Presentation maps live in `src/lib/format.ts`** — enum value → human label, Lucide
  icon name, and Badge `Tone`. Keep label/icon/tone decisions here so the queue and
  detail views never drift apart. `REASON_REQUIRED` (the set of actions needing a
  written reason) also lives here and is the single source of truth for both the UI and
  the server `act` action.

### Data access

- All DB access is server-side, through Drizzle. Resolve the client with
  `dbFrom(platform)` (`src/lib/server/db/client.ts`); query functions live in
  `src/lib/server/db/queries.ts`. Don't open raw D1 queries in routes.

### File layout

```
src/routes/                 # SvelteKit routes (+page.svelte / +page.server.ts / +server.ts)
src/lib/components/         # Itaily primitives + supervision components
src/lib/server/            # SERVER-ONLY: db/ (client, queries, schema), audit.ts
src/lib/styles/itaily/     # vendored design tokens (do not edit by hand)
src/lib/icons/             # vendored Lucide SVGs, imported via ?raw
src/lib/types.ts           # client-safe row shapes
src/lib/format.ts          # presentation maps (label / icon / tone)
```

### The audit invariant

- **`supervisory_action` is INSERT-ONLY.** Never write an UPDATE or DELETE against it.
  Appending the only allowed mutation is what makes the trail defensible.
- The hash pre-image format is defined **identically** in `src/lib/server/audit.ts`
  and `scripts/load-seed.mjs`. If you ever change the fields, order, or separator, you
  **must** change both, or the chain breaks.

### Migrations & seed

- Generate migrations with `npm run db:generate` (drizzle-kit). **Apply** them with
  `wrangler d1 migrations apply` (`db:migrate:local` / `db:migrate`) — **never**
  `drizzle-kit push`.
- Author seed content in `data/seed/work-products.json`; `seed.sql` is **generated** —
  do not hand-edit it.

### Dev workflow

- Run with **`npm run dev`** (Vite emulates the D1/KV bindings), not `wrangler dev`.
- Node **24** (mise). Secrets, if any, are server-only.

---

## Itaily brand / visual rules

These are applied **for visual identity only**; we use the look and tokens, not the
design system's Italian-law product narrative (this product is an EU-law supervision
console in English).

### Source of truth: tokens, not Tailwind

- **Colour, type, and elevation come from Itaily CSS-variable tokens**
  (`src/lib/styles/itaily/`, imported in `src/app.css` before Tailwind). **Tailwind v4
  is for layout utilities only** — flex, grid, spacing, sizing — never for colour or
  typography. Itaily's `base.css` is unlayered, so it wins over Tailwind's reset
  regardless of import order.

### Voice & casing

- **Sentence case** everywhere in UI — labels, buttons, headings.
- The **wordmark is lowercase** (`itaily`).
- **ALL-CAPS only** for the tracked, mono **eyebrow / overline** device.
- Calm, exact, declarative copy. Address the user as **you**. **No emoji** anywhere —
  status and emphasis come from badges, the confidence meter, and the terracotta
  accent.

### Type roles

- **Space Grotesk** — brand, headings, buttons (tight tracking, semibold).
- **Hanken Grotesk** — body and UI text.
- **Newsreader** (serif, italic) — **quoted legal excerpts** / source text, to
  visually separate *the law* from *the interface*.
- **Space Mono** — **identifiers and references**: CELEX numbers, citations, dates, the
  uppercase eyebrow. Mono signals "precise, machine-verifiable".

### Colour & surfaces

- **Terracotta `#E86741`** is the single accent, on **warm paper `#FAF8F4`** with warm
  near-black ink. Status colours are muted and warm.
- **Avoid blue/purple gradients entirely** — off-brand. Backgrounds are flat and warm;
  no photographic washes, mesh gradients, or noise by default.

### Shape, border, elevation

- **1.5px borders** by default (heavier than a hairline, to echo the chunky wordmark).
- **16px card radius** (`--radius-lg`); 4–10px for controls/chips; 24px for large
  panels; full pills only for switches/tags.
- **Warm, soft, low shadows** (rgba of the ink), never harsh black drop-shadows. Cards
  rest at `sm`, lift on hover.
- **Terracotta focus ring** (`--shadow-focus`) on interactive elements — always
  visible; accessibility matters in legal tooling.
- Motion is restrained: `120–200ms`, ease-out; no bounce or infinite loops.

### Brand signatures (the legal-trust markers)

- **3px terracotta left border** marks **primary-source / decision panels** — the
  "this is the law" / "this is a recorded decision" marker. Use it for source cards and
  authoritative panels; it is distinct from a generic accent-border card.
- **Confidence + citations on every AI output.** Never present an AI claim without a
  confidence level and verifiable citations. Pair uncertainty with a flag — the product
  never feigns certainty.
- Legal **excerpts** are quoted, in the **serif**; **citations / identifiers** are in
  **mono**. Icons are Lucide (2px rounded stroke), vendored as SVG — never emoji or
  unicode glyphs for status.

> **Domain note.** The design system's examples are in Italian (`Art. 2043 c.c.`, set
> in guillemets). Here the domain is **EU law in English**, so excerpts and citations
> are English EU-law references (CELEX, `Art. 6(1)(f)`, etc.) — but the *typographic
> treatment* (serif for excerpts, mono for identifiers, confidence + citations always
> shown) is followed exactly.
