<script lang="ts">
	import Badge from '$lib/components/Badge.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { CAN_SUBMIT, fmtDate, KNOWLEDGE_CATEGORY, KNOWLEDGE_CATEGORY_ORDER } from '$lib/format';

	let { data } = $props();

	const canSubmit = $derived(!!data.user && CAN_SUBMIT.has(data.user.role));

	// --- Search & filter (all client-side: the whole corpus is loaded, so filtering
	// is instant and survives no network — same approach as the queue/matters lists). ---
	let q = $state('');
	let categoryFilter = $state('all');
	let sortBy = $state('recent'); // recent | title | category

	const cat = (c: string) => KNOWLEDGE_CATEGORY[c] ?? KNOWLEDGE_CATEGORY.memo;
	const tagList = (tags: string) =>
		tags
			.split(/[,\n]/)
			.map((t) => t.trim())
			.filter(Boolean);
	const snippet = (body: string) => {
		const s = body.replace(/\s+/g, ' ').trim();
		return s.length > 220 ? s.slice(0, 217).trimEnd() + '…' : s;
	};

	const filtered = $derived.by(() => {
		const needle = q.trim().toLowerCase();
		const rows = data.docs.filter((d) => {
			if (categoryFilter !== 'all' && d.category !== categoryFilter) return false;
			if (needle) {
				const hay = `${d.title} ${d.tags} ${d.body} ${d.sourceRef} ${cat(d.category).label}`.toLowerCase();
				if (!hay.includes(needle)) return false;
			}
			return true;
		});
		const sorted = [...rows];
		if (sortBy === 'title') sorted.sort((a, b) => a.title.localeCompare(b.title));
		else if (sortBy === 'category') sorted.sort((a, b) => a.category.localeCompare(b.category) || a.title.localeCompare(b.title));
		else sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
		return sorted;
	});

	const activeCount = $derived((q.trim() ? 1 : 0) + (categoryFilter !== 'all' ? 1 : 0));

	function clearAll() {
		q = '';
		categoryFilter = 'all';
	}
	function toggleCategory(c: string) {
		categoryFilter = categoryFilter === c ? 'all' : c;
	}
</script>

