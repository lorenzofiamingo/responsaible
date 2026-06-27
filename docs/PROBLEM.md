# Problem & challenge framing

## The challenge

AI agents are already embedded in legal work. They draft documents, run research,
and produce risk analyses — and they do it far faster than any supervising lawyer
can read. A global law firm cannot put a human behind every word the AI writes, yet
the firm remains **accountable** for every deliverable that leaves the building. The
challenge is to keep human supervision **meaningful and defensible** while the volume
of AI output scales past what manual review can handle.

The Hack the Law brief frames this as **supervising AI legal work**, and asks an
example solution to demonstrate four capabilities:

- **Transparency** — show what the AI did.
- **Risk / confidence signalling** — surface where attention is most needed.
- **Supervisory controls** — let a human approve, change, or reject the work.
- **Auditability** — keep a defensible record of who decided what, and why.

A **bonus** track is offered for going beyond the baseline. We chose **citation
verification against a live authoritative source** (the EU CELLAR / EUR-Lex corpus)
to detect hallucinated or fabricated legal authorities.

## The four asks, and how Itaily respons[ai]ble addresses each

### (i) Understand what the AI agents did — the **agent trace**

Every work product carries an ordered trace of the steps its producing pipeline took:
`search` → `retrieve` → `reason` → `draft` → `cite` → `critique`, each tagged with the
**sub-agent** that performed it (e.g. *research*, *drafter*, *critic*) and a
human-readable summary, plus optional structured `detail` (tool inputs/outputs,
reasoning). This is the AI's reasoning made legible: a supervisor can see *how* a
conclusion was reached, not just the conclusion. The trace is generated offline by the
Google ADK pipeline from `session.events` and stored in `agent_action`.

> Surfaces: the **trace timeline** on the work-product detail view
> (`TraceTimeline.svelte`).

### (ii) Review and challenge proportionately — **risk-sorted queue + confidence + citations**

The reviewer should not give every item equal time. The home queue is **ordered by
risk and confidence**: most urgent first (`priority` descending), then least confident
first (`confidence` ascending) — see `getQueue()` in
`src/lib/server/db/queries.ts`. Each row shows its risk-signal counts (high / med /
low), citation count, confidence, and status, so the reviewer can decide *at a glance*
where to spend scrutiny. On the detail view, every AI claim is backed by a **citation**
(with a pinpoint locator like `Art. 6(1)(f)`) and the work product carries a
**confidence** score and a panel of structured **risk signals** explaining *why* it
might be wrong. Proportionate review means: trust the high-confidence, well-cited,
low-risk items quickly; challenge the rest.

> Surfaces: the queue (`+page.svelte`), `ConfidenceMeter.svelte`,
> `RiskSignalPanel.svelte`, `SourceCard.svelte`.

### (iii) Maintain accountability — **supervisory actions + audit trail**

The supervisor records a decision via a form action (`act` in
`work-products/[id]/+page.server.ts`): **approve, amend, reject, request rework,
escalate, or override**. The serious actions (reject, request rework, escalate,
override) **require a written reason** before they can be recorded
(`REASON_REQUIRED` in `src/lib/format.ts`). Each decision is appended to the
`supervisory_action` ledger, attributed to the acting lawyer
(`locals.actorEmail`), and the work product's status is updated. The ledger is
**insert-only and sha256 hash-chained** — see [ARCHITECTURE.md](ARCHITECTURE.md#the-audit-hash-chain).
This produces a record that answers *who decided what, when, and why* — and that can
be proven untampered.

> Surfaces: `SupervisoryActions.svelte` (the action form), `AuditTrail.svelte` (the
> ledger), and the `/api/audit/verify` endpoint.

### (iv) Scale supervision without manual review — **risk triage surfaces the riskiest first**

The combination of (ii) and the offline-computed risk signals is what makes
supervision *scale*: the queue actively pushes the highest-risk, lowest-confidence,
weakest-cited work to the top, so a single supervisor's limited attention is spent
where it changes outcomes. Low-risk, well-grounded items can be cleared quickly;
the system never asks the human to read everything. Headline stats (total, pending,
high-risk, low-confidence) on the queue give an at-a-glance sense of the backlog's
shape.

> Surfaces: queue ordering + the stats bar in `+page.server.ts` / `+page.svelte`.

## The bonus: citation verification vs CELLAR (hallucination detection)

A plausible-sounding but **fabricated** legal citation is one of the most dangerous AI
failure modes in law. Each citation in a work product carries EU **CELLAR**
identifiers — a **CELEX** number (canonical), an **ELI**, and a source URL. The bonus
feature resolves the CELEX against the live EU **CELLAR** repository
(`src/lib/server/cellar.ts`, via `POST /api/cellar/verify`) and marks each citation
`verified` (the act resolves, HTTP 200), `unresolved` (4xx — a likely hallucination),
or `unchecked` (network/inconclusive, the default) — `verify_status` in the schema,
rendered by `VerifyBadge.svelte`. A citation that does not resolve to a real act is a
hallucination signal the supervisor sees immediately. The same check runs **offline**
inside the ADK pipeline's *critic* agent, which raises a high-severity `hallucination`
risk for any CELEX that fails to resolve. Live verification is an *enhancement layered
on seeded data*: verdicts are cached in Cloudflare **KV**, and the demo works fully
offline from the seed regardless of network. See
[ARCHITECTURE.md](ARCHITECTURE.md#cellar-citation-verification) and
[TASKS.md](TASKS.md) for current status.

## Scope and domain

- **Domain:** EU law (GDPR, the AI Act, DSA, NIS2, the Water Framework Directive,
  etc.), in **English**. The seed work products are realistic EU-law memos, drafts,
  and risk analyses.
- **Out of scope:** the *production* of the work products at runtime. The AI pipeline
  runs **offline** to generate seed content; the console's job is **supervision**, not
  generation.
- **"Itaily" branding** is visual only — the EU-law framing here intentionally departs
  from the design system's Italian-law product narrative.
