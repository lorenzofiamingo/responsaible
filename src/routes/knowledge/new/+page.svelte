<script lang="ts">
	import { goto } from '$app/navigation';
	import Badge from '$lib/components/Badge.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { KNOWLEDGE_CATEGORY, KNOWLEDGE_CATEGORY_ORDER } from '$lib/format';
	import type { ExtractedKnowledge } from '$lib/types';

	let { data } = $props();

	type Phase = 'intake' | 'analyzing' | 'review';
	// A promote (?from=…) arrives pre-filled — open straight in review.
	let phase = $state<Phase>(data.seed ? 'review' : 'intake');

	// --- intake state ---
	let pasted = $state('');
	let file = $state<File | null>(null);
	let dragging = $state(false);
	let analyzeError = $state('');
	let showJson = $state(false);
	let jsonText = $state('');

	// --- review state ---
	let draft = $state<ExtractedKnowledge | null>(data.seed ?? null);
	let tagInput = $state('');
	let submitting = $state(false);
	let submitError = $state('');

	const CATEGORIES = KNOWLEDGE_CATEGORY_ORDER as readonly string[];

	const ANALYZE_STEPS = [
		{ icon: 'search', label: 'Reading the document' },
		{ icon: 'book-open', label: 'Classifying the document' },
		{ icon: 'quote', label: 'Extracting key terms & tags' },
		{ icon: 'pencil', label: 'Drafting the summary' },
		{ icon: 'lock', label: 'Filing into the private corpus' }
	];
	let revealed = $state(0);
	let stepTimer: ReturnType<typeof setInterval> | null = null;

	const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
	const str = (v: unknown, d = '') => (typeof v === 'string' ? v : d);

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

	/** Coerce a pasted JSON object into a complete, render-safe ExtractedKnowledge. */
	function normalizeDraft(input: unknown): ExtractedKnowledge {
		const o = (input && typeof input === 'object' ? input : {}) as Record<string, any>;
		const m = (o.meta && typeof o.meta === 'object' ? o.meta : {}) as Record<string, any>;
		const tags = Array.isArray(o.tags)
			? o.tags.map((t: unknown) => str(t).trim()).filter(Boolean)
			: str(o.tags).split(/[,\n]/).map((t) => t.trim()).filter(Boolean);
		return {
			title: str(o.title),
			category: CATEGORIES.includes(o.category) ? o.category : 'memo',
			tags,
			summary: str(o.summary),
			body: str(o.body),
			sourceRef: str(o.sourceRef),
			model: str(o.model, 'pipeline (JSON)'),
			meta: {
				method: m.method === 'gemini' ? 'gemini' : 'rules',
				sourceKind: ['pdf', 'docx', 'work_product'].includes(m.sourceKind) ? m.sourceKind : 'text',
				chars: typeof m.chars === 'number' ? m.chars : 0,
				warnings: Array.isArray(m.warnings) ? m.warnings.filter((w: unknown) => typeof w === 'string') : []
			}
		};
	}

	function blankDraft(): ExtractedKnowledge {
		return {
			title: '',
			category: 'memo',
			tags: [],
			summary: '',
			body: '',
			sourceRef: '',
			model: 'manual (operator)',
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
				req = fetch('/api/firm-knowledge/extract', { method: 'POST', body: fd });
			} else {
				req = fetch('/api/firm-knowledge/extract', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ text: pasted })
				});
			}
			const [res] = await Promise.all([req, wait(1500)]);
			const out = (await res.json().catch(() => ({}))) as { draft?: ExtractedKnowledge; error?: string };
			if (!res.ok || !out.draft) {
				analyzeError = out.error ?? `Analysis failed (HTTP ${res.status}).`;
				phase = 'intake';
				return;
			}
			draft = out.draft;
			revealed = ANALYZE_STEPS.length;
			phase = 'review';
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
			draft = normalizeDraft(JSON.parse(jsonText));
			phase = 'review';
		} catch (err) {
			analyzeError = 'Invalid JSON: ' + (err as Error).message;
		}
	}

	function addTag() {
		const parts = tagInput.split(/[,\n]/).map((t) => t.trim()).filter(Boolean);
		if (!parts.length || !draft) return;
		for (const p of parts) if (!draft.tags.includes(p)) draft.tags.push(p);
		tagInput = '';
	}
	function tagKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ',') {
			e.preventDefault();
			addTag();
		} else if (e.key === 'Backspace' && tagInput === '' && draft?.tags.length) {
			draft.tags.pop();
		}
	}
	function removeTag(i: number) {
		draft?.tags.splice(i, 1);
	}

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		if (!draft) return;
		submitError = '';
		if (!draft.title.trim()) {
			submitError = 'A title is required.';
			return;
		}
		if (!draft.body.trim()) {
			submitError = 'The document body cannot be empty.';
			return;
		}
		// Fold any half-typed tag into the list before sending.
		if (tagInput.trim()) addTag();
		submitting = true;
		const payload = {
			title: draft.title.trim(),
			category: draft.category,
			tags: draft.tags,
			body: draft.body,
			sourceRef: draft.sourceRef
		};
		try {
			const res = await fetch('/api/firm-knowledge', {
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
			await goto('/knowledge');
		} catch (err) {
			submitError = (err as Error).message;
			submitting = false;
		}
	}

	const methodLabel = $derived(
		draft?.meta.method === 'gemini' ? 'Gemini · live' : 'Itaily intake · rules engine'
	);
</script>

<div class="page">
	<a class="back" href="/knowledge"><Icon name="arrow-right" size={14} class="flip" /> Back to firm knowledge</a>

	{#if phase === 'intake'}
		<header class="hdr">
			<span class="itaily-eyebrow">Add to firm knowledge</span>
			<h1>Add a document to the firm's private corpus</h1>
			<p class="sub">
				Drop a memo, precedent, playbook clause, or guidance note. The intake agent reads it,
				classifies it, derives topical tags and a summary — then you review and correct before it
				joins the shared, on-perimeter corpus the Knowledge researcher draws on across every matter.
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
				<span class="dz-icon"><Icon name={file ? 'file-text' : 'book-open'} size={26} color="var(--color-accent)" /></span>
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
			placeholder="Paste the document text here — a memo, precedent, playbook clause, or guidance note…"
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
					{showJson ? 'Hide' : 'Paste'} JSON
				</button>
			</div>
		</div>

		{#if showJson}
			<div class="json-box">
				<textarea
					class="json"
					bind:value={jsonText}
					rows="8"
					placeholder="Paste a knowledge JSON object…"
				></textarea>
				<button type="button" class="ghost" onclick={loadJson}>Load into review</button>
			</div>
		{/if}
	{:else if phase === 'analyzing'}
		<div class="analyzing">
			<div class="spinner" aria-hidden="true"></div>
			<h2>Analyzing the document…</h2>
			<p class="asub">The intake agent is reading, classifying and tagging.</p>
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
			<span class="itaily-eyebrow">Review &amp; save</span>
			<h1>Review the document before it joins the corpus</h1>
		</header>

		<div class="banner">
			<span class="b-ic"><Icon name={data.fromWp ? 'gavel' : 'sparkles'} size={18} color="var(--color-accent)" /></span>
			<div class="b-main">
				{#if data.fromWp}
					<strong>Promoted from a work product.</strong> Pulled from <em>{data.fromWp.title}</em>
					({data.fromWp.matterName}). Every field is editable — refine it for reuse before saving.
				{:else}
					<strong>AI-extracted draft.</strong> Every field is editable — correct anything before it
					joins the firm knowledge base.
				{/if}
				<div class="b-meta">
					<Badge tone="accent"><Icon name="sparkles" size={11} /> {methodLabel}</Badge>
					{#if draft.meta.chars > 0}
						<span class="b-chars">{draft.meta.chars.toLocaleString('en-GB')} chars read</span>
					{/if}
				</div>
			</div>
		</div>

		{#if draft.meta.warnings.length}
			<div class="warns">
				{#each draft.meta.warnings as w (w)}
					<p class="warn"><Icon name="circle-alert" size={13} /> {w}</p>
				{/each}
			</div>
		{/if}

		<form class="form" onsubmit={submit}>
			<div class="grid2">
				<div class="field">
					<span class="lbl">Title</span>
					<input bind:value={draft.title} placeholder="Short title of the document" />
				</div>
				<div class="field">
					<span class="lbl">Category</span>
					<select bind:value={draft.category}>
						{#each KNOWLEDGE_CATEGORY_ORDER as c (c)}
							<option value={c}>{KNOWLEDGE_CATEGORY[c].label}</option>
						{/each}
					</select>
				</div>
			</div>

			<div class="field">
				<span class="lbl">Tags <em>— press Enter or comma to add; boosts lexical search</em></span>
				<div class="chips">
					{#each draft.tags as t, i (i)}
						<span class="chip">
							{t}
							<button type="button" class="chip-rm" onclick={() => removeTag(i)} aria-label={`Remove ${t}`}>
								<Icon name="x" size={11} />
							</button>
						</span>
					{/each}
					<input
						class="chip-input"
						bind:value={tagInput}
						onkeydown={tagKeydown}
						onblur={addTag}
						placeholder={draft.tags.length ? 'Add a tag…' : 'gdpr, transfer, scc…'}
					/>
				</div>
			</div>

			<div class="field">
				<span class="lbl">Summary <em>— for your reference; not stored</em></span>
				<input bind:value={draft.summary} placeholder="One-line summary" />
			</div>

			<div class="field">
				<span class="lbl">Source reference <em>— internal label shown in the agent trace</em></span>
				<input bind:value={draft.sourceRef} placeholder="e.g. KB/Privacy/Transfers-Playbook v3" />
			</div>

			<div class="field">
				<span class="lbl">Body <em>— the full text searched on-perimeter</em></span>
				<textarea bind:value={draft.body} rows="12" placeholder="The document text…"></textarea>
			</div>

			{#if submitError}
				<p class="err"><Icon name="triangle-alert" size={14} /> {submitError}</p>
			{/if}

			<div class="actions">
				{#if data.seed}
					<button type="button" class="cancel" onclick={() => goto('/knowledge')}>
						<Icon name="arrow-right" size={14} class="flip" /> Cancel
					</button>
				{:else}
					<button type="button" class="cancel" onclick={() => (phase = 'intake')}>
						<Icon name="arrow-right" size={14} class="flip" /> Start over
					</button>
				{/if}
				<button class="submit" type="submit" disabled={submitting}>
					{submitting ? 'Saving…' : 'Add to firm knowledge'}
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

	/* --- review banner / warnings --- */
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

	/* --- tag chips --- */
	.chips {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
		background: var(--surface-card);
		border: 1.5px solid var(--border-strong);
		border-radius: var(--radius-md);
		padding: 6px 8px;
	}
	.chips:focus-within {
		border-color: var(--border-focus);
		box-shadow: var(--shadow-focus);
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--terracotta-700);
		background: var(--terracotta-50);
		border: 1px solid var(--terracotta-200);
		border-radius: var(--radius-pill);
		padding: 3px 4px 3px 9px;
	}
	.chip-rm {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 16px;
		height: 16px;
		border: none;
		border-radius: 50%;
		background: transparent;
		color: var(--terracotta-700);
		cursor: pointer;
	}
	.chip-rm:hover {
		background: var(--terracotta-200);
	}
	.chip-input {
		flex: 1;
		min-width: 120px;
		border: none !important;
		box-shadow: none !important;
		padding: 4px 2px !important;
		font-size: var(--text-sm);
	}
	.chip-input:focus {
		outline: none;
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
		.grid2 {
			grid-template-columns: 1fr;
		}
	}
</style>
