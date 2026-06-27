<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import type { WorkGroup } from '$lib/workgroups';
	import WorkGroupConfigurator from './WorkGroupConfigurator.svelte';

	let {
		bulkGroup,
		analyzed,
		total,
		running,
		onApplyAll,
		onRunAll
	}: {
		bulkGroup: WorkGroup;
		analyzed: number;
		total: number;
		running: boolean;
		onApplyAll: (wg: WorkGroup) => void;
		onRunAll: () => void;
	} = $props();

	let bulkOpen = $state(false);
</script>

<div class="runctl">
	<button class="run-all" onclick={onRunAll} disabled={running || total === 0}>
		<Icon name="sparkles" size={15} />
		{running ? 'Running…' : 'Run all checks'}
	</button>

	<div class="meta">
		<span class="progress" class:done={analyzed === total && total > 0}>
			<Icon name={analyzed === total && total > 0 ? 'circle-check' : 'list-checks'} size={12} />
			{analyzed} / {total} analyzed
		</span>
		<button
			type="button"
			class="bulk-toggle"
			class:on={bulkOpen}
			onclick={() => (bulkOpen = !bulkOpen)}
			disabled={total === 0}
		>
			<Icon name="git-fork" size={12} /> One work group for all
			<Icon name={bulkOpen ? 'chevron-down' : 'chevron-right'} size={12} />
		</button>
	</div>

	{#if bulkOpen}
		<div class="bulk">
			<p class="bhint">
				Sets every claim to this work group at once. Tune any single claim afterwards in its panel.
			</p>
			<WorkGroupConfigurator value={bulkGroup} onChange={onApplyAll} compact />
		</div>
	{/if}
</div>

<style>
	.runctl {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		margin-bottom: var(--space-4);
		padding-bottom: var(--space-4);
		border-bottom: 1.5px solid var(--border-subtle);
	}
	.run-all {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		width: 100%;
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
	.meta {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		flex-wrap: wrap;
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
	.bulk-toggle {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 5px 9px;
		font-family: var(--font-display);
		font-weight: var(--weight-medium);
		font-size: var(--text-xs);
		color: var(--text-secondary);
		background: var(--surface-sunken);
		border: 1.5px solid var(--border-default);
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: all var(--duration-fast) var(--ease-out);
	}
	.bulk-toggle:hover:not(:disabled) {
		border-color: var(--border-strong);
		color: var(--text-primary);
	}
	.bulk-toggle.on {
		border-color: var(--color-accent);
		color: var(--text-primary);
	}
	.bulk-toggle:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.bulk {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding: var(--space-3);
		background: var(--surface-sunken);
		border-radius: var(--radius-md);
	}
	.bhint {
		margin: 0;
		font-size: var(--text-xs);
		color: var(--text-tertiary);
		line-height: var(--leading-normal);
	}
</style>
