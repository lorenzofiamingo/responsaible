<script lang="ts">
	import AuditTrail from '$lib/components/AuditTrail.svelte';
	import ConfidenceMeter from '$lib/components/ConfidenceMeter.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import RiskSignalPanel from '$lib/components/RiskSignalPanel.svelte';
	import SourceCard from '$lib/components/SourceCard.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import SupervisoryActions from '$lib/components/SupervisoryActions.svelte';
	import TraceTimeline from '$lib/components/TraceTimeline.svelte';
	import { fmtDateTime, WP_TYPE } from '$lib/format';
	import { invalidateAll } from '$app/navigation';

	let { data, form } = $props();

	// Split the body into text runs and [n] citation markers.
	const segments = $derived.by(() => {
		const out: Array<{ t: string } | { m: number }> = [];
		const body = data.wp.body ?? '';
		const re = /\[(\d+)\]/g;
		let last = 0;
		let mm: RegExpExecArray | null;
		while ((mm = re.exec(body)) !== null) {
			if (mm.index > last) out.push({ t: body.slice(last, mm.index) });
			out.push({ m: Number(mm[1]) });
			last = mm.index + mm[0].length;
		}
		if (last < body.length) out.push({ t: body.slice(last) });
		return out;
	});

	const unresolved = $derived(data.citations.filter((c) => c.verifyStatus === 'unresolved').length);
	const unchecked = $derived(data.citations.filter((c) => c.verifyStatus === 'unchecked').length);

	let verifyingCites = $state(false);
	async function verifyCitations() {
		verifyingCites = true;
		try {
			await fetch('/api/cellar/verify', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ workProductId: data.wp.id })
			});
			await invalidateAll();
		} finally {
			verifyingCites = false;
		}
	}
</script>

<a class="back" href="/"><Icon name="arrow-right" size={14} class="flip" /> Back to queue</a>

<header class="hdr">
	<div class="eyebrow itaily-eyebrow">
		<Icon name={WP_TYPE[data.wp.type].icon} size={12} />
		{WP_TYPE[data.wp.type].label} · {data.wp.matterName} · {data.wp.matterRef}
	</div>
	<h1>{data.wp.title}</h1>
	<p class="summary">{data.wp.summary}</p>
	<div class="meta">
		<StatusBadge status={data.wp.status} />
		<ConfidenceMeter value={data.wp.confidence} />
		<span class="m"><Icon name="sparkles" size={13} /> {data.wp.agentName}</span>
		<span class="m mono">{data.wp.model}</span>
		<span class="m mono"><Icon name="clock" size={12} /> {fmtDateTime(data.wp.createdAt)}</span>
	</div>
</header>

