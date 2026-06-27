<script lang="ts">
	import Badge from '$lib/components/Badge.svelte';
	import ConfidenceMeter from '$lib/components/ConfidenceMeter.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import { STATUS, WP_TYPE } from '$lib/format';

	let { data } = $props();

	type Row = (typeof data.queue)[number];

	// --- Search & filter state (all client-side: the full queue is already loaded,
	// so filtering is instant and survives no network). ---
	let q = $state('');
	let typeFilter = $state('all');
	let statusFilter = $state('all');
	let riskFilter = $state('all'); // all | high | med | low | none
	let confFilter = $state('all'); // all | high | medium | low
	let sortBy = $state('priority'); // priority | confidence | recent

	const riskLevel = (r: Row['risk']) =>
		r.high > 0 ? 'high' : r.med > 0 ? 'med' : r.low > 0 ? 'low' : 'none';
	const confLevel = (c: number) => (c >= 0.8 ? 'high' : c >= 0.6 ? 'medium' : 'low');

	// Only offer type/status values that actually occur, in their canonical order.
	const typeOrder = ['draft', 'memo', 'risk_analysis'] as const;
	const presentTypes = $derived(typeOrder.filter((t) => data.queue.some((w) => w.type === t)));
	const presentStatuses = $derived(
		Object.keys(STATUS).filter((s) => data.queue.some((w) => w.status === s))
	);

	const filtered = $derived.by(() => {
		const needle = q.trim().toLowerCase();
		const rows = data.queue.filter((wp) => {
			if (typeFilter !== 'all' && wp.type !== typeFilter) return false;
			if (statusFilter !== 'all' && wp.status !== statusFilter) return false;
			if (riskFilter !== 'all' && riskLevel(wp.risk) !== riskFilter) return false;
			if (confFilter !== 'all' && confLevel(wp.confidence) !== confFilter) return false;
			if (needle) {
				const hay =
					`${wp.title} ${wp.summary} ${wp.matterName} ${wp.matterRef} ${wp.agentName} ${WP_TYPE[wp.type].label}`.toLowerCase();
				if (!hay.includes(needle)) return false;
			}
			return true;
		});

		const sorted = [...rows];
		if (sortBy === 'confidence') sorted.sort((a, b) => a.confidence - b.confidence);
		else if (sortBy === 'recent') sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
		else sorted.sort((a, b) => b.priority - a.priority || a.confidence - b.confidence);
		return sorted;
	});

	const activeCount = $derived(
		(q.trim() ? 1 : 0) +
			(typeFilter !== 'all' ? 1 : 0) +
			(statusFilter !== 'all' ? 1 : 0) +
			(riskFilter !== 'all' ? 1 : 0) +
			(confFilter !== 'all' ? 1 : 0)
	);

	function clearAll() {
		q = '';
		typeFilter = 'all';
		statusFilter = 'all';
		riskFilter = 'all';
		confFilter = 'all';
	}

	// Stat cards double as quick filters — they map 1:1 onto the buckets above.
	function toggleStat(kind: 'pending' | 'highRisk' | 'lowConf' | 'total') {
		if (kind === 'total') return clearAll();
		if (kind === 'pending') statusFilter = statusFilter === 'pending' ? 'all' : 'pending';
		if (kind === 'highRisk') riskFilter = riskFilter === 'high' ? 'all' : 'high';
		if (kind === 'lowConf') confFilter = confFilter === 'low' ? 'all' : 'low';
	}
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
	<button
		class="stat"
		class:on={statusFilter === 'pending'}
		aria-pressed={statusFilter === 'pending'}
		aria-label="Filter to pending review"
		onclick={() => toggleStat('pending')}
	>
		<span class="n">{data.stats.pending}</span><span class="l">Pending review</span>
	</button>
	<button
		class="stat"
		class:on={riskFilter === 'high'}
		aria-pressed={riskFilter === 'high'}
		aria-label="Filter to items with high-severity risk"
		onclick={() => toggleStat('highRisk')}
	>
		<span class="n">{data.stats.highRisk}</span><span class="l">With high-severity risk</span>
	</button>
	<button
		class="stat"
		class:on={confFilter === 'low'}
		aria-pressed={confFilter === 'low'}
		aria-label="Filter to low-confidence items"
		onclick={() => toggleStat('lowConf')}
	>
		<span class="n">{data.stats.lowConfidence}</span><span class="l">Low confidence</span>
	</button>
	<button
		class="stat"
		class:on={activeCount === 0}
		aria-label="Show all work products and clear filters"
		onclick={() => toggleStat('total')}
	>
		<span class="n">{data.stats.total}</span><span class="l">Total in queue</span>
	</button>
</div>

