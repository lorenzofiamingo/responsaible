<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import Badge from '$lib/components/Badge.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import ContextMenu from '$lib/components/ContextMenu.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import QueueRow from '$lib/components/QueueRow.svelte';
	import { CAN_SUBMIT, MATTER_STATUS } from '$lib/format';

	let { data } = $props();

	const canSubmit = $derived(!!data.user && CAN_SUBMIT.has(data.user.role));
	const m = $derived(data.matter);
	const count = $derived(data.queue.length);
	const pending = $derived(data.queue.filter((w) => w.status === 'pending').length);
	const highRisk = $derived(data.queue.reduce((n, w) => n + w.risk.high, 0));

	// --- Right-click → delete a work product from this matter (supervisor only). ---
	type WP = (typeof data.queue)[number];
	let menu = $state<{ open: boolean; x: number; y: number; wp: WP | null }>({
		open: false,
		x: 0,
		y: 0,
		wp: null
	});
	let confirmOpen = $state(false);

	function openMenu(e: MouseEvent, wp: WP) {
		if (!canSubmit) return;
		e.preventDefault();
		menu = { open: true, x: e.clientX, y: e.clientY, wp };
	}
	function requestDelete() {
		menu = { ...menu, open: false };
		confirmOpen = true;
	}
	async function doDelete() {
		const wp = menu.wp;
		if (!wp) return;
		const res = await fetch(`/api/work-products/${wp.id}`, { method: 'DELETE' });
		if (!res.ok) {
			const out = (await res.json().catch(() => ({}))) as { error?: string };
			throw new Error(out.error ?? `Could not delete the work product (HTTP ${res.status}).`);
		}
		await invalidateAll();
		confirmOpen = false;
	}
</script>

<a class="back" href="/"><Icon name="arrow-right" size={14} class="flip" /> Back to matters</a>

<header class="hdr">
	<div class="htext">
		<div class="eyebrow itaily-eyebrow">
			<Icon name={MATTER_STATUS[m.status]?.icon ?? 'folder'} size={13} />
			<span>Matter · {m.ref}</span>
		</div>
		<div class="titlerow">
			<h1>{m.name}</h1>
			<Badge tone={MATTER_STATUS[m.status]?.tone ?? 'neutral'}>
				{MATTER_STATUS[m.status]?.label ?? m.status}
			</Badge>
		</div>
		{#if m.client}<p class="client">{m.client}</p>{/if}
		{#if m.description}<p class="desc">{m.description}</p>{/if}
		<div class="meta">
			<span class="mi"><Icon name="file-text" size={13} /> {count} work product{count === 1 ? '' : 's'}</span>
			{#if pending > 0}<span class="mi"><Icon name="clock" size={13} /> {pending} pending</span>{/if}
			{#if highRisk > 0}
				<span class="mi danger"><Icon name="triangle-alert" size={13} /> {highRisk} high-severity risk</span>
			{/if}
		</div>
	</div>
	{#if canSubmit}
		<a class="add" href="/new?matter={m.id}" title="Add a new work product to this matter">
			<Icon name="file-text" size={16} /> <span>Add new work product</span>
		</a>
	{/if}
</header>

{#if count === 0}
	<div class="empty">
		<Icon name="file-text" size={30} color="var(--text-tertiary)" />
		<p class="emsg">No work products in this matter yet.</p>
		{#if canSubmit}
			<a class="emadd" href="/new?matter={m.id}"><Icon name="file-text" size={14} /> Add new work product</a>
		{/if}
	</div>
{:else}
	<ul class="queue">
		{#each data.queue as wp (wp.id)}
			<li class:armed={menu.wp?.id === wp.id && (menu.open || confirmOpen)} oncontextmenu={(e) => openMenu(e, wp)}>
				<QueueRow {wp} showMatter={false} />
			</li>
		{/each}
	</ul>
{/if}

{#if canSubmit}
	<ContextMenu open={menu.open} x={menu.x} y={menu.y} onClose={() => (menu = { ...menu, open: false })}>
		<button type="button" class="cmenu-item danger" role="menuitem" onclick={requestDelete}>
			<Icon name="trash-2" size={15} /> Delete work product
		</button>
	</ContextMenu>

	<ConfirmDialog
		open={confirmOpen}
		title="Delete work product?"
		confirmLabel="Delete work product"
		onConfirm={doDelete}
		onClose={() => (confirmOpen = false)}
	>
		<p>
			Permanently delete <strong>“{menu.wp?.title}”</strong> and everything generated for it — its
			agent trace, citations, risk signals and per-claim analysis?
		</p>
		<p class="cnote">
			The insert-only supervisory audit trail is preserved: any actions already recorded against this
			work product stay in the hash-chained ledger. This cannot be undone.
		</p>
	</ConfirmDialog>
{/if}

<style>
	.back {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: var(--text-sm);
		color: var(--text-secondary);
		text-decoration: none;
		margin-bottom: var(--space-4);
	}
	.back:hover {
		color: var(--text-link);
	}
	.back :global(.flip) {
		transform: rotate(180deg);
	}

	.hdr {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-4);
		margin-bottom: var(--space-5);
	}
	.htext {
		min-width: 0;
	}
	.eyebrow {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		margin-bottom: 8px;
	}
	.titlerow {
		display: flex;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
	}
	.hdr h1 {
		font-size: var(--text-2xl);
		margin: 0;
		line-height: var(--leading-snug);
	}
	.client {
		margin: 8px 0 0;
		font-size: var(--text-md);
		color: var(--text-secondary);
	}
	.desc {
		margin: 8px 0 0;
		max-width: 80ch;
		font-size: var(--text-sm);
		color: var(--text-secondary);
		line-height: var(--leading-normal);
	}
	.meta {
		display: flex;
		align-items: center;
		gap: 16px;
		flex-wrap: wrap;
		margin-top: 12px;
	}
	.mi {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: var(--text-xs);
		color: var(--text-tertiary);
	}
	.mi.danger {
		color: var(--status-danger-fg, var(--color-accent));
	}

	.add {
		flex-shrink: 0;
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
		padding: 9px 14px;
		box-shadow: var(--shadow-xs);
		transition:
			border-color var(--duration-fast) var(--ease-out),
			background var(--duration-fast) var(--ease-out);
	}
	.add:hover {
		border-color: var(--color-accent);
		background: var(--terracotta-50);
	}
	.add:focus-visible {
		outline: none;
		box-shadow: var(--shadow-focus);
	}

	.queue {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	/* Outline the row whose context menu / confirm dialog is currently open. */
	.queue li.armed {
		border-radius: var(--radius-lg);
		box-shadow: 0 0 0 2px var(--color-accent);
	}
	.cnote {
		margin: 0;
		font-size: var(--text-xs);
		color: var(--text-tertiary);
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
		padding: 8px 14px;
	}
	.emadd:hover {
		border-color: var(--color-accent);
		background: var(--terracotta-50);
	}

	@media (max-width: 600px) {
		.hdr {
			flex-direction: column;
		}
	}
</style>
