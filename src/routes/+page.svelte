<script lang="ts">
	import Badge from '$lib/components/Badge.svelte';
	import ConfidenceMeter from '$lib/components/ConfidenceMeter.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { MATTER_STATUS } from '$lib/format';

	let { data } = $props();

	type Card = (typeof data.matters)[number];

	// Client-side filter/sort over the already-loaded matters (small list, no network).
	let q = $state('');
	let statusFilter = $state<'all' | 'open' | 'closed'>('all');
	let riskFilter = $state<'all' | 'high'>('all');
	let pendingFilter = $state<'all' | 'pending'>('all');
	let sortBy = $state('risk'); // risk | name | pending | confidence

	const filtered = $derived.by(() => {
		const needle = q.trim().toLowerCase();
		const rows = data.matters.filter((c) => {
			if (statusFilter !== 'all' && c.matter.status !== statusFilter) return false;
			if (riskFilter === 'high' && c.risk.high === 0) return false;
			if (pendingFilter === 'pending' && c.pending === 0) return false;
			if (needle) {
				const hay = `${c.matter.name} ${c.matter.ref} ${c.matter.client}`.toLowerCase();
				if (!hay.includes(needle)) return false;
			}
			return true;
		});
		const sorted = [...rows];
		if (sortBy === 'name') sorted.sort((a, b) => a.matter.name.localeCompare(b.matter.name));
		else if (sortBy === 'pending') sorted.sort((a, b) => b.pending - a.pending);
		else if (sortBy === 'confidence')
			sorted.sort((a, b) => (a.lowestConfidence ?? 1) - (b.lowestConfidence ?? 1));
		// risk-aware default: high-severity first, then pending, then lowest confidence.
		else
			sorted.sort(
				(a, b) =>
					b.risk.high - a.risk.high ||
					b.pending - a.pending ||
					(a.lowestConfidence ?? 1) - (b.lowestConfidence ?? 1) ||
					a.matter.name.localeCompare(b.matter.name)
			);
		return sorted;
	});

	const activeCount = $derived(
		(q.trim() ? 1 : 0) +
			(statusFilter !== 'all' ? 1 : 0) +
			(riskFilter !== 'all' ? 1 : 0) +
			(pendingFilter !== 'all' ? 1 : 0)
	);

	function clearAll() {
		q = '';
		statusFilter = 'all';
		riskFilter = 'all';
		pendingFilter = 'all';
	}
	function toggleStat(kind: 'open' | 'highRisk' | 'pending' | 'total') {
		if (kind === 'total') return clearAll();
		if (kind === 'open') statusFilter = statusFilter === 'open' ? 'all' : 'open';
		if (kind === 'highRisk') riskFilter = riskFilter === 'high' ? 'all' : 'high';
		if (kind === 'pending') pendingFilter = pendingFilter === 'pending' ? 'all' : 'pending';
	}
</script>

<section class="head">
	<span class="itaily-eyebrow">Matters</span>
	<h1>Matters awaiting your review</h1>
	<p class="sub">
		Each client engagement and the AI work products filed under it — highest-risk matters first, so
		the work most needing a human is at the top. Open a matter to review its work or add new work.
	</p>
</section>

<div class="stats">
	<button
		class="stat"
		class:on={statusFilter === 'open'}
		aria-pressed={statusFilter === 'open'}
		aria-label="Filter to open matters"
		onclick={() => toggleStat('open')}
	>
		<span class="n">{data.stats.open}</span><span class="l">Open matters</span>
	</button>
	<button
		class="stat"
		class:on={riskFilter === 'high'}
		aria-pressed={riskFilter === 'high'}
		aria-label="Filter to matters with high-severity risk"
		onclick={() => toggleStat('highRisk')}
	>
		<span class="n">{data.stats.highRisk}</span><span class="l">With high-severity risk</span>
	</button>
	<button
		class="stat"
		class:on={pendingFilter === 'pending'}
		aria-pressed={pendingFilter === 'pending'}
		aria-label="Filter to matters with pending work"
		onclick={() => toggleStat('pending')}
	>
		<span class="n">{data.stats.pending}</span><span class="l">With pending work</span>
	</button>
	<button
		class="stat"
		class:on={activeCount === 0}
		aria-label="Show all matters and clear filters"
		onclick={() => toggleStat('total')}
	>
		<span class="n">{data.stats.total}</span><span class="l">Total matters</span>
	</button>
</div>

