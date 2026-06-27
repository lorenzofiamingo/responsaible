<script lang="ts">
	import { enhance } from '$app/forms';
	import { ACTION, REASON_REQUIRED } from '$lib/format';
	import Icon from './Icon.svelte';

	let { form = undefined }: { form?: { error?: string; action?: string } | null } = $props();

	const order = ['approve', 'amend', 'reject', 'request_rework', 'escalate', 'override'];

	let action = $state('');
	let reason = $state('');
	let submitting = $state(false);

	const needsReason = $derived(REASON_REQUIRED.has(action));
	const blocked = $derived(!action || (needsReason && reason.trim().length === 0));
</script>

<form
	class="acts"
	method="POST"
	action="?/act"
	use:enhance={() => {
		submitting = true;
		return async ({ update }) => {
			await update({ reset: false });
			submitting = false;
			action = '';
			reason = '';
		};
	}}
>
	<div class="grid">
		{#each order as a (a)}
			<label class="opt tone-{ACTION[a].tone}" class:sel={action === a}>
				<input type="radio" name="action" value={a} bind:group={action} />
				<Icon name={ACTION[a].icon} size={16} />
				<span>{ACTION[a].label}</span>
			</label>
		{/each}
	</div>

	<textarea
		name="reason"
		bind:value={reason}
		rows="3"
		placeholder={needsReason
			? 'Reason required for this action…'
			: 'Reason / note (optional but recorded)'}
	></textarea>

	{#if form?.error}
		<p class="err"><Icon name="triangle-alert" size={14} /> {form.error}</p>
	{/if}

	<div class="foot">
		<span class="hint">
			{#if needsReason}
				<Icon name="lock" size={12} /> A reason is required and written to the audit trail.
			{:else}
				<Icon name="lock" size={12} /> Every decision is hash-chained into the audit trail.
			{/if}
		</span>
		<button class="submit" type="submit" disabled={blocked || submitting}>
			{submitting ? 'Recording…' : 'Record decision'}
			<Icon name="arrow-right" size={16} />
		</button>
	</div>
</form>

<style>
	.grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 8px;
		margin-bottom: var(--space-4);
	}
	.opt {
		display: flex;
		align-items: center;
		gap: 7px;
		padding: 10px 12px;
		border: 1.5px solid var(--border-default);
		border-radius: var(--radius-md);
		background: var(--surface-card);
		cursor: pointer;
		font-family: var(--font-display);
		font-weight: var(--weight-medium);
		font-size: var(--text-sm);
		color: var(--text-secondary);
		transition: all var(--duration-fast) var(--ease-out);
	}
	.opt:hover {
		border-color: var(--border-strong);
	}
	.opt input {
		position: absolute;
		opacity: 0;
		width: 0;
		height: 0;
	}
	.opt.sel {
		color: var(--text-primary);
		border-color: var(--color-accent);
		background: var(--terracotta-50);
		box-shadow: var(--shadow-focus);
	}
	textarea {
		width: 100%;
		border: 1.5px solid var(--border-strong);
		border-radius: var(--radius-md);
		background: var(--surface-card);
		padding: 12px;
		font-family: var(--font-sans);
		font-size: var(--text-base);
		color: var(--text-primary);
		resize: vertical;
		line-height: var(--leading-normal);
	}
	textarea:focus {
		outline: none;
		border-color: var(--border-focus);
		box-shadow: var(--shadow-focus);
	}
	.err {
		display: flex;
		align-items: center;
		gap: 6px;
		margin: 10px 0 0;
		font-size: var(--text-sm);
		color: var(--status-danger-fg);
	}
	.foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
		margin-top: var(--space-4);
	}
	.hint {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: var(--text-xs);
		color: var(--text-tertiary);
	}
	.submit {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-family: var(--font-display);
		font-weight: var(--weight-medium);
		font-size: var(--text-base);
		color: var(--color-on-accent);
		background: var(--color-accent);
		border: 1.5px solid transparent;
		border-radius: var(--radius-md);
		height: 42px;
		padding: 0 var(--space-5);
		cursor: pointer;
	}
	.submit:hover {
		background: var(--color-accent-hover);
	}
	.submit:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
</style>
