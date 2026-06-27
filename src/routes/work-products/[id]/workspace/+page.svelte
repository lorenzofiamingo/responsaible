<script lang="ts">
	import { page } from '$app/state';
	import Icon from '$lib/components/Icon.svelte';
	import ClaimDetail from '$lib/components/workarea/ClaimDetail.svelte';
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
	let applyAll = $state(false);
	let globalGroup = $state<WorkGroup>(PRESETS[DEFAULT_PRESET]);
	let overrideById = $state<Record<string, WorkGroup>>({});

	function groupFor(claim: AtomicClaim): WorkGroup {
		return overrideById[claim.id] ?? (applyAll ? globalGroup : PRESETS[claim.assignedPreset as PresetId] ?? PRESETS[DEFAULT_PRESET]);
	}

	// --- selection ---
	const initial = page.url.searchParams.get('claim');
	let selectedId = $state<string | null>(
		initial && claims0.some((c) => c.id === initial) ? initial : (claims0[0]?.id ?? null)
	);
	const selectedClaim = $derived(data.claims.find((c) => c.id === selectedId) ?? null);
	const selectedGroup = $derived(selectedClaim ? groupFor(selectedClaim) : globalGroup);

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
		<RunControls
			{globalGroup}
			{applyAll}
			{analyzed}
			total={data.claims.length}
			running={runningAll}
			onModeChange={(v) => (applyAll = v)}
			onGlobalChange={(wg) => (globalGroup = wg)}
			onRunAll={runAll}
		/>

		<div class="cols">
			<section class="panel col-doc">
				<h3 class="ptitle"><Icon name="file-text" size={15} /> Document · atomic claims</h3>
				<p class="phint">The first agent split the draft into {data.claims.length} atomic claims. Click any to inspect it.</p>
				<ClaimText
					body={wp.body}
					claims={data.claims}
					{selectedId}
					{statusById}
					{resultById}
						{graph}
					onSelect={selectClaim}
				/>
			</section>

			<section class="panel col-mid">
				<h3 class="ptitle"><Icon name="list-checks" size={15} /> Claims <span class="count">{data.claims.length}</span></h3>
				<div class="scroll">
					<ClaimList
						claims={data.claims}
						{selectedId}
						{statusById}
						{resultById}
						{graph}
						groupLabelFor={(c) => groupFor(c).label}
						onSelect={selectClaim}
						onRun={runOne}
					/>
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

	/* Full-bleed breakout of the 1200px container so three columns get room. */
	.workarea {
		width: 100vw;
		margin-left: calc(50% - 50vw);
		padding: 0 var(--space-6) var(--space-6);
	}
	.wa-inner {
		max-width: 1500px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
	}

	.cols {
		display: grid;
		grid-template-columns: minmax(300px, 1.1fr) minmax(260px, 0.9fr) minmax(320px, 1.2fr);
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
		margin-left: auto;
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--text-tertiary);
	}
	.phint {
		margin: 0 0 var(--space-4);
		font-size: var(--text-sm);
		color: var(--text-tertiary);
		line-height: var(--leading-normal);
	}

	/* Middle + detail stick and scroll internally; the document flows. */
	.col-mid,
	.col-detail {
		position: sticky;
		top: calc(60px + var(--space-4));
		max-height: calc(100vh - 60px - var(--space-5));
		display: flex;
		flex-direction: column;
	}
	.scroll {
		overflow-y: auto;
		min-height: 0;
		margin: 0 calc(-1 * var(--space-2));
		padding: 0 var(--space-2);
	}

	@media (max-width: 1200px) {
		.cols {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
		}
		.col-doc {
			grid-column: 1 / -1;
		}
		.col-mid,
		.col-detail {
			position: static;
			max-height: none;
		}
	}
	@media (max-width: 820px) {
		.cols {
			grid-template-columns: 1fr;
		}
	}
</style>
