<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import {
		EFFORTS,
		FIGURE_ROLE,
		MODEL_IDS,
		MODELS,
		PRESET_IDS,
		PRESET_META,
		PRESETS,
		type Effort,
		type Figure,
		type ModelId,
		type PresetId,
		type WorkGroup
	} from '$lib/workgroups';

	let {
		value,
		onChange,
		compact = false
	}: { value: WorkGroup; onChange: (wg: WorkGroup) => void; compact?: boolean } = $props();

	function pickPreset(id: PresetId) {
		onChange(PRESETS[id]);
	}

	function editFigure(i: number, patch: Partial<Figure>) {
		const figures = value.figures.map((f, j) => (j === i ? { ...f, ...patch } : f));
		onChange({ id: 'custom', label: 'Custom', figures });
	}
</script>

<div class="cfg" class:compact>
	<div class="presets">
		{#each PRESET_IDS as id (id)}
			<button
				type="button"
				class="preset tone-{PRESET_META[id].tone}"
				class:sel={value.id === id}
				onclick={() => pickPreset(id)}
				title={PRESET_META[id].hint}
			>
				<span class="pname">{PRESETS[id].label}</span>
				<span class="pcount">{PRESETS[id].figures.length} figure{PRESETS[id].figures.length > 1 ? 's' : ''}</span>
			</button>
		{/each}
	</div>

	<div class="figures">
		<div class="fhead">
			<span>Figures</span>
			{#if value.id === 'custom'}<span class="custom-tag">Custom</span>{/if}
		</div>
		{#each value.figures as fig, i (i)}
			<div class="figure">
				<span class="role"><Icon name={FIGURE_ROLE[fig.role].icon} size={13} /> {FIGURE_ROLE[fig.role].label}</span>
				<select
					class="model"
					value={fig.model}
					onchange={(e) => editFigure(i, { model: e.currentTarget.value as ModelId })}
				>
					{#each MODEL_IDS as m (m)}
						<option value={m}>{MODELS[m].label}</option>
					{/each}
				</select>
				<div class="effort" role="group" aria-label="effort">
					{#each EFFORTS as e (e)}
						<button
							type="button"
							class="eff"
							class:on={fig.effort === e}
							onclick={() => editFigure(i, { effort: e as Effort })}
						>{e}</button>
					{/each}
				</div>
			</div>
		{/each}
	</div>
</div>

<style>
	.cfg {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.presets {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 6px;
	}
	.preset {
		display: flex;
		flex-direction: column;
		gap: 2px;
		align-items: flex-start;
		padding: 8px 10px;
		background: var(--surface-card);
		border: 1.5px solid var(--border-default);
		border-radius: var(--radius-md);
		cursor: pointer;
		text-align: left;
		transition: all var(--duration-fast) var(--ease-out);
	}
	.preset:hover {
		border-color: var(--border-strong);
	}
	.preset.sel {
		border-color: var(--color-accent);
		background: var(--terracotta-50);
		box-shadow: var(--shadow-focus);
	}
	.pname {
		font-family: var(--font-display);
		font-weight: var(--weight-medium);
		font-size: var(--text-sm);
		color: var(--text-primary);
	}
	.pcount {
		font-size: 10px;
		font-family: var(--font-mono);
		color: var(--text-tertiary);
	}

	.figures {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.fhead {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: var(--text-xs);
		color: var(--text-tertiary);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
	}
	.custom-tag {
		font-family: var(--font-mono);
		color: var(--color-accent-active);
		text-transform: none;
		letter-spacing: 0;
	}
	.figure {
		display: grid;
		grid-template-columns: 110px 1fr auto;
		align-items: center;
		gap: 8px;
		padding: 6px 8px;
		background: var(--surface-sunken);
		border-radius: var(--radius-sm);
	}
	.role {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: var(--text-xs);
		font-weight: var(--weight-medium);
		color: var(--text-secondary);
	}
	.model {
		font-family: var(--font-sans);
		font-size: var(--text-xs);
		padding: 5px 7px;
		border: 1.5px solid var(--border-default);
		border-radius: var(--radius-sm);
		background: var(--surface-card);
		color: var(--text-primary);
		min-width: 0;
	}
	.effort {
		display: inline-flex;
		border: 1.5px solid var(--border-default);
		border-radius: var(--radius-sm);
		overflow: hidden;
	}
	.eff {
		padding: 4px 7px;
		font-size: 10px;
		font-family: var(--font-mono);
		text-transform: uppercase;
		background: var(--surface-card);
		color: var(--text-tertiary);
		border: none;
		border-left: 1.5px solid var(--border-default);
		cursor: pointer;
	}
	.eff:first-child {
		border-left: none;
	}
	.eff.on {
		background: var(--color-accent);
		color: var(--color-on-accent);
	}
	.compact .figure {
		grid-template-columns: 92px 1fr auto;
	}
</style>
