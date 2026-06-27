<script lang="ts">
	import type { Snippet } from 'svelte';

	type Tone = 'accent' | 'neutral' | 'success' | 'warning' | 'danger' | 'info';
	type Variant = 'soft' | 'solid' | 'outline';

	let {
		tone = 'neutral',
		variant = 'soft',
		children
	}: { tone?: Tone; variant?: Variant; children: Snippet } = $props();

	// fg / bg / border / solid background per tone, all from Itaily tokens.
	const tones: Record<Tone, { fg: string; bg: string; bd: string; solid: string }> = {
		accent: { fg: 'var(--terracotta-700)', bg: 'var(--terracotta-50)', bd: 'var(--terracotta-200)', solid: 'var(--color-accent)' },
		neutral: { fg: 'var(--text-secondary)', bg: 'var(--neutral-100)', bd: 'var(--border-default)', solid: 'var(--neutral-700)' },
		success: { fg: 'var(--status-success-fg)', bg: 'var(--status-success-bg)', bd: 'var(--status-success-fg)', solid: 'var(--status-success-fg)' },
		warning: { fg: 'var(--status-warning-fg)', bg: 'var(--status-warning-bg)', bd: 'var(--status-warning-fg)', solid: 'var(--status-warning-fg)' },
		danger: { fg: 'var(--status-danger-fg)', bg: 'var(--status-danger-bg)', bd: 'var(--status-danger-fg)', solid: 'var(--status-danger-fg)' },
		info: { fg: 'var(--status-info-fg)', bg: 'var(--status-info-bg)', bd: 'var(--status-info-fg)', solid: 'var(--status-info-fg)' }
	};

	const t = $derived(tones[tone]);
</script>

<span
	class="badge {variant}"
	style="--fg:{t.fg}; --bg:{t.bg}; --bd:{t.bd}; --solid:{t.solid}"
>
	{@render children()}
</span>

<style>
	.badge {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-family: var(--font-sans);
		font-size: var(--text-xs);
		font-weight: var(--weight-semibold);
		line-height: 1;
		padding: 4px 9px;
		border-radius: var(--radius-pill);
		white-space: nowrap;
	}
	.soft {
		color: var(--fg);
		background: var(--bg);
		border: 1.5px solid transparent;
	}
	.outline {
		color: var(--fg);
		background: transparent;
		border: 1.5px solid var(--bd);
	}
	.solid {
		color: var(--neutral-0);
		background: var(--solid);
		border: 1.5px solid transparent;
	}
</style>
