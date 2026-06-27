<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import {
		DEFAULT_WEB_ALLOW,
		EFFORTS,
		FIGURE_PRESETS,
		FIGURE_ROLE,
		FIGURE_ROLE_IDS,
		MAX_FIGURES,
		MODEL_IDS,
		MODELS,
		PRESET_IDS,
		PRESET_META,
		PRESETS,
		RESEARCH_TOOL,
		RESEARCH_TOOL_IDS,
		figureTools,
		type Effort,
		type Figure,
		type FigurePresetId,
		type FigureRole,
		type ModelId,
		type PresetId,
		type ResearchTool,
		type WorkGroup
	} from '$lib/workgroups';

	let {
		value,
		onChange,
		compact = false
	}: { value: WorkGroup; onChange: (wg: WorkGroup) => void; compact?: boolean } = $props();

	// Draft text for the domain inputs, keyed by "figureIndex:allow|deny".
	let domainDraft = $state<Record<string, string>>({});

	// Palette, grouped so the three canonical researchers read as first-class.
	const PALETTE_GROUPS: { label: string; ids: FigurePresetId[] }[] = [
		{ label: 'Researchers', ids: ['cellar_researcher', 'web_researcher', 'knowledge_researcher'] },
		{ label: 'Reviewers', ids: ['critic'] }
	];

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

	function addFromPreset(id: FigurePresetId) {
		if (value.figures.length >= MAX_FIGURES) return;
		onChange(asCustom([...value.figures, FIGURE_PRESETS[id].make()]));
	}

	function removeFigure(i: number) {
		if (value.figures.length <= 1) return;
		onChange(asCustom(value.figures.filter((_, j) => j !== i)));
	}

	function toggleTool(i: number, tool: ResearchTool) {
		const f = value.figures[i];
		const has = (f.tools ?? []).includes(tool);
		const tools = has ? (f.tools ?? []).filter((t) => t !== tool) : [...(f.tools ?? []), tool];
		const patch: Partial<Figure> = { tools };
		// Seed a sensible domain allow-list the first time the web tool is enabled.
		if (tool === 'web' && !has && !f.web) {
			patch.web = { allow: [...DEFAULT_WEB_ALLOW], deny: [] };
		}
		editFigure(i, patch);
	}

	function webConfig(f: Figure) {
		return f.web ?? { allow: [], deny: [] };
	}

	function addDomain(i: number, list: 'allow' | 'deny') {
		const key = `${i}:${list}`;
		const raw = (domainDraft[key] ?? '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
		if (!raw) return;
		const cfg = webConfig(value.figures[i]);
		if (cfg[list].includes(raw)) {
			domainDraft = { ...domainDraft, [key]: '' };
			return;
		}
		editFigure(i, { web: { ...cfg, [list]: [...cfg[list], raw] } });
		domainDraft = { ...domainDraft, [key]: '' };
	}

	function removeDomain(i: number, list: 'allow' | 'deny', j: number) {
		const cfg = webConfig(value.figures[i]);
		editFigure(i, { web: { ...cfg, [list]: cfg[list].filter((_, k) => k !== j) } });
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
		{#snippet domainList(i: number, list: 'allow' | 'deny', label: string, icon: string)}
			{@const cfg = webConfig(value.figures[i])}
			<div class="dom-group">
				<span class="dom-label"><Icon name={icon} size={10} /> {label}</span>
				<div class="dom-chips">
					{#each cfg[list] as d, j (d)}
						<span class="dom-chip">
							{d}
							<button type="button" onclick={() => removeDomain(i, list, j)} aria-label={`remove ${d}`}>
								<Icon name="x" size={9} />
							</button>
						</span>
					{/each}
					<input
						class="dom-input"
						placeholder="add domain…"
						value={domainDraft[`${i}:${list}`] ?? ''}
						oninput={(e) => (domainDraft = { ...domainDraft, [`${i}:${list}`]: e.currentTarget.value })}
						onkeydown={(e) => {
							if (e.key === 'Enter') {
								e.preventDefault();
								addDomain(i, list);
							}
						}}
					/>
				</div>
			</div>
		{/snippet}

		{#each value.figures as fig, i (i)}
			{@const tools = figureTools(fig)}
			<div class="figure">
				<div class="frow">
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
							<option value={m}>{MODELS[m].label}{MODELS[m].open ? ' · open' : ''}</option>
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

				{#if fig.role === 'research'}
					<div class="tools" role="group" aria-label="research tools">
						<span class="tools-label">Tools</span>
						{#each RESEARCH_TOOL_IDS as t (t)}
							<button
								type="button"
								class="tool"
								class:on={tools.includes(t)}
								onclick={() => toggleTool(i, t)}
								title={RESEARCH_TOOL[t].blurb}
							>
								<Icon name={RESEARCH_TOOL[t].icon} size={11} />
								{RESEARCH_TOOL[t].label}
							</button>
						{/each}
					</div>
					{#if tools.includes('knowledge') && !MODELS[fig.model].open}
						<p class="tool-note">
							<Icon name="triangle-alert" size={11} /> Firm knowledge is confidential — pick an open
							model (e.g. NVIDIA Nemotron) to keep it on-perimeter.
						</p>
					{/if}
					{#if tools.includes('web')}
						<div class="domains">
							{@render domainList(i, 'allow', 'Allow', 'shield-check')}
							{@render domainList(i, 'deny', 'Exclude', 'ban')}
						</div>
					{/if}
				{/if}
			</div>
		{/each}
		{#if value.figures.length < MAX_FIGURES}
			<div class="palette">
				{#each PALETTE_GROUPS as grp (grp.label)}
					<span class="palette-label">{grp.label}</span>
					<div class="palette-chips">
						{#each grp.ids as id (id)}
							<button type="button" class="pchip" onclick={() => addFromPreset(id)}>
								<Icon name={FIGURE_PRESETS[id].icon} size={11} />
								{FIGURE_PRESETS[id].label}
							</button>
						{/each}
					</div>
				{/each}
			</div>
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
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 6px 8px;
		background: var(--surface-sunken);
		border-radius: var(--radius-sm);
	}
	.frow {
		display: grid;
		grid-template-columns: 132px 1fr auto 26px;
		align-items: center;
		gap: 8px;
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
	/* Research tool toggles */
	.tools {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 5px;
		padding-left: 2px;
	}
	.tools-label {
		font-size: 10px;
		font-family: var(--font-mono);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
		color: var(--text-tertiary);
		margin-right: 1px;
	}
	.tool {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 3px 8px;
		font-family: var(--font-sans);
		font-size: var(--text-xs);
		color: var(--text-tertiary);
		background: var(--surface-card);
		border: 1.5px solid var(--border-default);
		border-radius: var(--radius-pill, 999px);
		cursor: pointer;
		transition: all var(--duration-fast) var(--ease-out);
	}
	.tool:hover {
		border-color: var(--border-strong);
		color: var(--text-secondary);
	}
	.tool.on {
		color: var(--color-accent-active);
		border-color: var(--color-accent);
		background: var(--terracotta-50);
	}
	.tool-note {
		display: flex;
		align-items: flex-start;
		gap: 5px;
		margin: 0;
		padding: 4px 6px;
		font-size: 11px;
		line-height: var(--leading-snug);
		color: var(--status-warning-fg, var(--text-secondary));
		background: var(--surface-card);
		border-radius: var(--radius-xs);
	}

	/* Web-tool domain filters */
	.domains {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 6px;
		background: var(--surface-card);
		border-radius: var(--radius-sm);
	}
	.dom-group {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.dom-label {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 10px;
		font-family: var(--font-mono);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
		color: var(--text-tertiary);
	}
	.dom-chips {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px;
	}
	.dom-chip {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		padding: 2px 4px 2px 7px;
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--text-secondary);
		background: var(--surface-sunken);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-pill, 999px);
	}
	.dom-chip button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 14px;
		height: 14px;
		padding: 0;
		color: var(--text-tertiary);
		background: transparent;
		border: none;
		border-radius: 50%;
		cursor: pointer;
	}
	.dom-chip button:hover {
		color: var(--status-danger-fg);
	}
	.dom-input {
		flex: 1 1 110px;
		min-width: 90px;
		padding: 3px 7px;
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--text-primary);
		background: var(--surface-sunken);
		border: 1.5px solid var(--border-default);
		border-radius: var(--radius-sm);
	}
	.dom-input:focus {
		outline: none;
		border-color: var(--color-accent);
	}

	/* Figure palette */
	.palette {
		display: flex;
		flex-direction: column;
		gap: 5px;
		margin-top: 2px;
	}
	.palette-label {
		font-size: 10px;
		font-family: var(--font-mono);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
		color: var(--text-tertiary);
	}
	.palette-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
	}
	.pchip {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 5px 9px;
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
	.pchip:hover {
		border-style: solid;
		border-color: var(--color-accent);
		color: var(--color-accent-active);
	}
	.compact .frow {
		grid-template-columns: 116px 1fr auto 24px;
	}
</style>
