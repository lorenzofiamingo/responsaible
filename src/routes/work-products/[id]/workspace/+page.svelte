<script lang="ts">
	import { page } from '$app/state';
	import { invalidateAll } from '$app/navigation';
	import Icon from '$lib/components/Icon.svelte';
	import ClaimDetail from '$lib/components/workarea/ClaimDetail.svelte';
	import ClaimGraph from '$lib/components/workarea/ClaimGraph.svelte';
	import ClaimList from '$lib/components/workarea/ClaimList.svelte';
	import ClaimText from '$lib/components/workarea/ClaimText.svelte';
	import RunControls from '$lib/components/workarea/RunControls.svelte';
	import { buildClaimGraph } from '$lib/claim-graph';
	import { CAN_SUPERVISE, ROLE } from '$lib/format';
	import { DEFAULT_PRESET, PRESETS, type PresetId, type WorkGroup } from '$lib/workgroups';
	import type { AtomicClaim, ClaimRunResult } from '$lib/types';

	let { data } = $props();

	const wp = $derived(data.wp);
	const canSupervise = $derived(!!data.user && CAN_SUPERVISE.has(data.user.role));

	// --- run state, keyed by claim id ---
	function seededResult(c: AtomicClaim): ClaimRunResult | undefined {
		if (c.status !== 'analyzed') return undefined;
		return {
			claimId: c.id,
			idx: c.idx,
			status: 'analyzed',
			analysisSource: (c.analysisSource as 'seed' | 'live') ?? 'seed',
			presetUsed: c.presetUsed,
			verdict: c.verdict,
			analysisSummary: c.analysisSummary,
			confidence: c.confidence,
			riskCategory: c.riskCategory,
			riskSeverity: c.riskSeverity,
			riskRationale: c.riskRationale,
			citationMarkers: c.citationMarkers ?? [],
			figureTrace: c.figureTrace ?? [],
			ranAt: c.ranAt ?? ''
		};
	}

	// One-time snapshots from load data (the component remounts per work product).
	// svelte-ignore state_referenced_locally
	const claims0 = $state.snapshot(data.claims) as AtomicClaim[];
	let statusById = $state<Record<string, string>>(
		Object.fromEntries(claims0.map((c) => [c.id, c.status]))
	);
	let resultById = $state<Record<string, ClaimRunResult>>(
		Object.fromEntries(
			claims0.map((c) => [c.id, seededResult(c)]).filter(([, r]) => r) as [string, ClaimRunResult][]
		)
	);

	// --- work-group selection ---
	// Each claim resolves to its splitter-assigned preset unless individually
	// overridden. The "one work group for all" action is just a bulk override —
	// it writes the same group onto every claim, which can then be re-tuned one
	// by one. There is no separate global/override mode layered on top.
	let midView = $state<'doc' | 'list' | 'graph'>('doc');
	let bulkGroup = $state<WorkGroup>(PRESETS[DEFAULT_PRESET]);
	let overrideById = $state<Record<string, WorkGroup>>({});

	function groupFor(claim: AtomicClaim): WorkGroup {
		return overrideById[claim.id] ?? PRESETS[claim.assignedPreset as PresetId] ?? PRESETS[DEFAULT_PRESET];
	}

	function applyGroupToAll(wg: WorkGroup) {
		bulkGroup = wg;
		overrideById = Object.fromEntries(data.claims.map((c) => [c.id, wg]));
	}

	// --- selection ---
	const initial = page.url.searchParams.get('claim');
	let selectedId = $state<string | null>(
		initial && claims0.some((c) => c.id === initial) ? initial : (claims0[0]?.id ?? null)
	);
	const selectedClaim = $derived(data.claims.find((c) => c.id === selectedId) ?? null);
	const selectedGroup = $derived(selectedClaim ? groupFor(selectedClaim) : bulkGroup);

	// --- reasoning graph (derived; recomputes as claims get analyzed) ---
	const claimById = $derived(
		Object.fromEntries(data.claims.map((c) => [c.id, c])) as Record<string, AtomicClaim>
	);
	const graph = $derived(buildClaimGraph(data.claims, data.edges, resultById));
	const selectedInfo = $derived(selectedId ? (graph.get(selectedId) ?? null) : null);

	function selectClaim(id: string) {
		selectedId = id;
	}

	// Keep the chosen claim visible in the middle column.
	$effect(() => {
		if (!selectedId) return;
		document.getElementById(`claim-${selectedId}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
	});

	const analyzed = $derived(Object.values(statusById).filter((s) => s === 'analyzed').length);
	let runningAll = $state(false);

	function payloadFor(ids: string[]): Record<string, { preset?: PresetId; figures?: WorkGroup['figures'] }> {
		const out: Record<string, { preset?: PresetId; figures?: WorkGroup['figures'] }> = {};
		for (const id of ids) {
			const c = data.claims.find((x) => x.id === id);
			if (!c) continue;
			const g = groupFor(c);
			out[id] = g.id === 'custom' ? { figures: g.figures } : { preset: g.id as PresetId };
		}
		return out;
	}

	type RunLine = Omit<ClaimRunResult, 'status'> & { status: string; error?: string };
	function applyResult(r: RunLine) {
		if (r.status === 'error') {
			statusById[r.claimId] = 'pending';
			return;
		}
		statusById[r.claimId] = 'analyzed';
		resultById[r.claimId] = { ...r, status: 'analyzed' };
	}

	async function runClaims(ids: string[]) {
		if (!canSupervise || ids.length === 0) return;
		for (const id of ids) statusById[id] = 'running';
		try {
			const res = await fetch(`/api/work-products/${wp.id}/analyze`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ claimIds: ids, workGroups: payloadFor(ids) })
			});
			if (!res.ok || !res.body) {
				for (const id of ids) statusById[id] = resultById[id] ? 'analyzed' : 'pending';
				return;
			}
			const reader = res.body.getReader();
			const decoder = new TextDecoder();
			let buf = '';
			for (;;) {
				const { done, value } = await reader.read();
				if (done) break;
				buf += decoder.decode(value, { stream: true });
				let nl: number;
				while ((nl = buf.indexOf('\n')) >= 0) {
					const line = buf.slice(0, nl).trim();
					buf = buf.slice(nl + 1);
					if (line) applyResult(JSON.parse(line));
				}
			}
			if (buf.trim()) applyResult(JSON.parse(buf.trim()));
			// The run persisted per-claim results to the DB. Re-run the load so the
			// header's per-claim confidence roll-up reflects what was just analyzed.
			// Local run state (statusById/resultById) is initialised once and is not
			// reset by this, so the live grid keeps the results we just streamed in.
			await invalidateAll();
		} catch {
			for (const id of ids) statusById[id] = resultById[id] ? 'analyzed' : 'pending';
		}
	}

	async function runOne(id: string) {
		await runClaims([id]);
	}

	async function runAll() {
		if (runningAll) return;
		runningAll = true;
		try {
			await runClaims(data.claims.map((c) => c.id));
		} finally {
			runningAll = false;
		}
	}

	function setGroupForSelected(wg: WorkGroup) {
		if (selectedId) overrideById = { ...overrideById, [selectedId]: wg };
	}
</script>

{#if !canSupervise}
	<div class="rolebar">
		<Icon name="lock" size={14} />
		Running the agents requires the <strong>supervising lawyer</strong> role.{#if data.user}
			You're signed in as {ROLE[data.user.role]?.label ?? data.user.role}.{/if}
	</div>
{/if}

<div class="workarea">
	<div class="wa-inner">
		<div class="cols">
			<section class="panel col-mid">
				<h3 class="ptitle">
					<Icon name="list-checks" size={15} /> Claims <span class="count">{data.claims.length}</span>
					<div class="seg" role="tablist" aria-label="Claims view">
						<button type="button" role="tab" aria-selected={midView === 'doc'} class:on={midView === 'doc'} onclick={() => (midView = 'doc')}>Document</button>
						<button type="button" role="tab" aria-selected={midView === 'list'} class:on={midView === 'list'} onclick={() => (midView = 'list')}>List</button>
						<button type="button" role="tab" aria-selected={midView === 'graph'} class:on={midView === 'graph'} onclick={() => (midView = 'graph')}>Graph</button>
					</div>
				</h3>
				<RunControls
					{bulkGroup}
					{analyzed}
					total={data.claims.length}
					running={runningAll}
					onApplyAll={applyGroupToAll}
					onRunAll={runAll}
				/>
				<div class="scroll">
					{#if midView === 'doc'}
					<ClaimText
						body={wp.body}
						claims={data.claims}
						{selectedId}
						{statusById}
						{resultById}
						{graph}
						onSelect={selectClaim}
					/>
					{:else if midView === 'graph'}
					<ClaimGraph
						claims={data.claims}
						edges={data.edges}
						{graph}
						{statusById}
						{resultById}
						{selectedId}
						onSelect={selectClaim}
					/>
					{:else}
					<ClaimList
						claims={data.claims}
						{selectedId}
						{statusById}
						{resultById}
						{graph}
						groupLabelFor={(c) => groupFor(c).label}
						onSelect={selectClaim}
					/>
					{/if}
				</div>
			</section>

			<section class="panel col-detail">
				<h3 class="ptitle"><Icon name="shield-check" size={15} /> Claim analysis</h3>
				<div class="scroll">
					<ClaimDetail
						claim={selectedClaim}
						status={selectedId ? (statusById[selectedId] ?? 'pending') : 'pending'}
						result={selectedId ? resultById[selectedId] : undefined}
						group={selectedGroup}
						citations={data.citations}
						info={selectedInfo}
						{claimById}
						{resultById}
						onSelectClaim={selectClaim}
						onGroupChange={setGroupForSelected}
						onRun={() => selectedId && runOne(selectedId)}
					/>
				</div>
			</section>
		</div>
	</div>
</div>

<style>
	.rolebar {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: var(--space-4);
		padding: 10px 14px;
		background: var(--surface-sunken);
		border: 1.5px solid var(--border-default);
		border-radius: var(--radius-md);
		font-size: var(--text-sm);
		color: var(--text-secondary);
	}

	/* Two panes flow within the page's 1200px container, aligned with the header
	   and tabs above. Each column is as tall as its own content; the page scrolls
	   normally. */
	.workarea {
		width: 100%;
		padding-bottom: var(--space-6);
	}
	.wa-inner {
		width: 100%;
	}

	/* Two columns, top-aligned, each sized to its own content. */
	.cols {
		display: grid;
		grid-template-columns: minmax(340px, 1.1fr) minmax(340px, 1fr);
		gap: var(--space-5);
		align-items: start;
	}

	.panel {
		background: var(--surface-card);
		border: 1.5px solid var(--border-default);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-sm);
		padding: var(--space-5);
		min-width: 0;
	}
	.ptitle {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: var(--text-md);
		margin: 0 0 var(--space-3);
	}
	.ptitle .count {
		margin-left: 0;
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--text-tertiary);
	}

	/* Relax the column min-widths as the page narrows, then stack to one column. */
	@media (max-width: 1200px) {
		.cols {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		}
	}
	@media (max-width: 820px) {
		.cols {
			grid-template-columns: 1fr;
		}
	}
	.seg {
		margin-left: auto;
		display: inline-flex;
		gap: 2px;
		padding: 2px;
		background: var(--surface-sunken);
		border-radius: var(--radius-sm);
	}
	.seg button {
		font-family: var(--font-display);
		font-size: var(--text-xs);
		padding: 3px 10px;
		border: none;
		background: transparent;
		color: var(--text-tertiary);
		border-radius: calc(var(--radius-sm) - 2px);
		cursor: pointer;
	}
	.seg button.on {
		background: var(--surface-card);
		color: var(--text-primary);
		box-shadow: var(--shadow-sm);
	}
</style>
