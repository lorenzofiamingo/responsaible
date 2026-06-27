<script lang="ts">
	import { goto } from '$app/navigation';
	import Badge from '$lib/components/Badge.svelte';
	import ConfidenceMeter from '$lib/components/ConfidenceMeter.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import VerifyBadge from '$lib/components/VerifyBadge.svelte';
	import { RISK_CATEGORY, SEVERITY, TRACE_KIND } from '$lib/format';
	import type { ExtractedDraft } from '$lib/types';

	// The matter this intake is scoped to — resolved server-side from ?matter and
	// authoritative for the new work product (the create API ignores client matter text).
	let { data } = $props();

	type Phase = 'intake' | 'analyzing' | 'review';
	let phase = $state<Phase>('intake');

	// --- intake state ---
	let pasted = $state('');
	let file = $state<File | null>(null);
	let dragging = $state(false);
	let analyzeError = $state('');
	let showJson = $state(false);
	let jsonText = $state('');

	// --- review state ---
	let draft = $state<ExtractedDraft | null>(null);
	let verifyState = $state<Record<string, string>>({});
	let verifying = $state(false);
	let showTrace = $state(true);
	let submitting = $state(false);
	let submitError = $state('');

	const ANALYZE_STEPS = [
		{ icon: 'search', label: 'Reading the document' },
		{ icon: 'book-open', label: 'Identifying EU authorities' },
		{ icon: 'brain', label: 'Assessing risk signals' },
		{ icon: 'pencil', label: 'Drafting the work product' },
		{ icon: 'shield-check', label: 'Verifying citations against CELLAR' }
	];
	let revealed = $state(0);
	let stepTimer: ReturnType<typeof setInterval> | null = null;

	const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
	const eurlex = (celex: string) =>
		`https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:${celex}`;

	function pickFile(e: Event) {
		const input = e.target as HTMLInputElement;
		file = input.files?.[0] ?? null;
		analyzeError = '';
	}
	function onDrop(e: DragEvent) {
		e.preventDefault();
		dragging = false;
		const f = e.dataTransfer?.files?.[0];
		if (f) {
			file = f;
			analyzeError = '';
		}
	}

	// The vocabulary the create endpoint validates against — kept here so pasted
	// pipeline JSON is coerced to something the server will accept.
	const TRACE_KINDS = ['search', 'retrieve', 'reason', 'draft', 'cite', 'critique'];
	const RISK_CATS = ['hallucination', 'jurisdiction', 'missing_authority', 'conflict', 'deadline'];
	const SEVS = ['low', 'med', 'high'];
	const TYPES = ['draft', 'memo', 'opinion', 'risk_analysis'];

	const str = (v: unknown, d = '') => (typeof v === 'string' ? v : d);
	const numOr = (v: unknown, d: number) =>
		typeof v === 'number' && !Number.isNaN(v) ? v : d;
	const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

	/**
	 * Coerce an arbitrary parsed object (pasted pipeline JSON) into a fully-formed,
	 * render-safe ExtractedDraft — every field present and typed, enums valid, meta
	 * complete. Without this, a partial paste crashes the review render or is
	 * rejected by the create endpoint at submit.
	 */
	function normalizeDraft(input: unknown): ExtractedDraft {
		const o = (input && typeof input === 'object' ? input : {}) as Record<string, any>;
		const m = (o.meta && typeof o.meta === 'object' ? o.meta : {}) as Record<string, any>;
		return {
			type: TYPES.includes(o.type) ? o.type : 'memo',
			title: str(o.title),
			summary: str(o.summary),
			body: str(o.body),
			matterName: str(o.matterName),
			matterRef: str(o.matterRef),
			agentName: str(o.agentName, 'Itaily Research Agent'),
			priority: clamp(Math.round(numOr(o.priority, 50)), 0, 100),
			confidence: clamp(numOr(o.confidence, 0.7), 0, 1),
			model: str(o.model, 'pipeline (JSON)'),
			citations: Array.isArray(o.citations)
				? o.citations.map((c: any, i: number) => ({
						marker: typeof c?.marker === 'number' ? c.marker : i + 1,
						claim: str(c?.claim),
						celex: c?.celex == null ? null : str(c.celex) || null,
						eli: c?.eli == null ? null : str(c.eli) || null,
						title: str(c?.title),
						sourceUrl: c?.sourceUrl == null ? null : str(c.sourceUrl) || null,
						snippet: str(c?.snippet),
						locator: str(c?.locator),
						supportsClaim: c?.supportsClaim !== false
					}))
				: [],
			riskSignals: Array.isArray(o.riskSignals)
				? o.riskSignals.map((r: any) => ({
						category: RISK_CATS.includes(r?.category) ? r.category : 'missing_authority',
						severity: SEVS.includes(r?.severity) ? r.severity : 'med',
						rationale: str(r?.rationale),
						confidence: clamp(numOr(r?.confidence, 0.7), 0, 1)
					}))
				: [],
			trace: Array.isArray(o.trace)
				? o.trace.map((t: any, i: number) => ({
						step: typeof t?.step === 'number' ? t.step : i + 1,
						kind: TRACE_KINDS.includes(t?.kind) ? t.kind : 'reason',
						actorAgent: str(t?.actorAgent),
						summary: str(t?.summary),
						detail: t?.detail && typeof t.detail === 'object' ? t.detail : null
					}))
				: [],
			meta: {
				method: m.method === 'gemini' ? 'gemini' : 'rules',
				sourceKind: m.sourceKind === 'pdf' ? 'pdf' : m.sourceKind === 'docx' ? 'docx' : 'text',
				chars: numOr(m.chars, 0),
				warnings: Array.isArray(m.warnings) ? m.warnings.filter((w: unknown) => typeof w === 'string') : []
			}
		};
	}

	function blankDraft(model = 'manual (operator)'): ExtractedDraft {
		return {
			type: 'memo',
			title: '',
			summary: '',
			body: '',
			matterName: '',
			matterRef: '',
			agentName: 'Itaily Research Agent',
			priority: 50,
			confidence: 0.7,
			model,
			citations: [],
			riskSignals: [],
			trace: [],
			meta: { method: 'rules', sourceKind: 'text', chars: 0, warnings: [] }
		};
	}

	async function analyze() {
		analyzeError = '';
		if (!file && pasted.trim().length < 12) {
			analyzeError = 'Drop a file or paste the document text first.';
			return;
		}
		phase = 'analyzing';
		revealed = 1;
		stepTimer = setInterval(() => {
			if (revealed < ANALYZE_STEPS.length) revealed += 1;
		}, 480);

		try {
			let req: Promise<Response>;
			if (file) {
				const fd = new FormData();
				fd.append('file', file);
				req = fetch('/api/work-products/extract', { method: 'POST', body: fd });
			} else {
				req = fetch('/api/work-products/extract', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ text: pasted })
				});
			}
			// Minimum dwell so the analysis reads as deliberate work, not a flash.
			const [res] = await Promise.all([req, wait(1500)]);
			const out = (await res.json().catch(() => ({}))) as { draft?: ExtractedDraft; error?: string };
			if (!res.ok || !out.draft) {
				analyzeError = out.error ?? `Analysis failed (HTTP ${res.status}).`;
				phase = 'intake';
				return;
			}
			draft = out.draft;
			revealed = ANALYZE_STEPS.length;
			phase = 'review';
			verifyCitations();
		} catch (err) {
			analyzeError = (err as Error).message;
			phase = 'intake';
		} finally {
			if (stepTimer) clearInterval(stepTimer);
			stepTimer = null;
		}
	}

	function startBlank() {
		draft = blankDraft();
		phase = 'review';
	}

	function loadJson() {
		analyzeError = '';
		try {
			// Coerce the pasted object into a complete, valid draft (enums, arrays,
			// meta all backfilled) so the review renders and submit() is accepted.
			draft = normalizeDraft(JSON.parse(jsonText));
			phase = 'review';
			verifyCitations();
		} catch (err) {
			analyzeError = 'Invalid JSON: ' + (err as Error).message;
		}
	}

	async function verifyCitations() {
		const celexes = (draft?.citations ?? [])
			.map((c) => c.celex)
			.filter((c): c is string => !!c && c.trim().length > 0);
		if (!celexes.length) return;
		verifying = true;
		try {
			const res = await fetch('/api/cellar/check', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ celexes })
			});
			const out = (await res.json().catch(() => ({}))) as {
				results?: Array<{ celex: string; status: string }>;
			};
			for (const r of out.results ?? []) verifyState[r.celex] = r.status;
		} catch {
			// offline / network — leave citations unverified, never block intake
		} finally {
			verifying = false;
		}
	}

	function addCitation() {
		draft?.citations.push({
			marker: (draft?.citations.length ?? 0) + 1,
			claim: '',
			celex: '',
			eli: null,
			title: '',
			sourceUrl: null,
			snippet: '',
			locator: '',
			supportsClaim: true
		});
	}
	function removeCitation(i: number) {
		draft?.citations.splice(i, 1);
	}
	function addRisk() {
		draft?.riskSignals.push({
			category: 'missing_authority',
			severity: 'med',
			rationale: '',
			confidence: 0.75
		});
	}
	function removeRisk(i: number) {
		draft?.riskSignals.splice(i, 1);
	}

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		if (!draft) return;
		submitError = '';
		if (!draft.title.trim()) {
			submitError = 'A title is required.';
			return;
		}
		submitting = true;
		// Filter every collection to exactly what the create endpoint accepts, so an
		// edited or pasted draft can never be rejected (or throw) at submit time.
		const payload = {
			type: draft.type,
			title: draft.title.trim(),
			summary: draft.summary,
			body: draft.body,
			matterId: data.matter.id,
			matterName: data.matter.name,
			matterRef: data.matter.ref,
			agentName: draft.agentName,
			priority: Number(draft.priority) || 0,
			confidence: Number(draft.confidence) || 0,
			model: draft.model,
			trace: draft.trace.filter((t) => TRACE_KINDS.includes(t.kind) && (t.summary ?? '').trim()),
			citations: draft.citations
				.filter((c) => (c.celex ?? '').trim() || (c.title ?? '').trim())
				.map((c, i) => ({
					...c,
					marker: i + 1,
					celex: (c.celex ?? '').trim() || null,
					sourceUrl: (c.celex ?? '').trim() ? eurlex((c.celex ?? '').trim()) : c.sourceUrl
				})),
			riskSignals: draft.riskSignals.filter(
				(r) => (r.rationale ?? '').trim() && RISK_CATS.includes(r.category) && SEVS.includes(r.severity)
			)
		};
		try {
			const res = await fetch('/api/work-products', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(payload)
			});
			const out = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
			if (!res.ok || !out.id) {
				submitError = out.error ?? `Submission failed (HTTP ${res.status}).`;
				submitting = false;
				return;
			}
			await goto(`/work-products/${out.id}`);
		} catch (err) {
			submitError = (err as Error).message;
			submitting = false;
		}
	}

	const methodLabel = $derived(
		draft?.meta.method === 'gemini' ? 'Gemini · live' : 'Itaily intake · rules engine'
	);
	const highRisks = $derived(draft?.riskSignals.filter((r) => r.severity === 'high').length ?? 0);
