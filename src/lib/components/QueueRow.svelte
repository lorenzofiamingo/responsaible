<script lang="ts">
	import Badge from '$lib/components/Badge.svelte';
	import ConfidenceMeter from '$lib/components/ConfidenceMeter.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import InfoTip from '$lib/components/InfoTip.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import { WP_TYPE } from '$lib/format';
	import type { QueueRowData } from '$lib/types';

	// One work product as a queue row. `showMatter` is on for the cross-matter queue
	// and off on a matter's own page, where the matter label would just be noise.
	let { wp, showMatter = true }: { wp: QueueRowData; showMatter?: boolean } = $props();
</script>

<a class="row" href="/work-products/{wp.id}">
	<div class="pri" title="Priority score">
		<span class="pn">{wp.priority}</span>
		<span class="pl">priority</span>
	</div>

	<div class="main">
		<div class="toprow">
			<InfoTip align="left" focusable={false}>
				{#snippet label()}
					<span class="type"><Icon name={WP_TYPE[wp.type].icon} size={13} /> {WP_TYPE[wp.type].label}</span>
				{/snippet}
				<strong>{WP_TYPE[wp.type].label}</strong>
				<p>{WP_TYPE[wp.type].desc}</p>
			</InfoTip>
			{#if showMatter}
				<span class="matter">{wp.matterName} · <span class="ref">{wp.matterRef}</span></span>
			{/if}
		</div>
		<h2 class="title">{wp.title}</h2>
		<p class="summary">{wp.summary}</p>
		<div class="badges">
			<StatusBadge status={wp.status} />
			{#if wp.risk.high > 0}
				<Badge tone="danger"><Icon name="triangle-alert" size={12} /> {wp.risk.high} high-severity risk</Badge>
			{:else if wp.risk.med > 0}
				<Badge tone="warning"><Icon name="shield-alert" size={12} /> {wp.risk.med} medium risk</Badge>
			{:else if wp.risk.total > 0}
				<Badge tone="neutral"><Icon name="shield" size={12} /> {wp.risk.total} low risk</Badge>
			{:else}
				<Badge tone="success"><Icon name="shield-check" size={12} /> No risk flags</Badge>
			{/if}
			<span class="cites"><Icon name="book-open" size={13} /> {wp.citationCount} sources</span>
		</div>
	</div>

	<div class="right">
		<span class="conf">
			{#if wp.assessed.mean !== null}
				<ConfidenceMeter value={wp.assessed.mean} />
				<span class="conf-tag" title="Mean confidence across the claims analyzed so far">
					{wp.assessed.analyzed}/{wp.assessed.total} claims assessed
				</span>
			{:else}
				<ConfidenceMeter value={wp.confidence} />
				<span
					class="conf-tag est"
					title="The generating agent's self-reported confidence — not yet verified per claim"
				>self-reported · run to assess</span>
			{/if}
		</span>
		<Icon name="chevron-right" size={18} color="var(--text-tertiary)" />
	</div>
</a>

<style>
	.row {
		display: grid;
		grid-template-columns: 64px 1fr auto;
		gap: var(--space-4);
		align-items: center;
		background: var(--surface-card);
		border: 1.5px solid var(--border-default);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-xs);
		padding: var(--space-4) var(--space-5);
		text-decoration: none;
		color: inherit;
		transition:
			box-shadow var(--duration-normal) var(--ease-out),
			transform var(--duration-normal) var(--ease-out),
			border-color var(--duration-fast) var(--ease-out);
	}
	.row:hover {
		box-shadow: var(--shadow-md);
		transform: translateY(-2px);
		border-color: var(--border-strong);
	}
	.pri {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		gap: 2px;
		height: 100%;
	}
	.pn {
		font-family: var(--font-display);
		font-size: var(--text-xl);
		font-weight: var(--weight-semibold);
		color: var(--text-primary);
	}
	.pl {
		font-family: var(--font-mono);
		font-size: 9px;
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--text-tertiary);
	}
	.main {
		min-width: 0;
	}
	.toprow {
		display: flex;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
		margin-bottom: 4px;
	}
	.type {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
		color: var(--color-accent);
	}
	.matter {
		font-size: var(--text-xs);
		color: var(--text-tertiary);
	}
	.matter .ref {
		font-family: var(--font-mono);
	}
	.title {
		font-size: var(--text-md);
		font-weight: var(--weight-semibold);
		margin: 0 0 4px;
		line-height: var(--leading-snug);
	}
	.summary {
		margin: 0 0 10px;
		font-size: var(--text-sm);
		color: var(--text-secondary);
		line-height: var(--leading-normal);
		max-width: 80ch;
	}
	.badges {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}
	.cites {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: var(--text-xs);
		color: var(--text-tertiary);
	}
	.right {
		display: flex;
		align-items: center;
		gap: 14px;
	}
	.conf {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 4px;
	}
	.conf-tag {
		font-size: 10px;
		font-family: var(--font-mono);
		color: var(--text-tertiary);
		white-space: nowrap;
	}
	.conf-tag.est {
		font-style: italic;
		color: var(--text-tertiary);
		opacity: 0.85;
	}

	@media (max-width: 720px) {
		.row {
			grid-template-columns: 48px 1fr;
		}
		.right {
			grid-column: 2;
			justify-content: flex-start;
		}
	}
</style>
