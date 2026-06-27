<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';

	let {
		variant = 'primary',
		size = 'md',
		href = undefined,
		type = 'button',
		disabled = false,
		full = false,
		icon = undefined,
		iconRight = undefined,
		children,
		...rest
	}: {
		variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
		size?: 'sm' | 'md' | 'lg';
		href?: string;
		type?: 'button' | 'submit';
		disabled?: boolean;
		full?: boolean;
		icon?: string;
		iconRight?: string;
		children?: Snippet;
		[key: string]: unknown;
	} = $props();

	const iconSize = $derived(size === 'sm' ? 15 : size === 'lg' ? 18 : 16);
</script>

{#if href !== undefined}
	<a class="btn {variant} {size}" class:full {href} {...rest}>
		{#if icon}<Icon name={icon} size={iconSize} />{/if}
		{@render children?.()}
		{#if iconRight}<Icon name={iconRight} size={iconSize} />{/if}
	</a>
{:else}
	<button class="btn {variant} {size}" class:full {type} {disabled} {...rest}>
		{#if icon}<Icon name={icon} size={iconSize} />{/if}
		{@render children?.()}
		{#if iconRight}<Icon name={iconRight} size={iconSize} />{/if}
	</button>
{/if}

<style>
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		font-family: var(--font-display);
		font-weight: var(--weight-medium);
		letter-spacing: var(--tracking-snug);
		line-height: 1;
		border-radius: var(--radius-md);
		cursor: pointer;
		text-decoration: none;
		border: 1.5px solid transparent;
		transition:
			background var(--duration-fast) var(--ease-out),
			transform var(--duration-fast) var(--ease-out),
			box-shadow var(--duration-fast) var(--ease-out);
	}
	.btn:active {
		transform: translateY(1px);
	}
	.btn:focus-visible {
		outline: none;
		box-shadow: var(--shadow-focus);
	}
	.btn:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.full {
		width: 100%;
	}

	.sm {
		height: 34px;
		padding: 0 var(--space-3);
		font-size: var(--text-sm);
	}
	.md {
		height: 42px;
		padding: 0 var(--space-5);
		font-size: var(--text-base);
	}
	.lg {
		height: 52px;
		padding: 0 var(--space-6);
		font-size: var(--text-md);
	}

	.primary {
		background: var(--color-accent);
		color: var(--color-on-accent);
	}
	.primary:hover {
		background: var(--color-accent-hover);
	}
	.secondary {
		background: var(--surface-card);
		color: var(--text-primary);
		border-color: var(--border-strong);
	}
	.secondary:hover {
		background: var(--surface-hover);
	}
	.ghost {
		background: transparent;
		color: var(--text-primary);
	}
	.ghost:hover {
		background: var(--surface-hover);
	}
	.danger {
		background: var(--status-danger-fg);
		color: var(--neutral-0);
	}
	.danger:hover {
		filter: brightness(0.94);
	}
</style>