</script>

<div class="page">
<a class="back" href="/matters/{data.matter.id}"
	><Icon name="arrow-right" size={14} class="flip" /> Back to {data.matter.name}</a
>

{#if phase === 'intake'}
	<header class="hdr">
		<span class="itaily-eyebrow">Add to workload</span>
		<h1>Ingest a document, let the agent do the typing</h1>
		<p class="sub">
			Drop a memo, contract, or research note. The Itaily intake agent reads it, pulls the EU
			authorities, drafts the work product, flags risk signals, and verifies citations against EU
			CELLAR — then you review and correct before it enters the supervision queue.
		</p>
	</header>

	<div
		class="dropzone"
		class:dragging
		role="button"
		tabindex="0"
		ondragover={(e) => {
			e.preventDefault();
			dragging = true;
		}}
		ondragleave={() => (dragging = false)}
		ondrop={onDrop}
	>
		<input id="file" class="file-input" type="file" accept=".pdf,.docx,.txt,.md,.markdown,.json,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/*" onchange={pickFile} />
		<label class="dz-inner" for="file">
			<span class="dz-icon"><Icon name={file ? 'file-text' : 'sparkles'} size={26} color="var(--color-accent)" /></span>
			{#if file}
				<span class="dz-title">{file.name}</span>
				<span class="dz-hint">{(file.size / 1024).toFixed(0)} KB · click to choose a different file</span>
			{:else}
				<span class="dz-title">Drop a PDF, Word, or text file here, or click to browse</span>
				<span class="dz-hint">PDF, Word (.docx), TXT, MD — the agent extracts the text automatically</span>
			{/if}
		</label>
	</div>

	<div class="or"><span>or paste the text</span></div>

	<textarea
		class="paste"
		bind:value={pasted}
		rows="7"
		placeholder="Paste the document text here — a memo, a clause, a research note about EU law…"
	></textarea>

	{#if analyzeError}
		<p class="err"><Icon name="triangle-alert" size={14} /> {analyzeError}</p>
	{/if}

	<div class="intake-actions">
		<button class="analyze" onclick={analyze} disabled={!file && pasted.trim().length < 12}>
			<Icon name="sparkles" size={16} /> Analyze with AI
		</button>
		<div class="secondary">
			<button type="button" class="link" onclick={startBlank}>Start from a blank form</button>
			<span class="dot">·</span>
			<button type="button" class="link" onclick={() => (showJson = !showJson)}>
				{showJson ? 'Hide' : 'Paste'} pipeline JSON
			</button>
		</div>
	</div>

	{#if showJson}
		<div class="json-box">
			<textarea
				class="json"
				bind:value={jsonText}
				rows="8"
				placeholder="Paste a work-product JSON object straight from the AI pipeline…"
			></textarea>
			<button type="button" class="ghost" onclick={loadJson}>Load into review</button>
		</div>
	{/if}
{:else if phase === 'analyzing'}
	<div class="analyzing">
		<div class="spinner" aria-hidden="true"></div>
		<h2>Analyzing the document…</h2>
		<p class="asub">The intake agent is reading, grounding and drafting.</p>
		<ul class="steps">
			{#each ANALYZE_STEPS as s, i (s.label)}
				<li class:done={i < revealed - 1} class:active={i === revealed - 1} class:pending={i >= revealed}>
					<span class="s-ic">
						{#if i < revealed - 1}
							<Icon name="check" size={14} color="var(--status-success-fg)" />
						{:else}
							<Icon name={s.icon} size={14} />
						{/if}
					</span>
					{s.label}
				</li>
			{/each}
		</ul>
	</div>
{:else if draft}
	<header class="hdr">
		<span class="itaily-eyebrow">Review &amp; submit</span>
		<h1>Review the extracted work product</h1>
	</header>

	<div class="banner">
		<span class="b-ic"><Icon name="sparkles" size={18} color="var(--color-accent)" /></span>
		<div class="b-main">
			<strong>AI-extracted draft.</strong> Every field is editable — correct anything before it enters
			the queue.
			<div class="b-meta">
				<Badge tone="accent"><Icon name="sparkles" size={11} /> {methodLabel}</Badge>
				{#if draft.meta.chars > 0}
					<span class="b-chars">{draft.meta.chars.toLocaleString('en-GB')} chars read</span>
				{/if}
				{#if highRisks > 0}
					<Badge tone="danger"><Icon name="triangle-alert" size={11} /> {highRisks} high-severity risk</Badge>
				{/if}
			</div>
		</div>
		<div class="b-conf">
			<ConfidenceMeter value={draft.confidence} />
		</div>
	</div>

	{#if draft.meta.warnings.length}
		<div class="warns">
			{#each draft.meta.warnings as w (w)}
				<p class="warn"><Icon name="circle-alert" size={13} /> {w}</p>
			{/each}
		</div>
	{/if}

	{#if draft.trace.length}
		<section class="trace">
			<button type="button" class="trace-head" onclick={() => (showTrace = !showTrace)}>
				<Icon name={showTrace ? 'chevron-down' : 'chevron-right'} size={15} />
				<span class="lbl">Agent trace</span>
				<span class="trace-count">{draft.trace.length} steps</span>
			</button>
			{#if showTrace}
				<ol class="trace-list">
					{#each draft.trace as t (t.step)}
						<li>
							<span class="t-ic"><Icon name={TRACE_KIND[t.kind]?.icon ?? 'circle-alert'} size={13} /></span>
							<div>
								<span class="t-kind">{TRACE_KIND[t.kind]?.label ?? t.kind}</span>
								<span class="t-sum">{t.summary}</span>
							</div>
						</li>
					{/each}
				</ol>
			{/if}
		</section>
	{/if}

	<form class="form" onsubmit={submit}>
		<div class="grid2">
			<div class="field">
				<span class="lbl">Type</span>
				<select bind:value={draft.type}>
					<option value="memo">Memo</option>
					<option value="draft">Draft</option>
					<option value="opinion">Opinion</option>
					<option value="risk_analysis">Risk analysis</option>
				</select>
			</div>
			<div class="field">
				<span class="lbl">Agent</span>
				<input bind:value={draft.agentName} placeholder="Itaily Research Agent" />
			</div>
		</div>

		<div class="field">
			<span class="lbl">Title</span>
			<input bind:value={draft.title} placeholder="Short title of the work product" />
		</div>

		<div class="field">
			<span class="lbl">Matter</span>
			<div class="matter-lock">
				<Icon name="folder-open" size={15} color="var(--color-accent)" />
				<span class="ml-name">{data.matter.name}</span>
				<span class="ml-ref">{data.matter.ref}</span>
				<a class="ml-change" href="/">Change</a>
			</div>
		</div>

		<div class="field">
			<span class="lbl">Summary</span>
			<input bind:value={draft.summary} placeholder="One-line summary" />
		</div>

		<div class="field">
			<span class="lbl">Body <em>— [1], [2]… reference the citations below</em></span>
			<textarea bind:value={draft.body} rows="8" placeholder="The analysis…"></textarea>
		</div>

		<div class="grid2">
			<div class="field">
				<span class="lbl">Priority <em>(0–100)</em></span>
				<input type="number" min="0" max="100" bind:value={draft.priority} />
			</div>
			<div class="field">
				<span class="lbl">Confidence <em>(0–1)</em></span>
				<input type="number" min="0" max="1" step="0.01" bind:value={draft.confidence} />
			</div>
		</div>

		<div class="repeat">
			<div class="rhead">
				<span class="lbl">Citations</span>
				<div class="rhead-actions">
					{#if (draft.citations ?? []).some((c) => c.celex)}
						<button type="button" class="verify" onclick={verifyCitations} disabled={verifying}>
							<Icon name="shield-check" size={13} /> {verifying ? 'Verifying…' : 'Re-verify CELLAR'}
						</button>
					{/if}
					<button type="button" onclick={addCitation}><Icon name="book-open" size={13} /> Add</button>
				</div>
			</div>
			{#each draft.citations as c, i (i)}
				<div class="citrow">
					<div class="cit-fields">
						<input class="celex" bind:value={c.celex} placeholder="CELEX e.g. 32016R0679" />
						<input bind:value={c.title} placeholder="Title" />
						<input class="loc" bind:value={c.locator} placeholder="Art. 30(1)" />
						<input bind:value={c.snippet} placeholder="Quoted excerpt (optional)" />
						<button type="button" class="rm" onclick={() => removeCitation(i)} aria-label="Remove">
							<Icon name="x" size={14} />
						</button>
					</div>
					{#if c.celex && verifyState[c.celex.trim().toUpperCase()]}
						<div class="cit-verify"><VerifyBadge status={verifyState[c.celex.trim().toUpperCase()]} /></div>
					{/if}
				</div>
			{/each}
			{#if !draft.citations.length}
				<p class="empty">No citations detected. Add a CELEX so it can be verified against EU CELLAR.</p>
			{/if}
		</div>

		<div class="repeat">
			<div class="rhead">
				<span class="lbl">Risk signals</span>
				<button type="button" onclick={addRisk}><Icon name="shield-alert" size={13} /> Add</button>
			</div>
			{#each draft.riskSignals as r, i (i)}
				<div class="riskrow">
					<select bind:value={r.category}>
						{#each Object.entries(RISK_CATEGORY) as [val, meta] (val)}
							<option value={val}>{meta.label}</option>
						{/each}
					</select>
					<select bind:value={r.severity}>
						{#each Object.entries(SEVERITY) as [val, meta] (val)}
							<option value={val}>{meta.label}</option>
						{/each}
					</select>
					<input bind:value={r.rationale} placeholder="Why this is a risk" />
					<button type="button" class="rm" onclick={() => removeRisk(i)} aria-label="Remove">
						<Icon name="x" size={14} />
					</button>
				</div>
			{/each}
			{#if !draft.riskSignals.length}
				<p class="empty">No risk signals flagged.</p>
			{/if}
		</div>

		{#if submitError}
			<p class="err"><Icon name="triangle-alert" size={14} /> {submitError}</p>
		{/if}

		<div class="actions">
			<button type="button" class="cancel" onclick={() => (phase = 'intake')}>
				<Icon name="arrow-right" size={14} class="flip" /> Start over
			</button>
			<button class="submit" type="submit" disabled={submitting}>
				{submitting ? 'Submitting…' : 'Submit to queue'}
				<Icon name="arrow-right" size={16} />
			</button>
		</div>
	</form>
{/if}
</div>

<style>
	.back {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: var(--text-sm);
		color: var(--text-secondary);
		text-decoration: none;
		margin-bottom: var(--space-4);
	}
	.back :global(.flip) {
		transform: rotate(180deg);
	}
	/* Fills the layout's content container (--container-max) so the add flow
	   lines up with the queue and the work-product detail pages. */
	.page {
		width: 100%;
	}
	.hdr {
		margin-bottom: var(--space-5);
	}
	.hdr h1 {
		font-size: var(--text-xl);
		margin: 6px 0 8px;
	}
	.sub {
		margin: 0;
		max-width: 70ch;
		color: var(--text-secondary);
		font-size: var(--text-base);
		line-height: var(--leading-normal);
	}

	/* --- intake --- */
	.dropzone {
		border: 1.5px dashed var(--border-strong);
		border-radius: var(--radius-lg);
		background: var(--surface-card);
		transition:
			border-color var(--duration-fast) var(--ease-out),
			background var(--duration-fast) var(--ease-out);
	}
	.dropzone.dragging {
		border-color: var(--color-accent);
		background: var(--terracotta-50);
	}
	.file-input {
		position: absolute;
		width: 1px;
		height: 1px;
		opacity: 0;
		pointer-events: none;
	}
	.dz-inner {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		padding: var(--space-6);
		cursor: pointer;
		text-align: center;
	}
	.dz-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 52px;
		height: 52px;
		border-radius: var(--radius-md);
		background: var(--terracotta-50);
		margin-bottom: 4px;
	}
	.dz-title {
		font-family: var(--font-display);
		font-weight: var(--weight-medium);
		font-size: var(--text-md);
		color: var(--text-primary);
	}
	.dz-hint {
		font-size: var(--text-sm);
		color: var(--text-tertiary);
	}
	.or {
		display: flex;
		align-items: center;
		gap: 12px;
		margin: var(--space-4) 0;
		color: var(--text-tertiary);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
	}
	.or::before,
	.or::after {
		content: '';
		flex: 1;
		height: 1px;
		background: var(--border-default);
	}
	.paste {
		width: 100%;
	}
	.intake-actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 14px;
		margin-top: var(--space-4);
		flex-wrap: wrap;
	}
	.secondary {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-size: var(--text-sm);
		color: var(--text-tertiary);
	}
	.link {
		background: none;
		border: none;
		color: var(--text-link);
		font-size: var(--text-sm);
		cursor: pointer;
		padding: 0;
	}
	.dot {
		color: var(--border-strong);
	}
	.json-box {
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin-top: var(--space-4);
	}
	.ghost {
		align-self: flex-start;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-family: var(--font-display);
		font-weight: var(--weight-medium);
		font-size: var(--text-sm);
		color: var(--text-primary);
		background: var(--surface-card);
		border: 1.5px solid var(--border-strong);
		border-radius: var(--radius-md);
		padding: 8px 14px;
		cursor: pointer;
	}

	/* --- analyzing --- */
	.analyzing {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 8px;
		padding: var(--space-7) var(--space-6);
		background: var(--surface-card);
		border: 1.5px solid var(--border-default);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-sm);
	}
	.spinner {
		width: 38px;
		height: 38px;
		border-radius: 50%;
		border: 3px solid var(--terracotta-100, var(--terracotta-50));
		border-top-color: var(--color-accent);
		animation: spin 0.8s linear infinite;
		margin-bottom: 6px;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	.analyzing h2 {
		font-size: var(--text-lg);
		margin: 0;
	}
	.asub {
		margin: 0 0 10px;
		color: var(--text-secondary);
		font-size: var(--text-sm);
	}
	.steps {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
		text-align: left;
		width: 100%;
		max-width: 360px;
	}
	.steps li {
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: var(--text-sm);
		color: var(--text-tertiary);
		transition: color var(--duration-normal) var(--ease-out);
	}
	.steps li.active {
		color: var(--text-primary);
		font-weight: var(--weight-medium);
	}
	.steps li.done {
		color: var(--text-secondary);
	}
	.s-ic {
		display: inline-flex;
		width: 22px;
		justify-content: center;
	}
	.steps li.active .s-ic {
		color: var(--color-accent);
	}

	/* --- review banner / warnings / trace --- */
	.banner {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: var(--space-4) var(--space-5);
		background: var(--terracotta-50);
		border: 1.5px solid var(--terracotta-200);
		border-radius: var(--radius-lg);
		margin-bottom: var(--space-4);
	}
	.b-ic {
		flex: none;
	}
	.b-main {
		flex: 1;
		font-size: var(--text-sm);
		color: var(--text-secondary);
		line-height: var(--leading-normal);
	}
	.b-meta {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
		margin-top: 8px;
	}
	.b-chars {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--text-tertiary);
	}
	.b-conf {
		flex: none;
	}
	.warns {
		margin-bottom: var(--space-4);
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.warn {
		display: flex;
		align-items: center;
		gap: 6px;
		margin: 0;
		font-size: var(--text-sm);
		color: var(--status-warning-fg);
	}
	.trace {
		margin-bottom: var(--space-4);
		border: 1.5px solid var(--border-default);
		border-radius: var(--radius-lg);
		background: var(--surface-card);
		overflow: hidden;
	}
	.trace-head {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 11px 14px;
		background: none;
		border: none;
		cursor: pointer;
		color: var(--text-primary);
	}
	.trace-head .lbl {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
		color: var(--text-tertiary);
	}
	.trace-count {
		margin-left: auto;
		font-size: var(--text-xs);
		color: var(--text-tertiary);
	}
	.trace-list {
		list-style: none;
		margin: 0;
		padding: 0 14px 12px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.trace-list li {
		display: flex;
		gap: 10px;
		align-items: flex-start;
	}
	.t-ic {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		flex: none;
		border-radius: var(--radius-sm);
		background: var(--surface-sunken);
		color: var(--color-accent);
		margin-top: 1px;
	}
	.t-kind {
		display: block;
		font-family: var(--font-mono);
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
		color: var(--text-tertiary);
	}
	.t-sum {
		font-size: var(--text-sm);
		color: var(--text-secondary);
		line-height: var(--leading-normal);
	}

	/* --- review form --- */
	.form {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		background: var(--surface-card);
		border: 1.5px solid var(--border-default);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-sm);
		padding: var(--space-5);
	}
	.grid2 {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-4);
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 5px;
	}
	.lbl {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
		color: var(--text-tertiary);
	}
	.lbl em {
		text-transform: none;
		letter-spacing: 0;
		font-style: normal;
		color: var(--text-tertiary);
	}
	.matter-lock {
		display: flex;
		align-items: center;
		gap: 10px;
		background: var(--surface-card);
		border: 1.5px solid var(--border-default);
		border-left: 3px solid var(--color-accent);
		border-radius: var(--radius-md);
		padding: 10px 14px;
	}
	.matter-lock .ml-name {
		font-family: var(--font-display);
		font-weight: var(--weight-medium);
		font-size: var(--text-md);
		color: var(--text-primary);
	}
	.matter-lock .ml-ref {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--text-tertiary);
	}
	.matter-lock .ml-change {
		margin-left: auto;
		font-size: var(--text-xs);
		color: var(--text-link);
		text-decoration: none;
	}
	.matter-lock .ml-change:hover {
		text-decoration: underline;
	}
	input,
	select,
	textarea,
	.json,
	.paste {
		font-family: var(--font-sans);
		font-size: var(--text-base);
		color: var(--text-primary);
		background: var(--surface-card);
		border: 1.5px solid var(--border-strong);
		border-radius: var(--radius-md);
		padding: 9px 11px;
	}
	input,
	select,
	textarea {
		width: 100%;
	}
	.json,
	.paste {
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		line-height: var(--leading-normal);
		resize: vertical;
	}
	textarea {
		resize: vertical;
		line-height: var(--leading-normal);
	}
	input:focus,
	select:focus,
	textarea:focus {
		outline: none;
		border-color: var(--border-focus);
		box-shadow: var(--shadow-focus);
	}
	.repeat {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.rhead {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.rhead-actions {
		display: inline-flex;
		align-items: center;
		gap: 12px;
	}
	.rhead button {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--text-link);
		background: none;
		border: none;
		cursor: pointer;
	}
	.verify {
		color: var(--status-success-fg) !important;
	}
	.verify:disabled {
		opacity: 0.6;
		cursor: progress;
	}
	.citrow {
		display: flex;
		flex-direction: column;
		gap: 5px;
	}
	.cit-fields {
		display: grid;
		grid-template-columns: 1.2fr 1.4fr 0.9fr 1.6fr auto;
		gap: 6px;
		align-items: center;
	}
	.cit-verify {
		padding-left: 2px;
	}
	.riskrow {
		display: grid;
		grid-template-columns: 1fr 0.8fr 2fr auto;
		gap: 6px;
		align-items: center;
	}
	.citrow input,
	.riskrow input,
	.riskrow select {
		font-size: var(--text-sm);
		padding: 7px 9px;
	}
	.celex {
		font-family: var(--font-mono);
	}
	.rm {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border: 1.5px solid var(--border-default);
		border-radius: var(--radius-sm);
		background: var(--surface-card);
		color: var(--text-tertiary);
		cursor: pointer;
	}
	.rm:hover {
		border-color: var(--status-danger-fg);
		color: var(--status-danger-fg);
	}
	.empty {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--text-tertiary);
	}
	.err {
		display: flex;
		align-items: center;
		gap: 6px;
		margin: 0;
		font-size: var(--text-sm);
		color: var(--status-danger-fg);
	}
	.actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 14px;
		margin-top: var(--space-2);
	}
	.cancel {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: var(--text-sm);
		color: var(--text-secondary);
		background: none;
		border: none;
		cursor: pointer;
	}
	.cancel :global(.flip) {
		transform: rotate(180deg);
	}
	.analyze,
	.submit {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-family: var(--font-display);
		font-weight: var(--weight-medium);
		font-size: var(--text-base);
		color: var(--color-on-accent);
		background: var(--color-accent);
		border: 1.5px solid transparent;
		border-radius: var(--radius-md);
		height: 44px;
		padding: 0 var(--space-5);
		cursor: pointer;
	}
	.analyze:hover:not(:disabled),
	.submit:hover:not(:disabled) {
		background: var(--color-accent-hover);
	}
	.analyze:disabled,
	.submit:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	@media (max-width: 640px) {
		.grid2,
		.cit-fields,
		.riskrow {
			grid-template-columns: 1fr;
		}
	}
</style>
