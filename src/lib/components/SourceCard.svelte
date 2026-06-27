<script lang="ts">
	import type { Citation } from '$lib/types';
	import Icon from './Icon.svelte';
	import VerifyBadge from './VerifyBadge.svelte';

	let { citation: c }: { citation: Citation } = $props();
</script>

<div class="src">
	<div class="top">
		<div class="ref">
			{#if c.marker != null}<span class="marker">{c.marker}</span>{/if}
			<span class="locator">{c.locator || c.title}</span>
		</div>
		<VerifyBadge status={c.verifyStatus} />
	</div>

	<div class="title">{c.title}</div>

	{#if c.snippet}
		<p class="excerpt">«{c.snippet}»</p>
	{/if}

	{#if c.claim}
		<p class="claim"><span class="lbl">Supports:</span> {c.claim}</p>
	{/if}

	<div class="meta">
		{#if c.celex}<span class="celex">CELEX {c.celex}</span>{/if}
		{#if c.sourceUrl}
			<a class="link" href={c.sourceUrl} target="_blank" rel="noreferrer">
				EUR-Lex <Icon name="external-link" size={12} />
			</a>
		{/if}
	</div>
</div>

<style>
	.src {
		background: var(--surface-card);
		border: 1.5px solid var(--border-default);
		border-left: 3px solid var(--color-accent);
		border-radius: var(--radius-md);
		padding: var(--space-4);
	}
	.top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		margin-bottom: 8px;
	}
	.ref {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
	}
	.marker {
		flex: none;
		width: 18px;
		height: 18px;
		border-radius: 4px;
		background: var(--terracotta-100);
		color: var(--terracotta-800);
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 700;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}
	.locator {
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		color: var(--terracotta-700);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.title {
		font-family: var(--font-display);
		font-size: var(--text-sm);
		font-weight: var(--weight-semibold);
		color: var(--text-primary);
		margin-bottom: 6px;
	}
	.excerpt {
		margin: 0 0 8px;
		font-family: var(--font-serif);
		font-style: italic;
		font-size: var(--text-base);
		line-height: var(--leading-relaxed);
		color: var(--neutral-700);
	}
	.claim {
		margin: 0 0 8px;
		font-size: var(--text-sm);
		color: var(--text-secondary);
		line-height: var(--leading-normal);
	}
	.claim .lbl {
		font-weight: var(--weight-semibold);
		color: var(--text-tertiary);
	}
	.meta {
		display: flex;
		align-items: center;
		gap: 14px;
		flex-wrap: wrap;
	}
	.celex {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--text-tertiary);
	}
	.link {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--text-link);
	}
</style>
