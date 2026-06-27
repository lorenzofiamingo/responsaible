<!--
	A small, accessible hover/focus tooltip — the styled explainer used to annotate
	otherwise-terse labels (a "baseline" badge, a one-word document type). Matches the
	claim-graph legend tooltip: dark inverse surface, appears above the trigger.

	Pass the visible trigger as the `label` snippet and the explanation as children:

		<InfoTip align="right">
			{#snippet label()}<span class="badge">baseline</span>{/snippet}
			<strong>Result source</strong>
			<p>Where this assessment came from…</p>
		</InfoTip>

	`align` picks which edge the bubble hangs from so it can't overflow the panel.
	`focusable` adds a keyboard tab stop; set it false when the trigger already sits
	inside a focusable element (e.g. a queue-row link) to avoid a redundant stop.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		align = 'left',
		focusable = true,
		label,
		children
	}: {
		align?: 'left' | 'right';
		focusable?: boolean;
		label: Snippet;
		children: Snippet;
	} = $props();
</script>

<span class="tt" class:focusable tabindex={focusable ? 0 : undefined}>
	{@render label()}
	<span class="tip {align}" role="tooltip">{@render children()}</span>
</span>

<style>
	.tt {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: 5px;
		cursor: help;
	}
	.tt.focusable:focus-visible {
		outline: 2px solid var(--border-focus);
		outline-offset: 2px;
		border-radius: var(--radius-xs);
	}
	.tip {
		position: absolute;
		bottom: calc(100% + 8px);
		z-index: 20;
		width: max-content;
		max-width: 300px;
		padding: 9px 11px;
		background: var(--surface-inverse);
		color: var(--text-on-inverse);
		border-radius: var(--radius-sm);
		box-shadow: var(--shadow-lg);
		font-family: var(--font-sans);
		font-size: var(--text-xs);
		font-weight: var(--weight-regular);
		text-transform: none;
		letter-spacing: normal;
		line-height: var(--leading-snug);
		text-align: left;
		white-space: normal;
		opacity: 0;
		visibility: hidden;
		transform: translateY(2px);
		transition:
			opacity var(--duration-fast) var(--ease-out),
			transform var(--duration-fast) var(--ease-out),
			visibility var(--duration-fast);
		pointer-events: none;
	}
	.tip.left {
		left: 0;
	}
	.tip.right {
		right: 0;
	}
	.tt:hover .tip,
	.tt.focusable:focus-visible .tip {
		opacity: 1;
		visibility: visible;
		transform: translateY(0);
	}

	/* Sensible defaults so consumers can drop in light markup. */
	.tip :global(strong) {
		display: block;
		margin-bottom: 4px;
		font-weight: var(--weight-semibold);
		color: var(--text-on-inverse);
	}
	.tip :global(p) {
		margin: 0;
	}
	.tip :global(p + p),
	.tip :global(strong + p) {
		margin-top: 4px;
	}
	.tip :global(ul) {
		margin: 4px 0 0;
		padding-left: 15px;
	}
	.tip :global(li) {
		margin: 2px 0;
	}
	.tip :global(li b),
	.tip :global(p b) {
		font-weight: var(--weight-semibold);
	}
</style>
