# Itaily — App UI kit

High-fidelity recreation of the **Itaily legal-AI assistant** workspace.

**Concept:** a lawyer asks a question in plain language; Itaily answers with prose that carries **inline citations**, an explicit **confidence** level, and a right-hand **sources rail** of primary-law excerpts. Click any citation to highlight its source.

## Run
Open `index.html`. It loads the compiled `_ds_bundle.js`, Lucide (icons), React + Babel, then the kit scripts.

## Flow
1. **Login** — branded sign-in card (pre-filled demo creds). Click **Enter Itaily**.
2. **Workspace** — sidebar of recent matters, an opening cited exchange, the composer.
3. **Ask** — type / pick a suggestion and send (Enter). A canned, cited answer appends and the sources rail updates.
4. **New question** — empties the thread to the suggestion empty-state.

## Files
- `index.html` — shell + script loads.
- `data.js` — faked threads, user, and canned cited answers (`window.ItailyData`).
- `screens.jsx` — `LoginScreen`, `Sidebar`, `Exchange`, `Composer`, `SourcesRail`, `BrandMark`.
- `AppShell.jsx` — orchestrator + `EmptyState`.

## Composes
`Button`, `IconButton`, `Icon`, `Badge`, `Avatar`, `Input`, `Citation`, `SourceCard`, `ConfidenceMeter` from the design system.

> Recreation note: no production app exists yet — this kit realises the product concept using the brand foundations. Content is illustrative.