<section class="head">
	<div class="head-row">
		<div>
			<span class="itaily-eyebrow">Firm knowledge</span>
			<h1>The firm's private corpus</h1>
		</div>
		{#if canSubmit}
			<a class="add" href="/knowledge/new">
				<Icon name="book-open" size={14} /> <span>Add document</span>
			</a>
		{/if}
	</div>
	<p class="sub">
		The firm's confidential memos, precedents, playbook clauses and guidance — shared across every
		matter. The Knowledge researcher draws on this corpus on-perimeter, so nothing here leaves the firm.
	</p>
</section>

<div class="stats">
	<button
		class="stat"
		class:on={activeCount === 0}
		aria-label="Show all documents and clear filters"
		onclick={clearAll}
	>
		<span class="n">{data.stats.total}</span><span class="l">All documents</span>
	</button>
	{#each KNOWLEDGE_CATEGORY_ORDER as c (c)}
		<button
			class="stat"
			class:on={categoryFilter === c}
			aria-pressed={categoryFilter === c}
			aria-label={`Filter to ${cat(c).label}`}
			onclick={() => toggleCategory(c)}
		>
			<span class="n">{data.stats[c]}</span>
			<span class="l"><Icon name={cat(c).icon} size={12} /> {cat(c).label}</span>
		</button>
	{/each}
</div>

<div class="toolbar">
	<div class="searchbox">
		<span class="si"><Icon name="search" size={16} /></span>
		<input
			type="search"
			bind:value={q}
			placeholder="Search title, tag, reference or text…"
			aria-label="Search firm knowledge"
		/>
		{#if q}
			<button class="clear-q" onclick={() => (q = '')} aria-label="Clear search">
				<Icon name="x" size={14} />
			</button>
		{/if}
	</div>

	<div class="filters">
		<select bind:value={categoryFilter} class:on={categoryFilter !== 'all'} aria-label="Filter by category">
			<option value="all">All categories</option>
			{#each KNOWLEDGE_CATEGORY_ORDER as c (c)}
				<option value={c}>{cat(c).label}</option>
			{/each}
		</select>

		<select bind:value={sortBy} class="sort" aria-label="Sort order">
			<option value="recent">Sort: Most recent</option>
			<option value="title">Sort: Title</option>
			<option value="category">Sort: Category</option>
		</select>
	</div>

	<div class="resultline">
		<span class="count" role="status" aria-live="polite" aria-atomic="true">
			Showing <b>{filtered.length}</b> of {data.docs.length}
		</span>
		{#if activeCount > 0}
			<button class="clear-all" onclick={clearAll}>
				<Icon name="x" size={12} /> Clear {activeCount} filter{activeCount > 1 ? 's' : ''}
			</button>
		{/if}
	</div>
</div>

{#if data.docs.length === 0}
	<div class="empty">
		<Icon name="book-open" size={30} color="var(--text-tertiary)" />
		<p class="emsg">The firm knowledge base is empty — no documents have been added yet.</p>
		{#if canSubmit}
			<a class="emadd" href="/knowledge/new"><Icon name="book-open" size={14} /> Add the first document</a>
		{/if}
	</div>
{:else if filtered.length === 0}
	<div class="empty">
		<Icon name="file-search" size={30} color="var(--text-tertiary)" />
		<p class="emsg">No documents match your filters.</p>
		<button class="emclear" onclick={clearAll}>Clear all filters</button>
	</div>
{:else}
	<ul class="list">
		{#each filtered as d (d.id)}
			<li class="kcard">
				<span class="kicon" style="color: var(--color-accent)"><Icon name={cat(d.category).icon} size={18} /></span>
				<div class="kmain">
					<div class="ktop">
						<Badge tone={cat(d.category).tone}><Icon name={cat(d.category).icon} size={11} /> {cat(d.category).label}</Badge>
						<h2 class="ktitle">{d.title}</h2>
					</div>
					<p class="kbody">{snippet(d.body)}</p>
					{#if tagList(d.tags).length}
						<div class="tags">
							{#each tagList(d.tags).slice(0, 8) as t (t)}
								<span class="tag">{t}</span>
							{/each}
						</div>
					{/if}
					<div class="kmeta">
						{#if d.sourceRef}
							<span class="m mono"><Icon name="lock" size={12} /> {d.sourceRef}</span>
						{/if}
						<span class="m mono"><Icon name="clock" size={12} /> {fmtDate(d.createdAt)}</span>
					</div>
				</div>
			</li>
		{/each}
	</ul>
{/if}

<style>
	.head {
		margin-bottom: var(--space-5);
	}
	.head-row {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 16px;
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
	.add {
		flex: none;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-family: var(--font-display);
		font-weight: var(--weight-medium);
		font-size: var(--text-sm);
		color: var(--text-primary);
		text-decoration: none;
		background: var(--surface-card);
		border: 1.5px solid var(--border-strong);
		border-radius: var(--radius-md);
		padding: 8px 14px;
	}
	.add:hover {
		border-color: var(--color-accent);
		background: var(--terracotta-50);
	}

	.stats {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
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
		display: inline-flex;
		align-items: center;
		gap: 5px;
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
	.emclear,
	.emadd {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-family: var(--font-display);
		font-weight: var(--weight-medium);
		font-size: var(--text-sm);
		color: var(--text-primary);
		text-decoration: none;
		background: var(--surface-card);
		border: 1.5px solid var(--border-strong);
		border-radius: var(--radius-md);
		padding: 7px 14px;
		cursor: pointer;
	}
	.emclear:hover,
	.emadd:hover {
		border-color: var(--color-accent);
		background: var(--terracotta-50);
	}

	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.kcard {
		display: flex;
		gap: 14px;
		background: var(--surface-card);
		border: 1.5px solid var(--border-default);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-xs);
		padding: var(--space-4) var(--space-5);
	}
	.kicon {
		flex: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		border-radius: var(--radius-md);
		background: var(--terracotta-50);
		margin-top: 2px;
	}
	.kmain {
		min-width: 0;
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.ktop {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
	}
	.ktitle {
		margin: 0;
		font-size: var(--text-md);
		font-weight: var(--weight-medium);
		color: var(--text-primary);
		line-height: var(--leading-snug);
	}
	.kbody {
		margin: 0;
		color: var(--text-secondary);
		font-size: var(--text-sm);
		line-height: var(--leading-normal);
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.tag {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--text-tertiary);
		background: var(--surface-sunken);
		border: 1px solid var(--border-default);
		border-radius: var(--radius-sm);
		padding: 2px 7px;
	}
	.kmeta {
		display: flex;
		align-items: center;
		gap: 16px;
		flex-wrap: wrap;
	}
	.kmeta .m {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: var(--text-xs);
		color: var(--text-tertiary);
	}
	.kmeta .mono {
		font-family: var(--font-mono);
	}

	@media (max-width: 720px) {
		.stats {
			grid-template-columns: repeat(2, 1fr);
		}
		.filters .sort {
			margin-left: 0;
		}
	}
</style>
