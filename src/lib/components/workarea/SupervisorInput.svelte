<script lang="ts">
	import Badge from '$lib/components/Badge.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { VERIFY } from '$lib/format';
	import type { SupervisorInput, SupervisorSource } from '$lib/types';

	let {
		value,
		onChange,
		disabled = false
	}: {
		value: SupervisorInput;
		onChange: (v: SupervisorInput) => void;
		disabled?: boolean;
	} = $props();

	const MAX_SOURCES = 4;

	const guidance = $derived(value.guidance ?? '');
	const sources = $derived(value.sources ?? []);

	function emit(patch: Partial<SupervisorInput>) {
		onChange({ guidance, sources, ...patch });
	}

	function editSource(i: number, patch: Partial<SupervisorSource>) {
		emit({ sources: sources.map((s, j) => (j === i ? { ...s, ...patch, celexStatus: undefined } : s)) });
	}

	function addSource() {
		if (sources.length >= MAX_SOURCES) return;
		emit({ sources: [...sources, {}] });
	}

	function removeSource(i: number) {
		emit({ sources: sources.filter((_, j) => j !== i) });
	}
</script>

<div class="sup">
	<label class="field">
		<span class="flabel">Instruction to the work group</span>
		<textarea
			rows="2"
			{disabled}
			value={guidance}
			placeholder="e.g. Treat GDPR Art. 6(1)(f) as the governing basis and re-check the balancing test."
			oninput={(e) => emit({ guidance: e.currentTarget.value })}
		></textarea>
	</label>

	<div class="srcs">
		<div class="shead">
			<span class="flabel">Sources to ground</span>
			<span class="scount">{sources.length} / {MAX_SOURCES}</span>
		</div>

		{#each sources as src, i (i)}
			<div class="src">
				<div class="row">
					<input
						class="celex"
						{disabled}
						value={src.celex ?? ''}
						placeholder="CELEX (e.g. 32016R0679)"
						oninput={(e) => editSource(i, { celex: e.currentTarget.value })}
					/>
					<input
						class="loc"
						{disabled}
						value={src.locator ?? ''}
						placeholder="Locator (Art. 6(1)(f))"
						oninput={(e) => editSource(i, { locator: e.currentTarget.value })}
					/>
					<button
						type="button"
						class="rm"
						{disabled}
						onclick={() => removeSource(i)}
						title="Remove source"
						aria-label="Remove source"
					>
						<Icon name="x" size={13} />
					</button>
				</div>
				<input
					class="full"
					{disabled}
					value={src.title ?? ''}
					placeholder="Title (e.g. GDPR — Regulation (EU) 2016/679)"
					oninput={(e) => editSource(i, { title: e.currentTarget.value })}
				/>
				<input
					class="full"
					{disabled}
					value={src.url ?? ''}
					placeholder="URL (optional)"
					oninput={(e) => editSource(i, { url: e.currentTarget.value })}
				/>
				<textarea
					class="full"
					rows="2"
					{disabled}
					value={src.snippet ?? ''}
					placeholder="Quote / note the analysis should weigh (optional)"
					oninput={(e) => editSource(i, { snippet: e.currentTarget.value })}
				></textarea>
				{#if src.celexStatus}
					<Badge tone={VERIFY[src.celexStatus]?.tone ?? 'neutral'}>
						<Icon name={VERIFY[src.celexStatus]?.icon ?? 'circle-alert'} size={10} />
						CELLAR: {VERIFY[src.celexStatus]?.label ?? src.celexStatus}
					</Badge>
				{/if}
			</div>
		{/each}

		{#if sources.length < MAX_SOURCES}
			<button type="button" class="addsrc" {disabled} onclick={addSource}>
				<span class="plus">+</span> Add source
			</button>
		{/if}
	</div>
</div>

<style>
	.sup {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 5px;
	}
	.flabel {
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
		color: var(--text-tertiary);
	}
	textarea,
	input {
		width: 100%;
		font-family: var(--font-sans);
		font-size: var(--text-xs);
		color: var(--text-primary);
		background: var(--surface-card);
		border: 1.5px solid var(--border-default);
		border-radius: var(--radius-sm);
		padding: 6px 8px;
		resize: vertical;
		line-height: var(--leading-normal);
	}
	textarea:focus,
	input:focus {
		outline: none;
		border-color: var(--border-focus);
		box-shadow: var(--shadow-focus);
	}
	.srcs {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.shead {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.scount {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--text-tertiary);
	}
	.src {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 8px;
		background: var(--surface-sunken);
		border-radius: var(--radius-sm);
	}
	.row {
		display: grid;
		grid-template-columns: 1fr 1fr 24px;
		gap: 6px;
		align-items: center;
	}
	.rm {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		padding: 0;
		color: var(--text-tertiary);
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		cursor: pointer;
	}
	.rm:hover:not(:disabled) {
		background: var(--surface-card);
		color: var(--status-danger-fg);
	}
	.rm:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.addsrc {
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
	.addsrc:hover:not(:disabled) {
		border-color: var(--color-accent);
		color: var(--color-accent-active);
	}
	.addsrc:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.plus {
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		line-height: 1;
	}
</style>
