<script lang="ts">
	import AuditTrail from '$lib/components/AuditTrail.svelte';
	import ClaimFindings from '$lib/components/ClaimFindings.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import RiskSignalPanel from '$lib/components/RiskSignalPanel.svelte';
	import SourceCard from '$lib/components/SourceCard.svelte';
	import SummaryOverview from '$lib/components/SummaryOverview.svelte';
	import SupervisoryActions from '$lib/components/SupervisoryActions.svelte';
	import TraceTimeline from '$lib/components/TraceTimeline.svelte';
	import { CAN_SUPERVISE, claimRollup, ROLE } from '$lib/format';
	import { invalidateAll } from '$app/navigation';

	let { data, form } = $props();

	// `wp` + `user` come from the shared +layout.server.ts.
	const wp = $derived(data.wp);
	const workspaceHref = $derived(`/work-products/${wp.id}/workspace`);

	// Split the body into text runs and [n] citation markers.
	const segments = $derived.by(() => {
		const out: Array<{ t: string } | { m: number }> = [];
		const body = wp.body ?? '';
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
	const canSupervise = $derived(!!data.user && CAN_SUPERVISE.has(data.user.role));

	// The decision is a single sign-off, but framed by the claim-level review: how
	// many claims it covers and how many still carry an open finding.
	const roll = $derived(claimRollup(data.claims));
	const openClaims = $derived(roll.attention + roll.caution);

	let verifyingCites = $state(false);
	async function verifyCitations() {
		verifyingCites = true;
		try {
			await fetch('/api/cellar/verify', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ workProductId: wp.id })
			});
			await invalidateAll();
		} finally {
			verifyingCites = false;
		}
	}
</script>

<div class="band">
	<SummaryOverview
		confidence={wp.confidence}
		claims={data.claims}
		citations={data.citations}
		risks={data.risks}
		{workspaceHref}
	/>
</div>

<div class="grid">
	<div class="col-main">
		<section class="panel">
			<h2 class="ptitle">
				<Icon name="list-checks" size={16} /> Claims to review
				<span class="count">{data.claims.length}</span>
			</h2>
			<p class="phint">
				The supervisor reviews this work claim by claim. Each atomic claim is grouped by its review
				state — open one in the work area to run the agents against it.
			</p>
			<ClaimFindings claims={data.claims} {workspaceHref} />
		</section>

		<section class="panel">
			<h2 class="ptitle">
				<Icon name="shield-alert" size={16} /> Risk signals
				<span class="count">{data.risks.length}</span>
			</h2>
			<RiskSignalPanel signals={data.risks} />
		</section>

		<section class="panel">
			<h2 class="ptitle"><Icon name="file-text" size={16} /> Full document</h2>
			<p class="phint">The source text the claims were extracted from — kept here for reference.</p>
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
				<Icon name="git-branch" size={16} /> What the AI did
				<span class="count">{data.actions.length} steps</span>
			</h2>
			<p class="phint">The agent's recorded actions and reasoning — from search to draft to self-critique.</p>
			<TraceTimeline actions={data.actions} />
		</section>
	</div>

	<aside class="col-rail">
		<section class="panel">
			<h2 class="ptitle"><Icon name="gavel" size={16} /> Your decision</h2>
			{#if canSupervise}
				<p class="phint">Approve, amend, reject, request rework, escalate, or override. Reasons are required for the serious ones and recorded immutably.</p>
				{#if roll.total > 0}
					<p class="covers" class:bad={openClaims > 0}>
						<Icon name={openClaims > 0 ? 'shield-alert' : 'list-checks'} size={13} />
						<span>
							Your sign-off covers all {roll.total} claim{roll.total > 1 ? 's' : ''} —
							{#if openClaims > 0}<strong>{openClaims} still flagged</strong>{:else if roll.unrun > 0}{roll.unrun} not yet run{:else}all clear{/if}.
						</span>
					</p>
				{/if}
				<SupervisoryActions {form} />
			{:else}
				<p class="norole">
					<Icon name="lock" size={14} />
					Recording a supervisory decision requires the <strong>supervising lawyer</strong> role.{#if data.user}
						You're signed in as {ROLE[data.user.role]?.label ?? data.user.role} — use “Switch” in the header to change.{/if}
				</p>
			{/if}
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
	.band {
		margin-bottom: var(--space-5);
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
	.norole {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		margin: 0;
		padding: 12px 14px;
		background: var(--surface-sunken);
		border: 1.5px solid var(--border-default);
		border-radius: var(--radius-md);
		font-size: var(--text-sm);
		color: var(--text-secondary);
		line-height: var(--leading-normal);
	}
	.covers {
		display: flex;
		align-items: flex-start;
		gap: 7px;
		margin: 0 0 var(--space-4);
		padding: 9px 12px;
		background: var(--surface-sunken);
		border-left: 3px solid var(--border-strong);
		border-radius: var(--radius-sm);
		font-size: var(--text-sm);
		color: var(--text-secondary);
		line-height: var(--leading-normal);
	}
	.covers.bad {
		border-left-color: var(--status-danger-fg);
	}
	.covers.bad strong {
		color: var(--status-danger-fg);
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