<div class="grid">
	<div class="col-main">
		<section class="panel source">
			<h2 class="ptitle"><Icon name="file-text" size={16} /> AI work product</h2>
			<div class="prose">
				{#each segments as seg, i (i)}
					{#if 'm' in seg}<a class="cmark" href="#src-{seg.m}" title="Jump to source {seg.m}"
							><span class="cnum">{seg.m}</span></a
						>{:else}{seg.t}{/if}
				{/each}
			</div>
			<p class="advice">
				<Icon name="scale" size={12} /> Informational draft produced by an AI agent — not advice until
				a supervising lawyer signs it off.
			</p>
		</section>

		<section class="panel">
			<h2 class="ptitle">
				<Icon name="shield-alert" size={16} /> Risk signals
				<span class="count">{data.risks.length}</span>
			</h2>
			<RiskSignalPanel signals={data.risks} />
		</section>

		<section class="panel">
			<h2 class="ptitle">
				<Icon name="git-branch" size={16} /> What the AI did
				<span class="count">{data.actions.length} steps</span>
			</h2>
			<p class="phint">The agent's recorded actions and reasoning — from search to draft to self-critique.</p>
			<TraceTimeline actions={data.actions} />
		</section>
	</div>

	<aside class="col-rail">
		<section class="panel decide">
			<h2 class="ptitle"><Icon name="gavel" size={16} /> Your decision</h2>
			<p class="phint">Approve, amend, reject, request rework, escalate, or override. Reasons are required for the serious ones and recorded immutably.</p>
			<SupervisoryActions {form} />
		</section>

		<section class="panel">
			<h2 class="ptitle">
				<Icon name="book-open" size={16} /> Sources
				<span class="count">{data.citations.length}</span>
			</h2>
			<button class="verify-cites" onclick={verifyCitations} disabled={verifyingCites}>
				<Icon name="shield-check" size={14} />
				{verifyingCites
					? 'Checking EU CELLAR…'
					: unchecked > 0
						? 'Verify citations against EU CELLAR'
						: 'Re-verify citations'}
			</button>
			{#if unresolved > 0}
				<p class="warn"><Icon name="triangle-alert" size={13} /> {unresolved} citation{unresolved > 1 ? 's' : ''} could not be resolved against EU law — likely a fabricated authority.</p>
			{/if}
			<div class="sources">
				{#each data.citations as c (c.id)}
					<div id="src-{c.marker}"><SourceCard citation={c} /></div>
				{/each}
			</div>
		</section>

		<section class="panel">
			<h2 class="ptitle"><Icon name="history" size={16} /> Audit trail</h2>
			<AuditTrail entries={data.audit} />
		</section>
	</aside>
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
	.back:hover {
		color: var(--text-link);
	}
	.back :global(.flip) {
		transform: rotate(180deg);
	}

	.hdr {
		margin-bottom: var(--space-5);
	}
	.eyebrow {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		margin-bottom: 8px;
	}
	.hdr h1 {
		font-size: var(--text-xl);
		margin: 0 0 8px;
		line-height: var(--leading-snug);
	}
	.summary {
		margin: 0 0 14px;
		max-width: 80ch;
		font-size: var(--text-md);
		color: var(--text-secondary);
		line-height: var(--leading-normal);
	}
	.meta {
		display: flex;
		align-items: center;
		gap: 16px;
		flex-wrap: wrap;
	}
	.meta .m {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: var(--text-xs);
		color: var(--text-tertiary);
	}
	.meta .mono {
		font-family: var(--font-mono);
	}

	.grid {
		display: grid;
		grid-template-columns: minmax(0, 1.7fr) minmax(330px, 1fr);
		gap: var(--space-5);
		align-items: start;
	}
	.col-main,
	.col-rail {
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
		min-width: 0;
	}

	.panel {
		background: var(--surface-card);
		border: 1.5px solid var(--border-default);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-sm);
		padding: var(--space-5);
	}
	.panel.source {
		border-left: 3px solid var(--color-accent);
	}
	.panel.decide {
		border-left: 3px solid var(--color-accent);
	}
	.ptitle {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: var(--text-md);
		margin: 0 0 var(--space-4);
	}
	.ptitle .count {
		margin-left: auto;
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--text-tertiary);
		font-weight: var(--weight-regular);
	}
	.phint {
		margin: -8px 0 var(--space-4);
		font-size: var(--text-sm);
		color: var(--text-tertiary);
		line-height: var(--leading-normal);
	}

	.prose {
		font-size: var(--text-base);
		line-height: var(--leading-relaxed);
		color: var(--text-primary);
		white-space: pre-wrap;
	}
	.cmark {
		text-decoration: none;
		vertical-align: baseline;
	}
	.cnum {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 16px;
		height: 16px;
		padding: 0 4px;
		margin: 0 1px;
		border-radius: 4px;
		background: var(--terracotta-50);
		border: 1.5px solid var(--terracotta-200);
		color: var(--terracotta-700);
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 700;
		transition: background var(--duration-fast) var(--ease-out);
	}
	.cmark:hover .cnum {
		background: var(--color-accent);
		color: var(--color-on-accent);
	}
	.advice {
		display: flex;
		align-items: center;
		gap: 6px;
		margin: var(--space-4) 0 0;
		padding-top: var(--space-3);
		border-top: 1.5px solid var(--border-subtle);
		font-size: var(--text-xs);
		color: var(--text-tertiary);
	}
	.verify-cites {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		width: 100%;
		justify-content: center;
		margin-bottom: var(--space-3);
		padding: 9px 12px;
		font-family: var(--font-display);
		font-weight: var(--weight-medium);
		font-size: var(--text-sm);
		color: var(--text-primary);
		background: var(--surface-card);
		border: 1.5px solid var(--border-strong);
		border-radius: var(--radius-md);
		cursor: pointer;
		transition: all var(--duration-fast) var(--ease-out);
	}
	.verify-cites:hover {
		border-color: var(--color-accent);
		background: var(--terracotta-50);
	}
	.verify-cites:disabled {
		opacity: 0.6;
		cursor: progress;
	}
	.warn {
		display: flex;
		align-items: center;
		gap: 6px;
		margin: 0 0 var(--space-3);
		padding: 8px 10px;
		background: var(--status-danger-bg);
		color: var(--status-danger-fg);
		border-radius: var(--radius-sm);
		font-size: var(--text-xs);
		font-weight: var(--weight-medium);
	}
	.sources {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	@media (max-width: 900px) {
		.grid {
			grid-template-columns: 1fr;
		}
	}
</style>
