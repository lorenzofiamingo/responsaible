<script lang="ts">
	import { TRACE_KIND } from '$lib/format';
	import type { AgentAction } from '$lib/types';
	import Icon from './Icon.svelte';

	let { actions }: { actions: AgentAction[] } = $props();
</script>

<ol class="timeline">
	{#each actions as a (a.id)}
		<li class="step">
			<span class="dot">
				<Icon name={TRACE_KIND[a.kind]?.icon ?? 'git-branch'} size={13} color="var(--color-accent)" />
			</span>
			<div class="body">
				<div class="head">
					<span class="kind">{TRACE_KIND[a.kind]?.label ?? a.kind}</span>
					{#if a.actorAgent}<span class="agent">{a.actorAgent}</span>{/if}
				</div>
				<p class="summary">{a.summary}</p>
				{#if a.detail}
					<details class="detail">
						<summary>Detail</summary>
						<pre>{JSON.stringify(a.detail, null, 2)}</pre>
					</details>
				{/if}
			</div>
		</li>
	{/each}
</ol>

<style>
	.timeline {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.step {
		position: relative;
		display: grid;
		grid-template-columns: 28px 1fr;
		gap: 12px;
		padding-bottom: var(--space-5);
	}
	.step:not(:last-child)::before {
		content: '';
		position: absolute;
		left: 13px;
		top: 26px;
		bottom: 0;
		width: 1.5px;
		background: var(--border-default);
	}
	.dot {
		width: 26px;
		height: 26px;
		border-radius: var(--radius-pill);
		background: var(--terracotta-50);
		border: 1.5px solid var(--terracotta-200);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1;
	}
	.head {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 3px;
	}
	.kind {
		font-family: var(--font-display);
		font-weight: var(--weight-semibold);
		font-size: var(--text-sm);
		color: var(--text-primary);
	}
	.agent {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--text-tertiary);
		background: var(--surface-sunken);
		padding: 1px 7px;
		border-radius: var(--radius-xs);
	}
	.summary {
		margin: 4px 0 0;
		font-size: var(--text-sm);
		line-height: var(--leading-normal);
		color: var(--text-secondary);
	}
	.detail {
		margin-top: 8px;
	}
	.detail summary {
		cursor: pointer;
		font-size: var(--text-xs);
		color: var(--text-link);
		font-family: var(--font-mono);
	}
	.detail pre {
		margin: 8px 0 0;
		padding: 10px 12px;
		background: var(--surface-sunken);
		border: 1.5px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		line-height: var(--leading-normal);
		color: var(--text-secondary);
		overflow-x: auto;
		white-space: pre-wrap;
		word-break: break-word;
	}
</style>
