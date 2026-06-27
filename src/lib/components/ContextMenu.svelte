<script lang="ts">
	import type { Snippet } from 'svelte';
	import { tick } from 'svelte';

	// A small right-click popup, positioned at the cursor. Controlled by the parent
	// via `open` + `x`/`y` (viewport coordinates from the contextmenu event). It
	// closes on Escape, scroll, resize, or any pointer-down outside the menu — the
	// parent just flips `open` back off in `onClose`.
	let {
		open,
		x,
		y,
		onClose,
		children
	}: {
		open: boolean;
		x: number;
		y: number;
		onClose: () => void;
		children: Snippet;
	} = $props();

	let menuEl = $state<HTMLElement | null>(null);
	// Resolved position — clamped after render so the menu never spills off-screen.
	let left = $state(0);
	let top = $state(0);

	$effect(() => {
		if (!open) return;

		// Place at the cursor, then nudge back inside the viewport once measured.
		left = x;
		top = y;
		tick().then(() => {
			const el = menuEl;
			if (!el) return;
			const { width, height } = el.getBoundingClientRect();
			const pad = 8;
			if (x + width + pad > window.innerWidth) left = Math.max(pad, window.innerWidth - width - pad);
			if (y + height + pad > window.innerHeight) top = Math.max(pad, window.innerHeight - height - pad);
			el.focus();
		});

		const onPointerDown = (e: PointerEvent) => {
			if (menuEl && !menuEl.contains(e.target as Node)) onClose();
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onClose();
		};
		const close = () => onClose();

		// Capture phase so the close beats any handler on the element underneath.
		window.addEventListener('pointerdown', onPointerDown, true);
		window.addEventListener('scroll', close, true);
		window.addEventListener('resize', close);
		window.addEventListener('keydown', onKey);
		return () => {
			window.removeEventListener('pointerdown', onPointerDown, true);
			window.removeEventListener('scroll', close, true);
			window.removeEventListener('resize', close);
			window.removeEventListener('keydown', onKey);
		};
	});
</script>

{#if open}
	<menu
		bind:this={menuEl}
		class="cmenu"
		role="menu"
		tabindex="-1"
		style="left: {left}px; top: {top}px;"
		oncontextmenu={(e) => e.preventDefault()}
	>
		{@render children()}
	</menu>
{/if}

<style>
	.cmenu {
		position: fixed;
		z-index: var(--z-popover, 1000);
		min-width: 180px;
		margin: 0;
		padding: var(--space-1, 4px);
		list-style: none;
		background: var(--surface-card);
		border: 1.5px solid var(--border-default);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-lg);
		animation: cmenu-in var(--duration-fast) var(--ease-out);
	}
	.cmenu:focus {
		outline: none;
	}
	@keyframes cmenu-in {
		from {
			opacity: 0;
			transform: scale(0.97);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.cmenu {
			animation: none;
		}
	}
	/* Menu items are provided by the caller via the `item` styling hook below. */
	.cmenu :global(.cmenu-item) {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 8px 10px;
		font-family: var(--font-sans);
		font-size: var(--text-sm);
		color: var(--text-primary);
		text-align: left;
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		cursor: pointer;
	}
	.cmenu :global(.cmenu-item:hover) {
		background: var(--surface-hover);
	}
	.cmenu :global(.cmenu-item:focus-visible) {
		outline: none;
		box-shadow: var(--shadow-focus);
	}
	.cmenu :global(.cmenu-item.danger) {
		color: var(--status-danger-fg, var(--color-accent));
	}
	.cmenu :global(.cmenu-item.danger:hover) {
		background: var(--status-danger-bg, var(--terracotta-50));
	}
</style>
