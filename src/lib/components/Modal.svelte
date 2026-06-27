<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from '$lib/components/Icon.svelte';

	let {
		open,
		title,
		onClose,
		children,
		footer
	}: {
		open: boolean;
		title: string;
		onClose: () => void;
		children: Snippet;
		footer?: Snippet;
	} = $props();

	let dialog = $state<HTMLDialogElement | null>(null);
	// Track where the press started so a drag-select that ends on the backdrop
	// (e.g. selecting text inside an input) doesn't dismiss the dialog.
	let downOnBackdrop = $state(false);

	// Drive the native dialog from the `open` prop. showModal() puts the element
	// in the top layer — above every z-index stacking context — and gives us
	// Escape-to-close, focus trapping, and the ::backdrop scrim for free.
	$effect(() => {
		const el = dialog;
		if (!el) return;
		if (open && !el.open) el.showModal();
		else if (!open && el.open) el.close();
	});

	// Keep the parent's `open` in sync whenever the dialog closes itself. We listen
	// on `cancel` (fires synchronously on Escape, before the async `close` event)
	// as well as `close`, so the parent never lags behind a native dismissal —
	// otherwise `open` could stay stuck `true` while the dialog is shut, leaving it
	// impossible to reopen.
	function syncClosed() {
		if (open) onClose();
	}

	function handleMousedown(e: MouseEvent) {
		downOnBackdrop = e.target === dialog;
	}

	function handleClick(e: MouseEvent) {
		if (downOnBackdrop && e.target === dialog) onClose();
		downOnBackdrop = false;
	}
</script>

<dialog
	bind:this={dialog}
	class="modal"
	aria-label={title}
	oncancel={syncClosed}
	onclose={syncClosed}
	onmousedown={handleMousedown}
	onclick={handleClick}
>
	<div class="inner">
		<header class="mhead">
			<h2 class="mtitle">{title}</h2>
			<button type="button" class="close" onclick={onClose} aria-label="Close">
				<Icon name="x" size={16} />
			</button>
		</header>
		<div class="mbody">
			{@render children()}
		</div>
		{#if footer}
			<footer class="mfoot">
				{@render footer()}
			</footer>
		{/if}
	</div>
</dialog>

<style>
	/* Center explicitly rather than relying on the UA dialog's margin:auto, which
	   needs a definite height to center vertically. top/left/translate works with
	   the auto content height the modal actually has. */
	.modal {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		margin: 0;
		width: min(560px, calc(100vw - var(--space-5)));
		max-height: calc(100vh - var(--space-6));
		padding: 0;
		background: var(--surface-card);
		border: 1.5px solid var(--border-default);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-lg);
		color: var(--text-primary);
		overflow: hidden;
	}
	/* Keyframes (not @starting-style transitions) for a reliable entrance that
	   always settles on the resting opacity:1 / centered transform. */
	.modal[open] {
		animation: modal-in var(--duration-normal) var(--ease-out);
	}
	.modal::backdrop {
		background: rgba(27, 25, 22, 0.45);
	}
	.modal[open]::backdrop {
		animation: backdrop-in var(--duration-normal) var(--ease-out);
	}
	@keyframes modal-in {
		from {
			opacity: 0;
			transform: translate(-50%, calc(-50% + 8px)) scale(0.985);
		}
		to {
			opacity: 1;
			transform: translate(-50%, -50%) scale(1);
		}
	}
	@keyframes backdrop-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.modal[open],
		.modal[open]::backdrop {
			animation: none;
		}
	}

	.inner {
		display: flex;
		flex-direction: column;
		max-height: calc(100vh - var(--space-6));
	}
	.mhead {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		padding: var(--space-4) var(--space-5);
		border-bottom: 1.5px solid var(--border-subtle);
	}
	.mtitle {
		margin: 0;
		font-size: var(--text-md);
	}
	.close {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		padding: 0;
		color: var(--text-tertiary);
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: all var(--duration-fast) var(--ease-out);
	}
	.close:hover {
		background: var(--surface-sunken);
		color: var(--text-primary);
	}
	.mbody {
		padding: var(--space-5);
		overflow-y: auto;
		min-height: 0;
	}
	.mfoot {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: var(--space-3);
		padding: var(--space-4) var(--space-5);
		border-top: 1.5px solid var(--border-subtle);
		background: var(--surface-sunken);
	}
</style>
