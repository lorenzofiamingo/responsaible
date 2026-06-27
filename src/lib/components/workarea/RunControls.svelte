<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import Modal from '$lib/components/Modal.svelte';
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
	// Edits stay local until the lawyer confirms, so closing the modal (Cancel /
	// Escape / backdrop) discards them instead of mutating every claim. The initial
	// value is a placeholder — openBulk() always reseeds it from the live bulkGroup.
	// svelte-ignore state_referenced_locally
	let draft = $state<WorkGroup>(bulkGroup);

	function openBulk() {
		draft = bulkGroup;
		bulkOpen = true;
	}

	function applyBulk() {
		onApplyAll(draft);
		bulkOpen = false;
	}
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
		<button type="button" class="bulk-toggle" onclick={openBulk} disabled={total === 0}>
			<Icon name="git-fork" size={12} /> Set one work group for all
		</button>
	</div>
</div>

<Modal open={bulkOpen} title="Set one work group for all" onClose={() => (bulkOpen = false)}>
	<p class="bhint">
		Applies one work group to all {total} claim{total === 1 ? '' : 's'} at once. Tune any single
		claim afterwards in its panel.
	</p>
	<WorkGroupConfigurator value={draft} onChange={(wg) => (draft = wg)} />
	{#snippet footer()}
		<button type="button" class="btn-ghost" onclick={() => (bulkOpen = false)}>Cancel</button>
		<button type="button" class="btn-accent" onclick={applyBulk} disabled={total === 0}>
			<Icon name="git-fork" size={14} /> Apply to all {total} claim{total === 1 ? '' : 's'}
		</button>
	{/snippet}
</Modal>

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
	.bulk-toggle:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Rendered inside the Modal via snippets, but authored (and thus style-scoped)
	   here. */
	.bhint {
		margin: 0 0 var(--space-4);
		font-size: var(--text-sm);
		color: var(--text-tertiary);
		line-height: var(--leading-normal);
	}
	.btn-ghost,
	.btn-accent {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 8px 14px;
		font-family: var(--font-display);
		font-weight: var(--weight-medium);
		font-size: var(--text-sm);
		border-radius: var(--radius-md);
		cursor: pointer;
		transition: all var(--duration-fast) var(--ease-out);
	}
	.btn-ghost {
		color: var(--text-secondary);
		background: var(--surface-card);
		border: 1.5px solid var(--border-default);
	}
	.btn-ghost:hover {
		border-color: var(--border-strong);
		color: var(--text-primary);
	}
	.btn-accent {
		color: var(--color-on-accent);
		background: var(--color-accent);
		border: 1.5px solid transparent;
	}
	.btn-accent:hover:not(:disabled) {
		background: var(--color-accent-hover);
	}
	.btn-accent:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
</style>
