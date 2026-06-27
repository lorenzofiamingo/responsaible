<script lang="ts">
	import type { RiskSignal } from '$lib/types';
	import Icon from './Icon.svelte';
	import RiskBadge from './RiskBadge.svelte';

	let { signals }: { signals: RiskSignal[] } = $props();
</script>

{#if signals.length === 0}
	<p class="none">
		<Icon name="shield-check" size={15} color="var(--status-success-fg)" />
		No risk signals raised on this work product.
	</p>
{:else}
	<ul class="risks">
		{#each signals as r (r.id)}
			<li class="risk sev-{r.severity}">
				<div class="rh">
					<RiskBadge category={r.category} severity={r.severity} />
					<span class="conf">{Math.round(r.confidence * 100)}% confidence</span>
				</div>
				<p class="rationale">{r.rationale}</p>
			</li>
		{/each}
	</ul>
{/if}

<style>
	.none {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 0;
		font-size: var(--text-sm);
		color: var(--text-secondary);
	}
	.risks {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.risk {
		border: 1.5px solid var(--border-default);
		border-left: 3px solid var(--border-strong);
		border-radius: var(--radius-md);
		padding: var(--space-3) var(--space-4);
		background: var(--surface-card);
	}
	.risk.sev-high {
		border-left-color: var(--status-danger-fg);
		background: var(--status-danger-bg);
	}
	.risk.sev-med {
		border-left-color: var(--status-warning-fg);
	}
	.risk.sev-low {
		border-left-color: var(--neutral-300);
	}
	.rh {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 6px;
	}
	.conf {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--text-tertiary);
	}
	.rationale {
		margin: 0;
		font-size: var(--text-sm);
		line-height: var(--leading-normal);
		color: var(--text-secondary);
	}
</style>
