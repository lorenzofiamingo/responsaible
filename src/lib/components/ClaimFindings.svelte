<script lang="ts">
	import Badge from './Badge.svelte';
	import Icon from './Icon.svelte';
	import { RISK_CATEGORY, SEVERITY, VERDICT } from '$lib/format';
	import type { AtomicClaim } from '$lib/types';

	let { claims, workspaceHref }: { claims: AtomicClaim[]; workspaceHref: string } = $props();

	const sevRank: Record<string, number> = { high: 3, med: 2, low: 1 };

	// Riskiest first: worst severity, then weakest verdict, then lowest confidence.
	const ranked = $derived(
		[...claims]
			.sort((a, b) => {
				const s = (sevRank[b.riskSeverity ?? ''] ?? 0) - (sevRank[a.riskSeverity ?? ''] ?? 0);
				if (s) return s;
				return a.confidence - b.confidence;
			})
			.slice(0, 6)
	);

	function snippet(t: string): string {
		const s = t.trim();
		return s.length > 96 ? s.slice(0, 96) + '…' : s;
	}
</script>

{#if ranked.length === 0}
	<p class="empty">No atomic claims to review.</p>
{:else}
	<ul class="list">
		{#each ranked as c (c.id)}
			<li>
				<a class="row" href={`${workspaceHref}?claim=${c.id}`}>
					<span class="idx">{c.idx + 1}</span>
					<span class="txt">{snippet(c.text)}</span>
					<span class="badges">
						{#if c.verdict}
							<Badge tone={VERDICT[c.verdict]?.tone ?? 'neutral'}>
								<Icon name={VERDICT[c.verdict]?.icon ?? 'circle-alert'} size={11} />
								{VERDICT[c.verdict]?.label ?? c.verdict}
							</Badge>
						{/if}
						{#if c.riskSeverity && c.riskCategory}
							<Badge tone={SEVERITY[c.riskSeverity]?.tone ?? 'neutral'}>
								<Icon name={RISK_CATEGORY[c.riskCategory]?.icon ?? 'shield-alert'} size={11} />
								{SEVERITY[c.riskSeverity]?.label}
							</Badge>
						{/if}
						<span class="pct">{Math.round(c.confidence * 100)}%</span>
						<Icon name="arrow-right" size={14} class="go" />
					</span>
				</a>
			</li>
		{/each}
	</ul>
{/if}

<style>
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.row {
		display: grid;
		grid-template-columns: 26px 1fr auto;
		align-items: center;
		gap: var(--space-3);
		padding: 10px 12px;
		border: 1.5px solid var(--border-default);
		border-radius: var(--radius-md);
		background: var(--surface-card);
		text-decoration: none;
		color: inherit;
		transition: border-color var(--duration-fast) var(--ease-out), background var(--duration-fast) var(--ease-out);
	}
	.row:hover {
		border-color: var(--color-accent);
		background: var(--terracotta-50);
	}
	.idx {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		border-radius: var(--radius-sm);
		background: var(--surface-sunken);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--text-tertiary);
	}
	.txt {
		font-size: var(--text-sm);
		color: var(--text-primary);
		line-height: var(--leading-snug);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.badges {
		display: inline-flex;
		align-items: center;
		gap: 8px;
	}
	.pct {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--text-tertiary);
	}
	.badges :global(.go) {
		color: var(--text-tertiary);
	}
	.empty {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--text-tertiary);
	}
</style>
