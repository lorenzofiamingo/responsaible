<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import {
		EFFORTS,
		FIGURE_ROLE,
		FIGURE_ROLE_IDS,
		MAX_FIGURES,
		MODEL_IDS,
		MODELS,
		PRESET_IDS,
		PRESET_META,
		PRESETS,
		newFigure,
		type Effort,
		type Figure,
		type FigureRole,
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

	// Build a standalone custom group from a set of figures. Always clones, so we
	// never mutate a preset's shared figures array.
	function asCustom(figures: Figure[]): WorkGroup {
		return { id: 'custom', label: 'Custom', figures: figures.map((f) => ({ ...f })) };
	}

	function pickCustom() {
		if (value.id === 'custom') return;
		onChange(asCustom(value.figures));
	}

	function editFigure(i: number, patch: Partial<Figure>) {
		onChange(asCustom(value.figures.map((f, j) => (j === i ? { ...f, ...patch } : f))));
	}

	function addFigure() {
		if (value.figures.length >= MAX_FIGURES) return;
		onChange(asCustom([...value.figures, newFigure()]));
	}

	function removeFigure(i: number) {
		if (value.figures.length <= 1) return;
		onChange(asCustom(value.figures.filter((_, j) => j !== i)));
	}
</script>

<div class="cfg" class:compact>
	<div class="presets">
		{#each PRESET_IDS as id (id)}
			<button
				type="button"
				class="preset"
				class:sel={value.id === id}
				onclick={() => pickPreset(id)}
				title={PRESET_META[id].hint}
			>
				<span class="pname">{PRESETS[id].label}</span>
				<span class="pcount">{PRESETS[id].figures.length} figure{PRESETS[id].figures.length > 1 ? 's' : ''}</span>
			</button>
		{/each}
		<button
			type="button"
			class="preset custom-card"
			class:sel={value.id === 'custom'}
			onclick={pickCustom}
			title="Build your own work group — add or remove figures"
		>
			<span class="pname"><Icon name="git-fork" size={12} /> Custom</span>
			<span class="pcount">
				{#if value.id === 'custom'}{value.figures.length} figure{value.figures.length > 1 ? 's' : ''}{:else}add &amp; remove{/if}
			</span>
		</button>
	</div>

	<div class="figures">
		<div class="fhead">
			<span>Figures</span>
			<span class="fcount">{value.figures.length} / {MAX_FIGURES}</span>
		</div>
		{#each value.figures as fig, i (i)}
			<div class="figure">
				<span class="role">
					<Icon name={FIGURE_ROLE[fig.role].icon} size={13} />
					<select
						class="role-sel"
						value={fig.role}
						onchange={(e) => editFigure(i, { role: e.currentTarget.value as FigureRole })}
						aria-label="figure role"
					>
						{#each FIGURE_ROLE_IDS as r (r)}
							<option value={r}>{FIGURE_ROLE[r].label}</option>
						{/each}
					</select>
				</span>
				<select
					class="model"
					value={fig.model}
					onchange={(e) => editFigure(i, { model: e.currentTarget.value as ModelId })}
					aria-label="figure model"
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
				<button
					type="button"
					class="rm"
					onclick={() => removeFigure(i)}
					disabled={value.figures.length <= 1}
					title="Remove figure"
					aria-label="Remove figure"
				>
					<Icon name="x" size={13} />
				</button>
			</div>
		{/each}
		{#if value.figures.length < MAX_FIGURES}
			<button type="button" class="addfig" onclick={addFigure}>
				<span class="plus">+</span> Add figure
			</button>
		{/if}
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
		grid-template-columns: repeat(2, 1fr);
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
	.custom-card {
		border-style: dashed;
	}
	.custom-card.sel {
		border-style: solid;
	}
	.pname {
		display: inline-flex;
		align-items: center;
		gap: 5px;
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
	.fcount {
		font-family: var(--font-mono);
		text-transform: none;
		letter-spacing: 0;
	}
	.figure {
		display: grid;
		grid-template-columns: 116px 1fr auto 26px;
		align-items: center;
		gap: 8px;
		padding: 6px 8px;
		background: var(--surface-sunken);
		border-radius: var(--radius-sm);
	}
	.role {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		min-width: 0;
		color: var(--text-secondary);
	}
	.role-sel {
		min-width: 0;
		width: 100%;
		padding: 3px 2px;
		font-family: var(--font-sans);
		font-size: var(--text-xs);
		font-weight: var(--weight-medium);
		color: var(--text-secondary);
		background: transparent;
		border: none;
		border-radius: var(--radius-xs);
		cursor: pointer;
	}
	.role-sel:hover {
		color: var(--text-primary);
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
	.rm {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 26px;
		padding: 0;
		color: var(--text-tertiary);
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: all var(--duration-fast) var(--ease-out);
	}
	.rm:hover:not(:disabled) {
		background: var(--surface-card);
		color: var(--status-danger-fg);
	}
	.rm:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}
	.addfig {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		width: 100%;
		padding: 7px;
		font-family: var(--font-display);
		font-weight: var(--weight-medium);
		font-size: var(--text-xs);
		color: var(--text-secondary);
		background: var(--surface-card);
		border: 1.5px dashed var(--border-default);
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: all var(--duration-fast) var(--ease-out);
	}
	.addfig:hover {
		border-color: var(--color-accent);
		color: var(--color-accent-active);
	}
	.plus {
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		line-height: 1;
	}
	.compact .figure {
		grid-template-columns: 100px 1fr auto 24px;
	}
</style>
