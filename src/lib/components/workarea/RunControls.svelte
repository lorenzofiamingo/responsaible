<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import type { WorkGroup } from '$lib/workgroups';
	import WorkGroupConfigurator from './WorkGroupConfigurator.svelte';

	let {
		globalGroup,
		applyAll,
		analyzed,
		total,
		running,
		onModeChange,
		onGlobalChange,
		onRunAll
	}: {
		globalGroup: WorkGroup;
		applyAll: boolean;
		analyzed: number;
		total: number;
		running: boolean;
		onModeChange: (applyAll: boolean) => void;
		onGlobalChange: (wg: WorkGroup) => void;
		onRunAll: () => void;
	} = $props();
</script>

<section class="controls">
	<div class="bar">
		<div class="left">
			<h2 class="title"><Icon name="git-branch" size={16} /> Run the agents</h2>
			<span class="progress" class:done={analyzed === total && total > 0}>
				<Icon name={analyzed === total && total > 0 ? 'circle-check' : 'list-checks'} size={13} />
				{analyzed} / {total} claims analyzed
			</span>
		</div>
		<button class="run-all" onclick={onRunAll} disabled={running || total === 0}>
			<Icon name="sparkles" size={15} />
			{running ? 'Running…' : 'Run all in parallel'}
		</button>
	</div>

	<div class="mode" role="group" aria-label="work group mode">
		<button type="button" class="mtab" class:on={!applyAll} onclick={() => onModeChange(false)}>
			<Icon name="git-fork" size={13} /> Per-claim presets
		</button>
		<button type="button" class="mtab" class:on={applyAll} onclick={() => onModeChange(true)}>
			<Icon name="list-checks" size={13} /> One work group for all
		</button>
	</div>

	{#if applyAll}
		<div class="global">
			<p class="ghint">This work group runs against every claim, overriding the per-claim presets.</p>
			<WorkGroupConfigurator value={globalGroup} onChange={onGlobalChange} />
		</div>
	{:else}
		<p class="ghint auto">
			Each claim keeps the preset the splitter assigned to it (citation-heavy claims get the deep
			check). Override any single claim in its detail panel.
		</p>
	{/if}
</section>

<style>
	.controls {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		background: var(--surface-card);
		border: 1.5px solid var(--border-default);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-sm);
		padding: var(--space-4) var(--space-5);
	}
	.bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
		flex-wrap: wrap;
	}
	.left {
		display: flex;
		align-items: center;
		gap: 14px;
		flex-wrap: wrap;
	}
	.title {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 0;
		font-size: var(--text-md);
	}
	.progress {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--text-tertiary);
	}
	.progress.done {
		color: var(--status-success-fg);
	}
	.run-all {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 10px 16px;
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
	.run-all:hover:not(:disabled) {
		background: var(--color-accent-hover);
	}
	.run-all:disabled {
		opacity: 0.6;
		cursor: progress;
	}
	.mode {
		display: inline-flex;
		gap: 4px;
		padding: 3px;
		background: var(--surface-sunken);
		border-radius: var(--radius-md);
		width: fit-content;
	}
	.mtab {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 6px 12px;
		font-family: var(--font-display);
		font-weight: var(--weight-medium);
		font-size: var(--text-sm);
		color: var(--text-secondary);
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		cursor: pointer;
	}
	.mtab.on {
		background: var(--surface-card);
		color: var(--text-primary);
		box-shadow: var(--shadow-xs);
	}
	.global {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.ghint {
		margin: 0;
		font-size: var(--text-xs);
		color: var(--text-tertiary);
		line-height: var(--leading-normal);
	}
	.ghint.auto {
		max-width: 70ch;
	}
</style>
