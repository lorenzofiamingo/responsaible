<script lang="ts">
	import { goto } from '$app/navigation';
	import Icon from '$lib/components/Icon.svelte';

	let f = $state({
		type: 'memo',
		title: '',
		matterName: '',
		matterRef: '',
		summary: '',
		body: '',
		priority: 60,
		confidence: 0.7,
		agentName: 'Itaily Research Agent'
	});
	let citations = $state<Array<{ celex: string; title: string; locator: string; snippet: string }>>([
		{ celex: '', title: '', locator: '', snippet: '' }
	]);
	let risks = $state<Array<{ category: string; severity: string; rationale: string }>>([
		{ category: 'missing_authority', severity: 'med', rationale: '' }
	]);

	let useJson = $state(false);
	let jsonText = $state('');
	let submitting = $state(false);
	let error = $state('');

	const EXAMPLE = JSON.stringify(
		{
			type: 'memo',
			title: 'GDPR records-of-processing obligation for the Borealis launch',
			summary: 'Whether the new analytics feature triggers an Article 30 record-keeping duty.',
			body: 'A controller must maintain a record of processing activities under the GDPR [1]. The exemption for organisations under 250 employees does not apply where processing is not occasional, which is the case for continuous analytics [1]. A record must therefore be maintained.',
			matterName: 'Borealis — product analytics',
			matterRef: 'MAT-2026-0181',
			agentName: 'Itaily Research Agent',
			priority: 58,
			confidence: 0.84,
			model: 'gemini-2.5 (ADK)',
			citations: [
				{
					marker: 1,
					claim: 'Controllers must keep a record of processing activities.',
					celex: '32016R0679',
					title: 'Regulation (EU) 2016/679 (GDPR)',
					sourceUrl: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32016R0679',
					snippet:
						'Each controller… shall maintain a record of processing activities under its responsibility.',
					locator: 'Art. 30(1)'
				}
			],
			riskSignals: [
				{
					category: 'jurisdiction',
					severity: 'low',
					rationale: 'The 250-employee exemption analysis assumes EU establishment; confirm.',
					confidence: 0.6
				}
			],
			trace: [
				{ step: 1, kind: 'retrieve', actorAgent: 'research', summary: 'Retrieved GDPR Article 30.' },
				{ step: 2, kind: 'draft', actorAgent: 'drafter', summary: 'Drafted the record-keeping memo.' }
			]
		},
		null,
		2
	);

	function addCitation() {
		citations.push({ celex: '', title: '', locator: '', snippet: '' });
	}
	function removeCitation(i: number) {
		citations.splice(i, 1);
	}
	function addRisk() {
		risks.push({ category: 'missing_authority', severity: 'med', rationale: '' });
	}
	function removeRisk(i: number) {
		risks.splice(i, 1);
	}
	function loadExample() {
		jsonText = EXAMPLE;
		useJson = true;
	}

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		submitting = true;
		error = '';

		let payload: unknown;
		if (useJson && jsonText.trim()) {
			try {
				payload = JSON.parse(jsonText);
			} catch (err) {
				error = 'Invalid JSON: ' + (err as Error).message;
				submitting = false;
				return;
			}
		} else {
			if (!f.title.trim()) {
				error = 'A title is required.';
				submitting = false;
				return;
			}
			payload = {
				...f,
				priority: Number(f.priority),
				confidence: Number(f.confidence),
				model: 'manual (operator)',
				citations: citations
					.filter((c) => c.celex.trim() || c.title.trim())
					.map((c, i) => ({
						marker: i + 1,
						claim: '',
						celex: c.celex.trim() || null,
						title: c.title.trim(),
						sourceUrl: c.celex.trim()
							? `https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:${c.celex.trim()}`
							: null,
						snippet: c.snippet.trim(),
						locator: c.locator.trim()
					})),
				riskSignals: risks
					.filter((r) => r.rationale.trim())
					.map((r) => ({
						category: r.category,
						severity: r.severity,
						rationale: r.rationale.trim(),
						confidence: 0.75
					})),
				trace: []
			};
		}

		const res = await fetch('/api/work-products', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(payload)
		});
		const out = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
		if (!res.ok || !out.id) {
			error = out.error ?? `Submission failed (HTTP ${res.status}).`;
			submitting = false;
			return;
		}
		await goto(`/work-products/${out.id}`);
	}
</script>

<a class="back" href="/"><Icon name="arrow-right" size={14} class="flip" /> Back to queue</a>

<header class="hdr">
	<span class="itaily-eyebrow">Add to workload</span>
	<h1>Submit an AI work product</h1>
	<p class="sub">
		Push a new AI-generated draft, memo, or risk analysis into the supervision queue. It enters as
		<strong>pending</strong> for a supervising lawyer to review. Add a CELEX to a citation so it can be
		verified against EU CELLAR.
	</p>
</header>

