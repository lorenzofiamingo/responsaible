<script lang="ts">
	import Badge from '$lib/components/Badge.svelte';
	import ConfidenceMeter from '$lib/components/ConfidenceMeter.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import RiskBadge from '$lib/components/RiskBadge.svelte';
	import SourceCard from '$lib/components/SourceCard.svelte';
	import type { ClaimGraphInfo } from '$lib/claim-graph';
	import { CLAIM_KIND, CLAIM_RELATION, TRACE_KIND, VERDICT } from '$lib/format';
	import { FIGURE_ROLE, MODELS, type WorkGroup } from '$lib/workgroups';
	import type { AtomicClaim, Citation, ClaimEdge, ClaimRunResult } from '$lib/types';
	import WorkGroupConfigurator from './WorkGroupConfigurator.svelte';

	let {
		claim,
		status,
		result,
		group,
		citations,
		info,
		claimById,
		resultById,
		onSelectClaim,
		onGroupChange,
		onRun
	}: {
		claim: AtomicClaim | null;
		status: string;
		result: ClaimRunResult | undefined;
		group: WorkGroup;
		citations: Citation[];
		info?: ClaimGraphInfo | null;
		claimById?: Record<string, AtomicClaim>;
		resultById?: Record<string, ClaimRunResult>;
		onSelectClaim?: (id: string) => void;
		onGroupChange: (wg: WorkGroup) => void;
		onRun: () => void;
	} = $props();

	const kind = $derived(claim ? (CLAIM_KIND[claim.kind] ?? CLAIM_KIND.assertion) : null);
	const markers = $derived(result?.citationMarkers ?? claim?.citationMarkers ?? []);
	const claimCitations = $derived(
		citations.filter((c) => c.marker != null && markers.includes(c.marker))
	);

	const weakest = $derived(
		info?.weakestPremiseId ? (claimById?.[info.weakestPremiseId] ?? null) : null
	);
	const hasRelations = $derived(
		!!info &&
			(info.dependsOn.length ||
				info.supports.length ||
				info.qualifiedBy.length ||
				info.qualifies.length ||
				info.conflicts.length) > 0
	);

	function verdictLabel(v: string | null | undefined): string {
		return v && VERDICT[v] ? VERDICT[v].label.toLowerCase() : 'a weaker';
	}
</script>

