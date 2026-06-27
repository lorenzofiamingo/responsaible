# Itaily — Design System

> **Itaily** is an AI legal copilot for Italian law. Ask a question in plain language; get an answer **grounded in primary sources** — the Codice Civile, Codice Penale, decrees, and case law — with inline, verifiable citations. Built as a project company for the **Hack the Law** competition at Cambridge.

The name is the whole idea: the wordmark reads **it · [ai] · ly** — *AI*, bracketed and terracotta, sitting inside *Italy*. The brackets nod simultaneously to code and to legal citation. The product makes Italian law **legible, cited, and trustworthy**.

This repository is the brand's design system: brand assets, design tokens (color, type, spacing, effects), reusable React UI primitives, and full-screen UI-kit recreations of the product surfaces.

---

## Sources provided

| Source | What it was |
|---|---|
| `uploads/itaily-logo.svg` | The Itaily wordmark. Space Grotesk, with custom-tuned vectors. Two colors: `rgb(65,65,65)` ink-gray + `rgb(232,103,65)` terracotta. |

No codebase, Figma file, deck, or product screenshots were provided — only the logo. The brand voice, palette, type system, components, and UI kits in this system are an **interpretation extrapolated from the logo and the product concept**, not a recreation of an existing product. See **Caveats** in the conversation for what to confirm.

---

## Content fundamentals

**Voice — calm, exact, never breathless.** Itaily is a legal tool; it earns trust by being precise and by always showing its work. Copy is plain and declarative. It explains the law, then cites it.

- **Casing:** Sentence case everywhere — UI labels, buttons, headings. The wordmark itself is lowercase (`itaily`). Reserve ALL-CAPS only for the mono eyebrow/overline device (tracked out).
- **Person:** Address the user as **you**; the product refers to itself as **Itaily** (third person) or **we** in marketing. Never "I".
- **Tone:** Confident but humble about limits. Every answer carries an explicit **confidence level** — Itaily never feigns certainty. Pair claims with citations; pair uncertainty with a flag.
- **Bilingual texture:** UI chrome is English (Cambridge competition, international audience). Legal *content* — article text, citations — stays in Italian, in guillemets `«…»`, set in the serif. Citations use Italian legal shorthand: `Art. 2043 c.c.`, `D.Lgs. 196/2003`, `Cass. civ. 12477/2019`.
- **No emoji.** Status and emphasis come from badges, the confidence meter, and the terracotta accent — never emoji.
- **Numbers & references** are set in mono (Space Mono) so they read as precise, machine-verifiable facts.

**Example copy**
- Hero: *"Italian law, decoded."* / *"Ask. Cite. Comply."*
- Empty state: *"Ask Itaily anything about Italian law. Every answer comes with its sources."*
- Caution line: *"This is informational, not legal advice. Always verify against the official Gazzetta Ufficiale."*

---

## Visual foundations

**Palette — warm, earthy, Italian.** The accent is **terracotta `#E86741`** (straight from the `[ai]`). Neutrals are intentionally *warm* greys on a **warm paper** ground (`#FAF8F4`), not cold blue-greys — the system should feel like good paper and sun-baked brick, not a sterile SaaS dashboard. Ink is a warm near-black `#2A2724`; the logo's `#414141` lives on as `--neutral-700`. Status colors are muted and warm (terracotta-leaning red, ochre amber, sage green, a single restrained blue for reference links). **Avoid** blue/purple gradients entirely — they're off-brand.

**Type.** Three roles, one mono:
- **Space Grotesk** — brand + headings + buttons. Tight tracking (`-0.02em`), semibold. It *is* the logo, so it carries the brand into every title.
- **Hanken Grotesk** — body & UI text. Humanist, highly legible at small sizes.
- **Newsreader** (serif, italic) — quoted legal text, article excerpts, pull-quotes. Adds editorial gravitas and visually separates *the law* from *the interface*.
- **Space Mono** — citations, references, dates, the uppercase eyebrow device.

