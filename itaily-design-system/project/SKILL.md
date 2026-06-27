---
name: itaily-design
description: Use this skill to generate well-branded interfaces and assets for Itaily (an AI legal copilot for Italian law), either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.
If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.
If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

## Quick orientation
- **Brand:** Itaily — "Italian law, decoded." Warm, exact, source-grounded. Terracotta `#E86741` accent on warm paper `#FAF8F4`; warm-grey ink.
- **Logo:** `assets/logo/` — `itaily-logo.svg` (on light), `itaily-logo-light.svg` (on dark/accent), `itaily-mark.svg` (the `[ai]` app icon).
- **Tokens:** `styles.css` is the single entry point — `@import` it and use the CSS custom properties (`--color-accent`, `--surface-page`, `--font-display`, etc.).
- **Type:** Space Grotesk (display/brand) · Hanken Grotesk (body) · Newsreader serif (legal excerpts, italic, in `«…»`) · Space Mono (citations, references). Loaded from Google Fonts in `tokens/fonts.css`.
- **Icons:** Lucide (2px rounded stroke), via CDN UMD global.
- **Components:** `components/{core,forms,legal}/` — `Button`, `IconButton`, `Icon`, `Badge`, `Card`, `Avatar`, `Input`, `Switch`, and the brand signatures `Citation`, `SourceCard`, `ConfidenceMeter`.
- **UI kits:** `ui_kits/app` (legal-AI assistant) and `ui_kits/web` (pitch landing) — read these for full-screen patterns.

## House rules
- Sentence case in UI; lowercase wordmark; ALL-CAPS only for the tracked mono eyebrow.
- Address the user as "you"; the product is "Itaily". No emoji.
- Legal *content* stays Italian in guillemets, serif; citations in mono Italian shorthand (`Art. 2043 c.c.`).
- Every AI answer shows a confidence level and verifiable citations. Never feign certainty.
- Warm, flat backgrounds; no blue/purple gradients; soft warm shadows; 1.5px borders; 16px card radius; terracotta focus ring.
