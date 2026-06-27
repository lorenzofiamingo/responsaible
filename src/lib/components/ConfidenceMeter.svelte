<script lang="ts">
	// How grounded the AI output is. Numeric (0..1) → three-segment bar + label,
	// echoing the Itaily signature that an answer never feigns certainty.
	let {
		value = 0,
		showLabel = true,
		showPct = true
	}: { value?: number; showLabel?: boolean; showPct?: boolean } = $props();

	const pct = $derived(Math.round(value * 100));
	const level = $derived(value >= 0.8 ? 'high' : value >= 0.6 ? 'medium' : 'low');
	const color = $derived(
		level === 'high'
			? 'var(--status-success-fg)'
			: level === 'medium'
				? 'var(--status-warning-fg)'
				: 'var(--status-danger-fg)'
	);
	const fill = $derived(level === 'high' ? 3 : level === 'medium' ? 2 : 1);
	const label = $derived(
		level === 'high' ? 'High confidence' : level === 'medium' ? 'Medium confidence' : 'Low confidence'
	);
</script>

<span class="cm" style="--c:{color}">
	<span class="segs">
		{#each [0, 1, 2] as i (i)}
			<span class="seg" class:on={i < fill}></span>
		{/each}
	</span>
	{#if showLabel || showPct}
		<span class="lbl">
			{#if showLabel}{label}{/if}{#if showLabel && showPct} · {/if}{#if showPct}{pct}%{/if}
		</span>
	{/if}
</span>

<style>
	.cm {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-family: var(--font-sans);
	}
	.segs {
		display: inline-flex;
		gap: 3px;
	}
	.seg {
		width: 16px;
		height: 6px;
		border-radius: 2px;
		background: var(--neutral-200);
	}
	.seg.on {
		background: var(--c);
	}
	.lbl {
		font-size: var(--text-xs);
		font-weight: var(--weight-medium);
		color: var(--c);
		white-space: nowrap;
	}
</style>
