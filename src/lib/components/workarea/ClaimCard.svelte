<script lang="ts">
	import Badge from '$lib/components/Badge.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import type { ClaimGraphInfo } from '$lib/claim-graph';
	import { CLAIM_KIND, RISK_CATEGORY, SEVERITY, VERDICT } from '$lib/format';
	import type { AtomicClaim, ClaimRunResult } from '$lib/types';

	let {
		claim,
		selected,
		status,
		result,
		info,
		groupLabel,
		onSelect,
		onRun
	}: {
		claim: AtomicClaim;
		selected: boolean;
		status: string;
		result: ClaimRunResult | undefined;
		info?: ClaimGraphInfo;
		groupLabel: string;
		onSelect: () => void;
		onRun: () => void;
	} = $props();

	const kind = $derived(CLAIM_KIND[claim.kind] ?? CLAIM_KIND.assertion);
</script>

<div class="card" class:sel={selected} class:running={status === 'running'} class:undermined={info?.undermined}>
	<button type="button" class="hit" onclick={onSelect}>
		<div class="top">
			<span class="idx">{claim.idx + 1}</span>
			<span class="kind"><Icon name={kind.icon} size={11} /> {kind.label}</span>
			{#if info?.loadBearing}
				<span class="bearing" title="{info.dependentCount} claims rest on this one">
					<Icon name="git-branch" size={10} /> load-bearing
				</span>
			{/if}
			<span class="group" title="Work group">{groupLabel}</span>
		</div>
		<p class="snippet">{claim.text}</p>
		<div class="foot">
			{#if status === 'running'}
				<span class="run-state"><Icon name="sparkles" size={12} /> Analyzing…</span>
			{:else if status === 'analyzed' && result}
				{#if result.verdict}
					<Badge tone={VERDICT[result.verdict]?.tone ?? 'neutral'}>
						<Icon name={VERDICT[result.verdict]?.icon ?? 'circle-check'} size={10} />
						{VERDICT[result.verdict]?.label}
					</Badge>
				{/if}
				{#if result.riskSeverity && result.riskCategory}
					<Badge tone={SEVERITY[result.riskSeverity]?.tone ?? 'neutral'}>
						<Icon name={RISK_CATEGORY[result.riskCategory]?.icon ?? 'shield-alert'} size={10} />
						{SEVERITY[result.riskSeverity]?.label}
					</Badge>
				{/if}
				<span class="pct">{Math.round(result.confidence * 100)}%</span>
				{#if info?.undermined}
					<span class="warn" title="Rests on a weaker premise">
						<Icon name="triangle-alert" size={11} /> rests on {VERDICT[info.inheritedVerdict ?? '']?.label?.toLowerCase() ?? 'a weaker'} premise
					</span>
				{/if}
			{:else}
				<span class="pending">Not analyzed</span>
			{/if}
		</div>
	</button>
	<button type="button" class="run" onclick={onRun} disabled={status === 'running'} title="Run this claim">
		<Icon name={status === 'analyzed' ? 'rotate-ccw' : 'sparkles'} size={13} />
	</button>
</div>

<style>
	.card {
		position: relative;
		display: flex;
		border: 1.5px solid var(--border-default);
		border-radius: var(--radius-md);
		background: var(--surface-card);
		transition: border-color var(--duration-fast) var(--ease-out);
	}
	.card:hover {
		border-color: var(--border-strong);
	}
	.card.sel {
		border-color: var(--color-accent);
		box-shadow: var(--shadow-focus);
	}
	.card.running {
		border-color: var(--color-accent);
	}
	.card.undermined {
		border-color: var(--status-danger-fg);
	}
	.hit {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 10px 12px;
		background: transparent;
		border: none;
		text-align: left;
		cursor: pointer;
	}
	.top {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.idx {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		border-radius: var(--radius-sm);
		background: var(--surface-sunken);
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--text-tertiary);
		flex: none;
	}
	.kind {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
		color: var(--text-tertiary);
	}
	.bearing {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
		color: var(--color-accent-active);
	}
	.group {
		margin-left: auto;
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--text-tertiary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 40%;
	}
	.snippet {
		margin: 0;
		font-size: var(--text-sm);
		line-height: var(--leading-snug);
		color: var(--text-primary);
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.foot {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
	}
	.pct {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--text-tertiary);
	}
	.pending {
		font-size: var(--text-xs);
		color: var(--text-tertiary);
	}
	.warn {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 10px;
		color: var(--status-danger-fg);
	}
	.run-state {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: var(--text-xs);
		color: var(--color-accent-active);
		animation: pulse 1.1s var(--ease-in-out) infinite;
	}
	.run {
		flex: none;
		width: 38px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		border-left: 1.5px solid var(--border-subtle);
		color: var(--text-secondary);
		cursor: pointer;
		transition: all var(--duration-fast) var(--ease-out);
	}
	.run:hover:not(:disabled) {
		background: var(--terracotta-50);
		color: var(--color-accent-active);
	}
	.run:disabled {
		opacity: 0.5;
		cursor: progress;
	}
	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}
</style>