<div class="toolbar">
	<div class="searchbox">
		<span class="si"><Icon name="search" size={16} /></span>
		<input
			type="search"
			bind:value={q}
			placeholder="Search title, matter, ref or agent…"
			aria-label="Search work products"
		/>
		{#if q}
			<button class="clear-q" onclick={() => (q = '')} aria-label="Clear search">
				<Icon name="x" size={14} />
			</button>
		{/if}
	</div>

	<div class="filters">
		<select bind:value={typeFilter} class:on={typeFilter !== 'all'} aria-label="Filter by type">
			<option value="all">All types</option>
			{#each presentTypes as t (t)}
				<option value={t}>{WP_TYPE[t].label}</option>
			{/each}
		</select>

		<select
			bind:value={statusFilter}
			class:on={statusFilter !== 'all'}
			aria-label="Filter by status"
		>
			<option value="all">All statuses</option>
			{#each presentStatuses as s (s)}
				<option value={s}>{STATUS[s].label}</option>
			{/each}
		</select>

		<select bind:value={riskFilter} class:on={riskFilter !== 'all'} aria-label="Filter by risk">
			<option value="all">Any risk</option>
			<option value="high">High severity</option>
			<option value="med">Medium risk</option>
			<option value="low">Low risk</option>
			<option value="none">No flags</option>
		</select>

		<select
			bind:value={confFilter}
			class:on={confFilter !== 'all'}
			aria-label="Filter by confidence"
		>
			<option value="all">Any confidence</option>
			<option value="high">High (≥80%)</option>
			<option value="medium">Medium (60–79%)</option>
			<option value="low">Low (&lt;60%)</option>
		</select>

		<select bind:value={sortBy} class="sort" aria-label="Sort order">
			<option value="priority">Sort: Priority</option>
			<option value="confidence">Sort: Lowest confidence</option>
			<option value="recent">Sort: Most recent</option>
		</select>
	</div>

	<div class="resultline">
		<span class="count" role="status" aria-live="polite" aria-atomic="true">
			Showing <b>{filtered.length}</b> of {data.queue.length}
		</span>
		{#if activeCount > 0}
			<button class="clear-all" onclick={clearAll}>
				<Icon name="x" size={12} /> Clear {activeCount} filter{activeCount > 1 ? 's' : ''}
			</button>
		{/if}
	</div>
</div>

{#if data.queue.length === 0}
	<div class="empty">
		<Icon name="list-checks" size={30} color="var(--text-tertiary)" />
		<p class="emsg">The supervision queue is empty — no AI work products have been submitted yet.</p>
	</div>
{:else if filtered.length === 0}
	<div class="empty">
		<Icon name="file-search" size={30} color="var(--text-tertiary)" />
		<p class="emsg">No work products match your filters.</p>
		<button class="emclear" onclick={clearAll}>Clear all filters</button>
	</div>
{:else}
	<ul class="queue">
		{#each filtered as wp (wp.id)}
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
{/if}

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
		margin-bottom: var(--space-5);
	}
	.stat {
		text-align: left;
		font: inherit;
		cursor: pointer;
		background: var(--surface-card);
		border: 1.5px solid var(--border-default);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-xs);
		padding: var(--space-4) var(--space-5);
		display: flex;
		flex-direction: column;
		gap: 2px;
		transition:
			border-color var(--duration-fast) var(--ease-out),
			background var(--duration-fast) var(--ease-out);
	}
	.stat:hover {
		border-color: var(--border-strong);
	}
	.stat.on {
		border-color: var(--color-accent);
		background: var(--terracotta-50);
	}
	.stat:focus-visible {
		outline: none;
		box-shadow: var(--shadow-focus);
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

	.toolbar {
		display: flex;
		flex-direction: column;
		gap: 12px;
		margin-bottom: var(--space-5);
	}
	.searchbox {
		position: relative;
	}
	.searchbox .si {
		position: absolute;
		left: 12px;
		top: 50%;
		transform: translateY(-50%);
		color: var(--text-tertiary);
		pointer-events: none;
	}
	.searchbox input {
		width: 100%;
		font-family: var(--font-sans);
		font-size: var(--text-base);
		color: var(--text-primary);
		background: var(--surface-card);
		border: 1.5px solid var(--border-strong);
		border-radius: var(--radius-md);
		padding: 10px 38px;
	}
	.searchbox input::-webkit-search-cancel-button {
		appearance: none;
	}
	.searchbox input:focus {
		outline: none;
		border-color: var(--border-focus);
		box-shadow: var(--shadow-focus);
	}
	.clear-q {
		position: absolute;
		right: 8px;
		top: 50%;
		transform: translateY(-50%);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 26px;
		border: none;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--text-tertiary);
		cursor: pointer;
	}
	.clear-q:hover {
		background: var(--surface-hover);
		color: var(--text-primary);
	}

	.filters {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}
	.filters select {
		font-family: var(--font-sans);
		font-size: var(--text-sm);
		color: var(--text-secondary);
		background: var(--surface-card);
		border: 1.5px solid var(--border-default);
		border-radius: var(--radius-md);
		padding: 7px 11px;
		cursor: pointer;
	}
	.filters select:hover {
		border-color: var(--border-strong);
	}
	.filters select:focus {
		outline: none;
		border-color: var(--border-focus);
		box-shadow: var(--shadow-focus);
	}
	.filters select.on {
		border-color: var(--color-accent);
		background: var(--terracotta-50);
		color: var(--text-primary);
		font-weight: var(--weight-medium);
	}
	.filters .sort {
		margin-left: auto;
	}

	.resultline {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.count {
		font-size: var(--text-sm);
		color: var(--text-tertiary);
	}
	.count b {
		color: var(--text-primary);
		font-weight: var(--weight-semibold);
	}
	.clear-all {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-family: var(--font-sans);
		font-size: var(--text-xs);
		color: var(--text-link);
		background: none;
		border: none;
		cursor: pointer;
	}
	.clear-all:hover {
		text-decoration: underline;
	}

	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		text-align: center;
		background: var(--surface-card);
		border: 1.5px dashed var(--border-strong);
		border-radius: var(--radius-lg);
		padding: var(--space-8) var(--space-5);
	}
	.emsg {
		margin: 0;
		font-size: var(--text-md);
		color: var(--text-secondary);
	}
	.emclear {
		font-family: var(--font-display);
		font-weight: var(--weight-medium);
		font-size: var(--text-sm);
		color: var(--text-primary);
		background: var(--surface-card);
		border: 1.5px solid var(--border-strong);
		border-radius: var(--radius-md);
		padding: 7px 14px;
		cursor: pointer;
	}
	.emclear:hover {
		border-color: var(--color-accent);
		background: var(--terracotta-50);
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
		.filters .sort {
			margin-left: 0;
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
