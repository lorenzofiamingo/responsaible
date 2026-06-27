<script lang="ts">
	import ConfidenceMeter from './ConfidenceMeter.svelte';
	import Icon from './Icon.svelte';
	import type { AtomicClaim, Citation, RiskSignal } from '$lib/types';

	let {
		confidence,
		claims,
		citations,
		risks,
		workspaceHref
	}: {
		confidence: number;
		claims: AtomicClaim[];
		citations: Citation[];
		risks: RiskSignal[];
		workspaceHref: string;
	} = $props();

	const analyzed = $derived(claims.filter((c) => c.status === 'analyzed').length);

	const risk = $derived({
		high: risks.filter((r) => r.severity === 'high').length,
		med: risks.filter((r) => r.severity === 'med').length,
		low: risks.filter((r) => r.severity === 'low').length
	});
	const cites = $derived({
		verified: citations.filter((c) => c.verifyStatus === 'verified').length,
		unresolved: citations.filter((c) => c.verifyStatus === 'unresolved').length,
		unchecked: citations.filter((c) => c.verifyStatus === 'unchecked').length
	});
	// A flagged/unsupported claim or an unresolved citation is the strongest signal.
	const flagged = $derived(
		claims.filter((c) => c.verdict === 'unsupported' || c.verdict === 'flag').length
	);

	const verdict = $derived.by(() => {
		if (risk.high > 0 || cites.unresolved > 0 || flagged > 0)
			return { label: 'Needs attention', tone: 'danger', icon: 'shield-alert' } as const;
		if (risk.med > 0) return { label: 'Review recommended', tone: 'warning', icon: 'scale' } as const;
		return { label: 'Looks sound', tone: 'success', icon: 'shield-check' } as const;
	});
</script>

<section class="overview tone-{verdict.tone}">
	<div class="lead">
		<span class="rec"><Icon name={verdict.icon} size={15} /> {verdict.label}</span>
		<ConfidenceMeter value={confidence} />
	</div>

	<div class="stats">
		<div class="stat">
			<span class="num">{analyzed}<span class="den">/{claims.length}</span></span>
			<span class="lbl"><Icon name="list-checks" size={12} /> Claims run</span>
		</div>
		<div class="stat">
			<span class="num" class:bad={risk.high > 0} class:warn={risk.high === 0 && risk.med > 0}>
				{risk.high + risk.med + risk.low}
			</span>
			<span class="lbl"><Icon name="shield-alert" size={12} /> Risk signals</span>
			{#if risk.high + risk.med + risk.low > 0}
				<span class="sub">{risk.high} high · {risk.med} med · {risk.low} low</span>
			{/if}
		</div>
		<div class="stat">
			<span class="num" class:bad={cites.unresolved > 0}>{cites.verified}<span class="den">/{citations.length}</span></span>
			<span class="lbl"><Icon name="book-open" size={12} /> Citations verified</span>
			{#if cites.unresolved > 0}
				<span class="sub bad">{cites.unresolved} unresolved</span>
			{:else if cites.unchecked > 0}
				<span class="sub">{cites.unchecked} unchecked</span>
			{/if}
		</div>
	</div>

	<a class="cta" href={workspaceHref}>
		<Icon name="git-branch" size={15} /> Open work area
		<Icon name="arrow-right" size={14} />
	</a>
</section>

<style>
	.overview {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: var(--space-5);
		background: var(--surface-card);
		border: 1.5px solid var(--border-default);
		border-left: 3px solid var(--tone, var(--border-strong));
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-sm);
		padding: var(--space-4) var(--space-5);
	}
	.tone-danger {
		--tone: var(--status-danger-fg);
	}
	.tone-warning {
		--tone: var(--status-warning-fg);
	}
	.tone-success {
		--tone: var(--status-success-fg);
	}
	.lead {
		display: flex;
		flex-direction: column;
		gap: 8px;
		align-items: flex-start;
	}
	.rec {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-family: var(--font-display);
		font-weight: var(--weight-semibold);
		font-size: var(--text-md);
		color: var(--tone, var(--text-primary));
	}
	.stats {
		display: flex;
		gap: var(--space-6);
		justify-content: center;
		flex-wrap: wrap;
	}
	.stat {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.num {
		font-family: var(--font-display);
		font-size: var(--text-xl);
		font-weight: var(--weight-semibold);
		line-height: 1;
		color: var(--text-primary);
	}
	.num.bad {
		color: var(--status-danger-fg);
	}
	.num.warn {
		color: var(--status-warning-fg);
	}
	.den {
		font-size: var(--text-md);
		color: var(--text-tertiary);
		font-weight: var(--weight-regular);
	}
	.lbl {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: var(--text-xs);
		color: var(--text-tertiary);
	}
	.sub {
		font-size: 10px;
		font-family: var(--font-mono);
		color: var(--text-tertiary);
	}
	.sub.bad {
		color: var(--status-danger-fg);
	}
	.cta {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		white-space: nowrap;
		font-family: var(--font-display);
		font-weight: var(--weight-medium);
		font-size: var(--text-sm);
		color: var(--color-on-accent);
		background: var(--color-accent);
		border-radius: var(--radius-md);
		padding: 9px 14px;
		text-decoration: none;
		transition: background var(--duration-fast) var(--ease-out);
	}
	.cta:hover {
		background: var(--color-accent-hover);
	}

	@media (max-width: 760px) {
		.overview {
			grid-template-columns: 1fr;
		}
		.stats {
			justify-content: flex-start;
		}
	}
</style>
