<script lang="ts">
	import type { Snippet } from 'svelte';
	import Button from '$lib/components/Button.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import Modal from '$lib/components/Modal.svelte';

	// A confirm/cancel dialog for a destructive action. `onConfirm` may be async —
	// the dialog shows a busy state while it runs and surfaces any thrown error
	// inline instead of closing, so the parent only has to clear `open` on success.
	let {
		open,
		title,
		confirmLabel = 'Delete',
		cancelLabel = 'Cancel',
		tone = 'danger',
		onConfirm,
		onClose,
		children
	}: {
		open: boolean;
		title: string;
		confirmLabel?: string;
		cancelLabel?: string;
		tone?: 'danger' | 'primary';
		onConfirm: () => void | Promise<void>;
		onClose: () => void;
		children: Snippet;
	} = $props();

	let busy = $state(false);
	let error = $state('');

	// Reset transient state each time the dialog is (re)opened.
	$effect(() => {
		if (open) {
			busy = false;
			error = '';
		}
	});

	async function confirm() {
		busy = true;
		error = '';
		try {
			await onConfirm();
		} catch (e) {
			error = (e as Error)?.message || 'Something went wrong.';
			busy = false;
			return;
		}
		busy = false;
	}

	function close() {
		if (!busy) onClose();
	}
</script>

<Modal {open} {title} onClose={close}>
	<div class="cbody">
		{@render children()}
		{#if error}
			<p class="cerr"><Icon name="triangle-alert" size={14} /> {error}</p>
		{/if}
	</div>
	{#snippet footer()}
		<Button variant="ghost" size="sm" onclick={close} disabled={busy}>{cancelLabel}</Button>
		<Button variant={tone} size="sm" onclick={confirm} disabled={busy} icon={busy ? undefined : 'trash-2'}>
			{busy ? 'Deleting…' : confirmLabel}
		</Button>
	{/snippet}
</Modal>

<style>
	.cbody {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		font-size: var(--text-sm);
		color: var(--text-secondary);
		line-height: var(--leading-normal);
	}
	.cerr {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		margin: 0;
		font-size: var(--text-sm);
		color: var(--status-danger-fg, var(--color-accent));
	}
</style>