<div class="toolbar">
	<div class="searchbox">
		<span class="si"><Icon name="search" size={16} /></span>
		<input
			type="search"
			bind:value={q}
			placeholder="Search matter, ref or client…"
			aria-label="Search matters"
		/>
		{#if q}
			<button class="clear-q" onclick={() => (q = '')} aria-label="Clear search">
				<Icon name="x" size={14} />
			</button>
		{/if}
	</div>

	<div class="filters">
		<select bind:value={sortBy} class="sort" aria-label="Sort order">
			<option value="risk">Sort: Risk</option>
			<option value="pending">Sort: Most pending</option>
			<option value="confidence">Sort: Lowest confidence</option>
			<option value="name">Sort: Name</option>
		</select>
	</div>

	<div class="resultline">
		<span class="count" role="status" aria-live="polite" aria-atomic="true">
			Showing <b>{filtered.length}</b> of {data.matters.length}
		</span>
		{#if activeCount > 0}
			<button class="clear-all" onclick={clearAll}>
				<Icon name="x" size={12} /> Clear {activeCount} filter{activeCount > 1 ? 's' : ''}
			</button>
		{/if}
	</div>
</div>

{#if data.matters.length === 0}
	<div class="empty">
		<Icon name="folder" size={30} color="var(--text-tertiary)" />
		<p class="emsg">No matters yet — create one to start filing AI work.</p>
	</div>
{:else if filtered.length === 0}
	<div class="empty">
		<Icon name="file-search" size={30} color="var(--text-tertiary)" />
		<p class="emsg">No matters match your filters.</p>
		<button class="emclear" onclick={clearAll}>Clear all filters</button>
	</div>
{:else}
	<ul class="mgrid">
		{#each filtered as c (c.matter.id)}
			<li>
				<a class="mcard" href="/matters/{c.matter.id}">
					<div class="mtop">
						<span class="mname">
							<Icon name={MATTER_STATUS[c.matter.status]?.icon ?? 'folder'} size={16} color="var(--color-accent)" />
							{c.matter.name}
						</span>
						<Badge tone={MATTER_STATUS[c.matter.status]?.tone ?? 'neutral'}>
							{MATTER_STATUS[c.matter.status]?.label ?? c.matter.status}
						</Badge>
					</div>
					<div class="mmeta">
						<span class="mref">{c.matter.ref}</span>
						{#if c.matter.client}<span class="dot">·</span><span class="mclient">{c.matter.client}</span>{/if}
					</div>
					{#if c.matter.description}
						<p class="mdesc">{c.matter.description}</p>
					{/if}
					<div class="mfoot">
						{#if c.count === 0}
							<span class="mzero">No work products yet</span>
						{:else}
							<span class="mstat"><Icon name="file-text" size={13} /> {c.count} work product{c.count === 1 ? '' : 's'}</span>
							{#if c.pending > 0}
								<span class="mstat"><Icon name="clock" size={13} /> {c.pending} pending</span>
							{/if}
							{#if c.risk.high > 0}
								<Badge tone="danger"><Icon name="triangle-alert" size={12} /> {c.risk.high} high-severity</Badge>
							{:else if c.risk.med > 0}
								<Badge tone="warning"><Icon name="shield-alert" size={12} /> {c.risk.med} medium</Badge>
							{:else if c.risk.total > 0}
								<Badge tone="neutral"><Icon name="shield" size={12} /> {c.risk.total} low</Badge>
							{:else}
								<Badge tone="success"><Icon name="shield-check" size={12} /> No risk flags</Badge>
							{/if}
							{#if c.effConfidence !== null}
								<span class="mconf">
									<ConfidenceMeter value={c.effConfidence} />
									<span class="mconf-l">avg confidence</span>
								</span>
							{/if}
						{/if}
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

	.mgrid {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 12px;
	}
	.mcard {
		display: flex;
		flex-direction: column;
		gap: 8px;
		height: 100%;
		background: var(--surface-card);
		border: 1.5px solid var(--border-default);
		border-left: 3px solid var(--color-accent);
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
	.mcard:hover {
		box-shadow: var(--shadow-md);
		transform: translateY(-2px);
		border-color: var(--border-strong);
		border-left-color: var(--color-accent);
	}
	.mtop {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}
	.mname {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-family: var(--font-display);
		font-size: var(--text-lg);
		font-weight: var(--weight-semibold);
		line-height: var(--leading-snug);
		color: var(--text-primary);
	}
	.mmeta {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: var(--text-xs);
		color: var(--text-tertiary);
	}
	.mref {
		font-family: var(--font-mono);
	}
	.mdesc {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--text-secondary);
		line-height: var(--leading-normal);
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.mfoot {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
		margin-top: auto;
		padding-top: 4px;
	}
	.mstat {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: var(--text-xs);
		color: var(--text-tertiary);
	}
	.mzero {
		font-size: var(--text-xs);
		color: var(--text-tertiary);
		font-style: italic;
	}
	.mconf {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		margin-left: auto;
	}
	.mconf-l {
		font-size: 10px;
		font-family: var(--font-mono);
		color: var(--text-tertiary);
		white-space: nowrap;
	}

	@media (max-width: 720px) {
		.stats {
			grid-template-columns: repeat(2, 1fr);
		}
		.mgrid {
			grid-template-columns: 1fr;
		}
	}
</style>
