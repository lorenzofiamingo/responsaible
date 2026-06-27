<script lang="ts">
	import Badge from '$lib/components/Badge.svelte';
	import ConfidenceMeter from '$lib/components/ConfidenceMeter.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import { WP_TYPE } from '$lib/format';

	let { data } = $props();
</script>

<section class="head">
	<span class="itaily-eyebrow">Supervision queue</span>
	<h1>Work awaiting your review</h1>
	<p class="sub">
		AI-generated work products, ordered by priority and lowest confidence first — so the items most
		needing a human are at the top.
	</p>
</section>

<div class="stats">
	<div class="stat">
		<span class="n">{data.stats.pending}</span><span class="l">Pending review</span>
	</div>
	<div class="stat">
		<span class="n">{data.stats.highRisk}</span><span class="l">With high-severity risk</span>
	</div>
	<div class="stat">
		<span class="n">{data.stats.lowConfidence}</span><span class="l">Low confidence</span>
	</div>
	<div class="stat">
		<span class="n">{data.stats.total}</span><span class="l">Total in queue</span>
	</div>
</div>

<ul class="queue">
	{#each data.queue as wp (wp.id)}
		<li>
			<a class="row" href="/work-products/{wp.id}">
				<div class="pri" title="Priority score">
					<span class="pn">{wp.priority}</span>
					<span class="pl">priority</span>
				</div>

				<div class="main">
					<div class="toprow">
						<span class="type"><Icon name={WP_TYPE[wp.type].icon} size={13} /> {WP_TYPE[wp.type].label}</span>
						<span class="matter">{wp.matterName} · <span class="ref">{wp.matterRef}</span></span>
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
					<ConfidenceMeter value={wp.confidence} />
					<Icon name="chevron-right" size={18} color="var(--text-tertiary)" />
				</div>
			</a>
		</li>
	{/each}
</ul>

<style>
	.head {
		margin-bottom: var(--space-5);
	}
	.head h1 {
		font-size: var(--text-2xl);
		margin: 6px 0 8px;
	}
	.sub {
		margin: 0;
		max-width: 64ch;
		color: var(--text-secondary);
		font-size: var(--text-md);
		line-height: var(--leading-normal);
	}

	.stats {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 12px;
		margin-bottom: var(--space-6);
	}
	.stat {
		background: var(--surface-card);
		border: 1.5px solid var(--border-default);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-xs);
		padding: var(--space-4) var(--space-5);
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.stat .n {
		font-family: var(--font-display);
		font-size: var(--text-2xl);
		font-weight: var(--weight-semibold);
		letter-spacing: var(--tracking-tight);
		color: var(--text-primary);
	}
	.stat .l {
		font-size: var(--text-xs);
		color: var(--text-tertiary);
	}

	.queue {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
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

	@media (max-width: 720px) {
		.stats {
			grid-template-columns: repeat(2, 1fr);
		}
		.row {
			grid-template-columns: 48px 1fr;
		}
		.right {
			grid-column: 2;
			justify-content: flex-start;
		}
	}
</style>
