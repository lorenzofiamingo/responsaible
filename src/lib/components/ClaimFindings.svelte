<script lang="ts">
	import Badge from './Badge.svelte';
	import Icon from './Icon.svelte';
	import {
		CLAIM_STATE,
		claimState,
		RISK_CATEGORY,
		SEVERITY,
		VERDICT,
		type ClaimState,
		type ClaimStateInfo
	} from '$lib/format';
	import type { AtomicClaim } from '$lib/types';

	let {
		claims,
		workspaceHref,
		infoById
	}: {
		claims: AtomicClaim[];
		workspaceHref: string;
		infoById?: Record<string, ClaimStateInfo>;
	} = $props();

	const sevRank: Record<string, number> = { high: 3, med: 2, low: 1 };
	// The supervisor triages claims worst-first: needs-attention, then review, then
	// the ones still to run, then the clear ones.
	const ORDER: ClaimState[] = ['attention', 'caution', 'unrun', 'clear'];

	const groups = $derived.by(() => {
		const by: Record<ClaimState, AtomicClaim[]> = { attention: [], caution: [], unrun: [], clear: [] };
		for (const c of claims) by[claimState(c, infoById?.[c.id])].push(c);
		for (const k of ORDER) {
			by[k].sort((a, b) => {
				const s = (sevRank[b.riskSeverity ?? ''] ?? 0) - (sevRank[a.riskSeverity ?? ''] ?? 0);
				if (s) return s;
				const conf = a.confidence - b.confidence;
				if (conf) return conf;
				return a.idx - b.idx;
			});
		}
		return ORDER.filter((k) => by[k].length > 0).map((k) => ({ state: k, claims: by[k] }));
	});

	function snippet(t: string): string {
		const s = t.trim();
		return s.length > 96 ? s.slice(0, 96) + '…' : s;
	}
</script>

{#if claims.length === 0}
	<p class="empty">No atomic claims to review.</p>
{:else}
	<div class="groups">
		{#each groups as g (g.state)}
			<div class="group">
				<h4 class="ghead tone-{CLAIM_STATE[g.state].tone}">
					<Icon name={CLAIM_STATE[g.state].icon} size={12} />
					{CLAIM_STATE[g.state].label}
					<span class="gcount">{g.claims.length}</span>
				</h4>
				<ul class="list">
					{#each g.claims as c (c.id)}
						<li>
							<a class="row" href={`${workspaceHref}?claim=${c.id}`}>
								<span class="idx">{c.idx + 1}</span>
								<span class="txt">{snippet(c.text)}</span>
								<span class="badges">
									{#if g.state === 'unrun'}
										<span class="pending"><Icon name="circle-alert" size={11} /> Not yet run</span>
									{:else}
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
										{#if infoById?.[c.id]?.undermined}
											<span class="undermined" title="Rests on a weaker premise">
												<Icon name="triangle-alert" size={11} /> undermined
											</span>
										{/if}
										<span class="pct">{Math.round(c.confidence * 100)}%</span>
									{/if}
									<Icon name="arrow-right" size={14} class="go" />
								</span>
							</a>
						</li>
					{/each}
				</ul>
			</div>
		{/each}
	</div>
{/if}

<style>
	.groups {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}
	.group {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.ghead {
		display: flex;
		align-items: center;
		gap: 6px;
		margin: 0;
		font-family: var(--font-display);
		font-size: var(--text-xs);
		font-weight: var(--weight-semibold);
		letter-spacing: 0.02em;
		text-transform: uppercase;
		color: var(--gt, var(--text-secondary));
	}
	.ghead.tone-danger {
		--gt: var(--status-danger-fg);
	}
	.ghead.tone-warning {
		--gt: var(--status-warning-fg);
	}
	.ghead.tone-success {
		--gt: var(--status-success-fg);
	}
	.ghead.tone-neutral {
		--gt: var(--text-secondary);
	}
	.gcount {
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: var(--weight-regular);
		color: var(--text-tertiary);
	}
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
	.pending {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: var(--text-xs);
		color: var(--text-tertiary);
	}
	.pct {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--text-tertiary);
	}
	.undermined {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
		color: var(--status-danger-fg);
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