{#if !claim}
	<p class="empty">Select an atomic claim to see its analysis.</p>
{:else}
	<div class="detail">
		<div class="head">
			<span class="idx">Claim {claim.idx + 1}</span>
			{#if kind}<span class="kind"><Icon name={kind.icon} size={12} /> {kind.label}</span>{/if}
			{#if info?.loadBearing}
				<span class="bearing" title="{info.dependentCount} claims rest on this one">
					<Icon name="git-branch" size={11} /> load-bearing
				</span>
			{/if}
		</div>

		<blockquote class="text">{claim.text}</blockquote>

		{#if status === 'running'}
			<div class="running"><Icon name="sparkles" size={15} /> Analyzing this claim with {group.label}…</div>
		{:else if status === 'analyzed' && result}
			<div class="result">
				<div class="verdict-row">
					{#if result.verdict}
						<Badge tone={VERDICT[result.verdict]?.tone ?? 'neutral'} variant="solid">
							<Icon name={VERDICT[result.verdict]?.icon ?? 'circle-check'} size={12} />
							{VERDICT[result.verdict]?.label}
						</Badge>
					{/if}
					<ConfidenceMeter value={result.confidence} />
					<span class="src" title="Result source">
						<Icon name={result.analysisSource === 'live' ? 'sparkles' : 'history'} size={11} />
						{result.analysisSource === 'live' ? 'live' : 'baseline'}
					</span>
				</div>

				{#if info?.undermined}
					<button
						type="button"
						class="undermined"
						onclick={() => info?.weakestPremiseId && onSelectClaim?.(info.weakestPremiseId)}
					>
						<Icon name="triangle-alert" size={15} />
						<span class="ubody">
							<strong>Undermined by a premise.</strong>
							This claim reads {verdictLabel(result.verdict)} on its own, but it rests on a premise
							judged {verdictLabel(info.inheritedVerdict)}{#if weakest}{' — “'}{weakest.text}{'”'}{/if}.
							{#if info.effectiveConfidence != null}
								<span class="eff">Effective confidence, weakest link: {Math.round(info.effectiveConfidence * 100)}%</span>
							{/if}
						</span>
					</button>
				{/if}

				{#if result.analysisSummary}<p class="summary">{result.analysisSummary}</p>{/if}

				{#if result.riskSeverity && result.riskCategory}
					<div class="risk">
						<RiskBadge category={result.riskCategory} severity={result.riskSeverity} />
						{#if result.riskRationale}<p class="rationale">{result.riskRationale}</p>{/if}
					</div>
				{/if}

				{#if result.figureTrace?.length}
					<div class="block">
						<h4><Icon name="git-branch" size={13} /> Work group trace</h4>
						<ul class="trace">
							{#each result.figureTrace as f, i (i)}
								<li>
									<Icon name={TRACE_KIND[f.kind]?.icon ?? 'brain'} size={13} />
									<div class="tbody">
										<span class="tline">
											<strong>{FIGURE_ROLE[f.role as 'research']?.label ?? f.role}</strong>
											<span class="tmeta">{MODELS[f.model as 'claude-sonnet']?.label ?? f.model} · {f.effort} · {f.ms}ms</span>
										</span>
										<span class="tsum">{f.summary}</span>
									</div>
								</li>
							{/each}
						</ul>
					</div>
				{/if}

				{#if claimCitations.length}
					<div class="block">
						<h4><Icon name="book-open" size={13} /> Cited authorities</h4>
						<div class="sources">
							{#each claimCitations as c (c.id)}<SourceCard citation={c} />{/each}
						</div>
					</div>
				{/if}
			</div>
		{:else}
			<p class="hint">Not analyzed yet. Choose a work group below and run it against this claim.</p>
		{/if}

		{#snippet relList(title: string, icon: string, edges: ClaimEdge[], otherOf: (e: ClaimEdge) => string)}
			{#if edges.length}
				<div class="rel-group">
					<h5><Icon name={icon} size={12} /> {title}</h5>
					{#each edges as e (e.id)}
						{@const oid = otherOf(e)}
						{@const oc = claimById?.[oid]}
						{@const orr = resultById?.[oid]}
						<button type="button" class="rel" onclick={() => onSelectClaim?.(oid)}>
							<div class="rel-head">
								<span class="rel-kind">{CLAIM_RELATION[e.relation]?.label ?? e.relation}</span>
								{#if oc}<span class="rel-idx">Claim {oc.idx + 1}</span>{/if}
								{#if orr?.verdict}
									<Badge tone={VERDICT[orr.verdict]?.tone ?? 'neutral'}>
										<Icon name={VERDICT[orr.verdict]?.icon ?? 'circle-check'} size={10} />
										{VERDICT[orr.verdict]?.label}
									</Badge>
								{/if}
							</div>
							{#if oc}<p class="rel-text">{oc.text}</p>{/if}
							{#if e.rationale}<p class="rel-why">{e.rationale}</p>{/if}
						</button>
					{/each}
				</div>
			{/if}
		{/snippet}

		{#if hasRelations && info}
			<div class="block relations">
				<h4><Icon name="git-fork" size={13} /> Reasoning dependencies</h4>
				{@render relList('Rests on', 'arrow-up-right', info.dependsOn, (e) => e.toClaimId)}
				{@render relList('Relied on by', 'git-branch', info.supports, (e) => e.fromClaimId)}
				{@render relList('Qualified by', 'git-fork', info.qualifiedBy, (e) => e.fromClaimId)}
				{@render relList('Qualifies', 'git-fork', info.qualifies, (e) => e.toClaimId)}
				{@render relList(
					'Potential conflict',
					'triangle-alert',
					info.conflicts,
					(e) => (e.fromClaimId === claim.id ? e.toClaimId : e.fromClaimId)
				)}
			</div>
		{/if}

		<div class="block configurator">
			<h4><Icon name="git-fork" size={13} /> Work group for this claim</h4>
			<WorkGroupConfigurator value={group} onChange={onGroupChange} compact />
		</div>

		<button class="run" onclick={onRun} disabled={status === 'running'}>
			<Icon name={status === 'analyzed' ? 'rotate-ccw' : 'sparkles'} size={15} />
			{status === 'running'
				? 'Analyzing…'
				: status === 'analyzed'
					? `Re-run claim ${claim.idx + 1} check`
					: `Run claim ${claim.idx + 1} check`}
		</button>
	</div>
{/if}

<style>
	.empty {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--text-tertiary);
	}
	.detail {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}
	.head {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.idx {
		font-family: var(--font-display);
		font-weight: var(--weight-semibold);
		font-size: var(--text-md);
		color: var(--text-primary);
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
		gap: 4px;
		margin-left: auto;
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
		color: var(--color-accent-active);
	}
	.text {
		margin: 0;
		padding: 10px 14px;
		border-left: 3px solid var(--color-accent);
		background: var(--surface-sunken);
		border-radius: var(--radius-sm);
		font-family: var(--font-serif);
		font-size: var(--text-base);
		line-height: var(--leading-normal);
		color: var(--text-primary);
	}
	.running {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 12px 14px;
		background: var(--terracotta-50);
		border-radius: var(--radius-md);
		font-size: var(--text-sm);
		color: var(--color-accent-active);
		animation: pulse 1.1s var(--ease-in-out) infinite;
	}
	.result {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}
	.verdict-row {
		display: flex;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
	}
	.src {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--text-tertiary);
	}
	.undermined {
		display: flex;
		gap: 10px;
		align-items: flex-start;
		width: 100%;
		text-align: left;
		padding: 11px 13px;
		background: var(--status-danger-bg);
		border: 1.5px solid var(--status-danger-fg);
		border-radius: var(--radius-md);
		color: var(--status-danger-fg);
		cursor: pointer;
	}
	.ubody {
		font-size: var(--text-sm);
		line-height: var(--leading-normal);
		color: var(--text-secondary);
	}
	.ubody strong {
		color: var(--status-danger-fg);
	}
	.eff {
		display: block;
		margin-top: 4px;
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--text-tertiary);
	}
	.summary {
		margin: 0;
		font-size: var(--text-sm);
		line-height: var(--leading-normal);
		color: var(--text-secondary);
	}
	.risk {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 10px 12px;
		background: var(--surface-sunken);
		border-radius: var(--radius-md);
	}
	.rationale {
		margin: 0;
		font-size: var(--text-xs);
		line-height: var(--leading-normal);
		color: var(--text-secondary);
	}
	.block {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.block h4 {
		display: flex;
		align-items: center;
		gap: 6px;
		margin: 0;
		font-size: var(--text-xs);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
		color: var(--text-tertiary);
	}
	.trace {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.trace li {
		display: grid;
		grid-template-columns: 16px 1fr;
		gap: 8px;
		align-items: start;
	}
	.tbody {
		display: flex;
		flex-direction: column;
		gap: 1px;
		min-width: 0;
	}
	.tline {
		display: flex;
		align-items: baseline;
		gap: 8px;
		font-size: var(--text-sm);
		color: var(--text-primary);
	}
	.tmeta {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--text-tertiary);
	}
	.tsum {
		font-size: var(--text-xs);
		color: var(--text-secondary);
		line-height: var(--leading-snug);
	}
	.sources {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.relations {
		padding-top: var(--space-4);
		border-top: 1.5px solid var(--border-subtle);
		gap: var(--space-3);
	}
	.rel-group {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.rel-group h5 {
		display: flex;
		align-items: center;
		gap: 5px;
		margin: 2px 0 0;
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
		color: var(--text-tertiary);
		font-weight: var(--weight-medium);
	}
	.rel {
		display: flex;
		flex-direction: column;
		gap: 4px;
		width: 100%;
		text-align: left;
		padding: 8px 10px;
		background: var(--surface-sunken);
		border: 1.5px solid var(--border-subtle);
		border-radius: var(--radius-md);
		cursor: pointer;
		transition: border-color var(--duration-fast) var(--ease-out);
	}
	.rel:hover {
		border-color: var(--color-accent);
	}
	.rel-head {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}
	.rel-kind {
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
		color: var(--color-accent-active);
	}
	.rel-idx {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--text-tertiary);
	}
	.rel-text {
		margin: 0;
		font-size: var(--text-xs);
		line-height: var(--leading-snug);
		color: var(--text-primary);
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.rel-why {
		margin: 0;
		font-size: 11px;
		line-height: var(--leading-snug);
		color: var(--text-tertiary);
	}
	.hint {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--text-tertiary);
	}
	.configurator {
		padding-top: var(--space-4);
		border-top: 1.5px solid var(--border-subtle);
	}
	.run {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		width: 100%;
		padding: 11px;
		font-family: var(--font-display);
		font-weight: var(--weight-medium);
		font-size: var(--text-sm);
		color: var(--color-on-accent);
		background: var(--color-accent);
		border: none;
		border-radius: var(--radius-md);
		cursor: pointer;
		transition: background var(--duration-fast) var(--ease-out);
	}
	.run:hover:not(:disabled) {
		background: var(--color-accent-hover);
	}
	.run:disabled {
		opacity: 0.6;
		cursor: progress;
	}
	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.6;
		}
	}
</style>