**Backgrounds.** Flat warm color — paper `#FAF8F4` for pages, white for cards, warm ink for inverse sections. **No** photographic hero washes, no mesh gradients, no noise/grain by default. Visual interest comes from the terracotta accent, the serif/mono contrast, and generous whitespace. A subtle left **terracotta border-accent (3px)** marks primary-source panels — this is intentional and brand-specific (it's a "this is the law" marker), distinct from generic accent-border cards.

**Corner radii.** Soft, not pill-everything: `4–10px` for controls and chips, `16px` (`--radius-lg`) for cards, `24px` for large panels. Full pills (`--radius-pill`) only for switches and the occasional tag.

**Borders.** `1.5px` default — slightly heavier than a hairline, to echo the chunky wordmark. `--border-default` on cards/inputs; `--border-strong` for emphasis.

**Shadows.** Warm-tinted (rgba of the ink `42,39,36`), soft and low. Four steps `xs → lg`. Cards rest at `sm`; hover lifts to `md` with a `-2px` translate. Never harsh black drop-shadows.

**Motion.** Restrained and quick. `--ease-out` (`cubic-bezier(.22,1,.36,1)`) for entrances; `120–200ms` for most transitions. No bounces, no spring overshoot, no infinite decorative loops. Answers may *stream* in (typewriter/fade) since that's a real product behavior, but chrome animation is minimal.

**States.**
- *Hover:* surfaces go to `--surface-hover` (warm `#F6F3EE`); primary buttons darken to `--color-accent-hover`; cards lift.
- *Press:* buttons translate down `1px` (a small physical "press"), no color flash.
- *Focus:* terracotta ring — `--shadow-focus` (`0 0 0 3px rgba(232,103,65,.28)`) — on inputs and interactive elements. Always visible; accessibility matters in legal tooling.

**Transparency / blur.** Used sparingly — a translucent ink scrim behind modals/dialogs, optional `backdrop-blur` on a sticky app header. Not a decorative motif.

**Imagery vibe.** If photography is used, it skews **warm and architectural** — Italian courts, colonnades, paper, light — never cold corporate stock. Default to *no* imagery; let type and color carry it.

**Cards** = white surface, `1.5px` `--border-default`, `--radius-lg` (16px), `--shadow-sm`, `--space-5` padding. Source cards add the 3px terracotta left border.

---

## Iconography

Itaily uses **[Lucide](https://lucide.dev)** — 2px stroke, rounded caps and joins. Its friendly, even-weight geometry matches the chunky wordmark and the warm tone. *(Substitution flag: no icon set was provided with the brand, so Lucide was chosen as the house set. Swap freely if the team prefers another — keep a single consistent stroke set.)*

- **Delivery:** Lucide UMD from CDN (`https://unpkg.com/lucide@latest/dist/umd/lucide.min.js`). The `Icon` component reads the global `lucide` registry and renders an inline `<svg>` by kebab-case name.
- **Common icons:** `scale`, `gavel` (n/a in Lucide → use `scale`), `file-text`, `search`, `sparkles`, `send`, `book-open`, `shield-check`, `quote`, `copy`, `thumbs-up`, `chevron-right`.
- **No emoji**, no unicode-glyph icons. Legal references are typographic (mono), not iconographic.
- The **`[ai]` mark** (`assets/logo/itaily-mark.svg`) is the app icon / favicon — terracotta brackets in a white rounded square.

---

## Index / manifest

**Root**
- `styles.css` — the single entry point consumers link. `@import`s only.
- `readme.md` — this file.
- `SKILL.md` — Agent-Skills-compatible front matter for use in Claude Code.

**Tokens** (`tokens/`)
- `fonts.css` — Google Fonts `@import` (Space Grotesk, Hanken Grotesk, Newsreader, Space Mono).
- `colors.css` — terracotta + warm-neutral scales, status, semantic aliases.
- `typography.css` — families, scale, weights, line-height, tracking.
- `spacing.css` — spacing, radii, borders, shadows, motion, layout.
- `base.css` — resets + the `.itaily-eyebrow` device.

**Brand assets** (`assets/logo/`)
- `itaily-logo.svg` — primary, on light.
- `itaily-logo-light.svg` — paper + terracotta, on dark/accent.
- `itaily-logo-ink.svg` — single-color ink (stamps, watermarks).
- `itaily-mark.svg` — the `[ai]` mark / app icon.

**Components** (`components/`)
- `core/` — `Button`, `IconButton`, `Icon`, `Badge`, `Card`, `Avatar`
- `forms/` — `Input`, `Switch`
- `legal/` — `Citation`, `SourceCard`, `ConfidenceMeter` *(brand-specific signatures)*

**Foundation cards** (`guidelines/`) — specimen cards shown in the Design System tab (Colors, Type, Spacing, Brand).

**UI kits** (`ui_kits/`)
- `app/` — the legal-AI assistant workspace (login → ask → cited answer with sources rail).
- `web/` — the marketing / pitch landing site.

*(The Design System tab renders every `@dsCard`-tagged HTML. `_ds_bundle.js`, `_ds_manifest.json`, `_adherence.oxlintrc.json` are generated — do not edit.)*