<form class="form" onsubmit={submit}>
	<label class="toggle">
		<input type="checkbox" bind:checked={useJson} />
		Paste full JSON instead (e.g. straight from the AI pipeline)
		<button type="button" class="ex" onclick={loadExample}>Load example</button>
	</label>

	{#if useJson}
		<textarea
			class="json"
			bind:value={jsonText}
			rows="16"
			placeholder="Paste a work-product JSON object…"
		></textarea>
	{:else}
		<div class="grid2">
			<div class="field">
				<span class="lbl">Type</span>
				<select bind:value={f.type}>
					<option value="memo">Memo</option>
					<option value="draft">Draft</option>
					<option value="risk_analysis">Risk analysis</option>
				</select>
			</div>
			<div class="field">
				<span class="lbl">Agent</span>
				<input bind:value={f.agentName} placeholder="Itaily Research Agent" />
			</div>
		</div>

		<div class="field">
			<span class="lbl">Title</span>
			<input bind:value={f.title} placeholder="Short title of the work product" />
		</div>

		<div class="grid2">
			<div class="field">
				<span class="lbl">Matter name</span>
				<input bind:value={f.matterName} placeholder="Project Borealis — analytics" />
			</div>
			<div class="field">
				<span class="lbl">Matter ref</span>
				<input bind:value={f.matterRef} placeholder="MAT-2026-0181" />
			</div>
		</div>

		<div class="field">
			<span class="lbl">Summary</span>
			<input bind:value={f.summary} placeholder="One-line summary" />
		</div>

		<div class="field">
			<span class="lbl">Body <em>— use [1], [2]… to reference the citations below</em></span>
			<textarea bind:value={f.body} rows="5" placeholder="The AI's analysis…"></textarea>
		</div>

		<div class="grid2">
			<div class="field">
				<span class="lbl">Priority <em>(0–100)</em></span>
				<input type="number" min="0" max="100" bind:value={f.priority} />
			</div>
			<div class="field">
				<span class="lbl">Confidence <em>(0–1)</em></span>
				<input type="number" min="0" max="1" step="0.01" bind:value={f.confidence} />
			</div>
		</div>

		<div class="repeat">
			<div class="rhead"><span class="lbl">Citations</span><button type="button" onclick={addCitation}><Icon name="book-open" size={13} /> Add</button></div>
			{#each citations as c, i (i)}
				<div class="citrow">
					<input class="celex" bind:value={c.celex} placeholder="CELEX e.g. 32016R0679" />
					<input bind:value={c.title} placeholder="Title" />
					<input class="loc" bind:value={c.locator} placeholder="Art. 30(1)" />
					<input bind:value={c.snippet} placeholder="Quoted excerpt (optional)" />
					<button type="button" class="rm" onclick={() => removeCitation(i)} aria-label="Remove"><Icon name="x" size={14} /></button>
				</div>
			{/each}
		</div>

		<div class="repeat">
			<div class="rhead"><span class="lbl">Risk signals</span><button type="button" onclick={addRisk}><Icon name="shield-alert" size={13} /> Add</button></div>
			{#each risks as r, i (i)}
				<div class="riskrow">
					<select bind:value={r.category}>
						<option value="hallucination">Hallucination</option>
						<option value="jurisdiction">Jurisdiction</option>
						<option value="missing_authority">Missing authority</option>
						<option value="conflict">Conflict</option>
						<option value="deadline">Deadline</option>
					</select>
					<select bind:value={r.severity}>
						<option value="low">Low</option>
						<option value="med">Medium</option>
						<option value="high">High</option>
					</select>
					<input bind:value={r.rationale} placeholder="Why this is a risk" />
					<button type="button" class="rm" onclick={() => removeRisk(i)} aria-label="Remove"><Icon name="x" size={14} /></button>
				</div>
			{/each}
		</div>
	{/if}

	{#if error}
		<p class="err"><Icon name="triangle-alert" size={14} /> {error}</p>
	{/if}

	<div class="actions">
		<a class="cancel" href="/">Cancel</a>
		<button class="submit" type="submit" disabled={submitting}>
			{submitting ? 'Submitting…' : 'Submit to queue'}
			<Icon name="arrow-right" size={16} />
		</button>
	</div>
</form>

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
	.form {
		max-width: 760px;
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		background: var(--surface-card);
		border: 1.5px solid var(--border-default);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-sm);
		padding: var(--space-5);
	}
	.toggle {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: var(--text-sm);
		color: var(--text-secondary);
	}
	.ex {
		margin-left: auto;
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--text-link);
		background: none;
		border: none;
		cursor: pointer;
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
	.json {
		width: 100%;
		font-family: var(--font-sans);
		font-size: var(--text-base);
		color: var(--text-primary);
		background: var(--surface-card);
		border: 1.5px solid var(--border-strong);
		border-radius: var(--radius-md);
		padding: 9px 11px;
	}
	.json {
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
	.citrow {
		display: grid;
		grid-template-columns: 1.2fr 1.4fr 0.9fr 1.6fr auto;
		gap: 6px;
		align-items: center;
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
		justify-content: flex-end;
		gap: 14px;
		margin-top: var(--space-2);
	}
	.cancel {
		font-size: var(--text-sm);
		color: var(--text-secondary);
		text-decoration: none;
	}
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
		height: 42px;
		padding: 0 var(--space-5);
		cursor: pointer;
	}
	.submit:hover {
		background: var(--color-accent-hover);
	}
	.submit:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	@media (max-width: 640px) {
		.grid2,
		.citrow,
		.riskrow {
			grid-template-columns: 1fr;
		}
	}
</style>
