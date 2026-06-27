<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		padding = 'md',
		elevation = 'sm',
		source = false,
		interactive = false,
		children,
		class: klass = ''
	}: {
		padding?: 'none' | 'sm' | 'md' | 'lg';
		elevation?: 'flat' | 'xs' | 'sm' | 'md' | 'lg';
		/** Adds the 3px terracotta left-border that marks a primary-source panel. */
		source?: boolean;
		interactive?: boolean;
		children: Snippet;
		class?: string;
	} = $props();

	const pads = { none: '0', sm: 'var(--space-4)', md: 'var(--space-5)', lg: 'var(--space-6)' };
	const shadows = {
		flat: 'none',
		xs: 'var(--shadow-xs)',
		sm: 'var(--shadow-sm)',
		md: 'var(--shadow-md)',
		lg: 'var(--shadow-lg)'
	};
</script>

<div
	class="card {klass}"
	class:interactive
	class:source
	style="--pad:{pads[padding]}; --sh:{shadows[elevation]}"
>
	{@render children()}
</div>

<style>
	.card {
		background: var(--surface-card);
		border: 1.5px solid var(--border-default);
		border-radius: var(--radius-lg);
		box-shadow: var(--sh);
		padding: var(--pad);
		transition:
			box-shadow var(--duration-normal) var(--ease-out),
			transform var(--duration-normal) var(--ease-out);
	}
	.source {
		border-left: 3px solid var(--color-accent);
	}
	.interactive {
		cursor: pointer;
	}
	.interactive:hover {
		box-shadow: var(--shadow-md);
		transform: translateY(-2px);
	}
</style>
