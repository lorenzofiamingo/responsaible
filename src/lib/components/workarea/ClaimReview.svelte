<script lang="ts">
	import Badge from '$lib/components/Badge.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { fmtDateTime, VERDICT } from '$lib/format';
	import type { ClaimReviewState } from '$lib/types';

	let {
		idx,
		aiVerdict,
		review,
		onSave,
		onClear
	}: {
		idx: number;
		aiVerdict: string | null;
		review: ClaimReviewState;
		onSave: (verdict: string, note: string) => Promise<void> | void;
		onClear: () => Promise<void> | void;
	} = $props();

	// Local draft — the parent remounts this per claim via {#key}, so seeding from
	// the saved review here is correct (no stale carry-over between claims).
	// svelte-ignore state_referenced_locally
	let draftVerdict = $state<string | null>(review.verdict);
	// svelte-ignore state_referenced_locally
	let draftNote = $state(review.note ?? '');
	let saving = $state(false);
	let error = $state('');

	const ORDER = ['supported', 'weak', 'unsupported', 'flag'];

	const dirty = $derived(draftVerdict !== review.verdict || draftNote.trim() !== (review.note ?? '').trim());
	const canSave = $derived(!!draftVerdict && dirty && !saving);

	async function save() {
		if (!draftVerdict || saving) return;
		saving = true;
		error = '';
		try {
			await onSave(draftVerdict, draftNote.trim());
		} catch {
			error = 'Could not save the override. Try again.';
		} finally {
			saving = false;
		}
	}

	async function clear() {
		if (saving) return;
		saving = true;
		error = '';
		try {
			await onClear();
			draftVerdict = null;
			draftNote = '';
		} catch {
			error = 'Could not clear the override. Try again.';
		} finally {
			saving = false;
		}
	}
</script>

<div class="review" class:set={!!review.verdict}>
	<div class="rhead">
		<h4><Icon name="gavel" size={13} /> Supervisor judgment</h4>
		{#if review.verdict}
			<Badge tone={VERDICT[review.verdict]?.tone ?? 'neutral'} variant="solid">
				<Icon name={VERDICT[review.verdict]?.icon ?? 'circle-check'} size={11} />
				{VERDICT[review.verdict]?.label}
			</Badge>
		{/if}
	</div>

	<p class="hint">
		Override the AI verdict for claim {idx + 1} with your own. It drives the document
		roll-up and the reasoning graph, and is recorded in the audit trail.
	</p>

	<div class="opts" role="group" aria-label="Manual verdict">
		{#each ORDER as v (v)}
			<button
				type="button"
				class="opt"
				class:sel={draftVerdict === v}
				disabled={saving}
				onclick={() => (draftVerdict = draftVerdict === v ? null : v)}
			>
				<Icon name={VERDICT[v].icon} size={13} />
				{VERDICT[v].label}
			</button>
		{/each}
	</div>

	{#if aiVerdict && draftVerdict && draftVerdict !== aiVerdict}
		<p class="diff">
			<Icon name="sparkles" size={11} /> Differs from the AI verdict ({VERDICT[aiVerdict]?.label ?? aiVerdict}).
		</p>
	{/if}

	<textarea
		rows="2"
		bind:value={draftNote}
		disabled={saving}
		placeholder="Reason for the override (optional, written to the audit trail)…"
	></textarea>

	{#if error}<p class="err"><Icon name="triangle-alert" size={12} /> {error}</p>{/if}

	<div class="foot">
		{#if review.verdict && review.by}
			<span class="meta">Set by {review.by}{#if review.at} · {fmtDateTime(review.at)}{/if}</span>
		{:else}
			<span class="meta">No manual verdict yet.</span>
		{/if}
		<div class="btns">
			{#if review.verdict}
				<button type="button" class="ghost" disabled={saving} onclick={clear}>Clear</button>
			{/if}
			<button type="button" class="save" disabled={!canSave} onclick={save}>
				<Icon name="check" size={13} />
				{saving ? 'Saving…' : review.verdict ? 'Update' : 'Save judgment'}
			</button>
		</div>
	</div>
</div>

<style>
	.review {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 12px;
		border: 1.5px solid var(--border-default);
		border-radius: var(--radius-md);
		background: var(--surface-card);
	}
	.review.set {
		border-color: var(--color-accent);
		background: var(--terracotta-50);
	}
	.rhead {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}
	.rhead h4 {
		display: flex;
		align-items: center;
		gap: 6px;
		margin: 0;
		font-size: var(--text-xs);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
		color: var(--text-tertiary);
	}
	.hint {
		margin: 0;
		font-size: 11px;
		line-height: var(--leading-snug);
		color: var(--text-tertiary);
	}
	.opts {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 6px;
	}
	.opt {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 7px 9px;
		font-family: var(--font-display);
		font-weight: var(--weight-medium);
		font-size: var(--text-xs);
		color: var(--text-secondary);
		background: var(--surface-card);
		border: 1.5px solid var(--border-default);
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: all var(--duration-fast) var(--ease-out);
	}
	.opt:hover:not(:disabled) {
		border-color: var(--border-strong);
		color: var(--text-primary);
	}
	.opt.sel {
		color: var(--text-primary);
		border-color: var(--color-accent);
		background: var(--surface-card);
		box-shadow: var(--shadow-focus);
	}
	.opt:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	.diff {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		margin: 0;
		font-size: 11px;
		color: var(--color-accent-active);
	}
	textarea {
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
	textarea:focus {
		outline: none;
		border-color: var(--border-focus);
		box-shadow: var(--shadow-focus);
	}
	.err {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		margin: 0;
		font-size: 11px;
		color: var(--status-danger-fg);
	}
	.foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		flex-wrap: wrap;
	}
	.meta {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--text-tertiary);
	}
	.btns {
		display: inline-flex;
		gap: 6px;
	}
	.ghost {
		font-family: var(--font-display);
		font-weight: var(--weight-medium);
		font-size: var(--text-xs);
		color: var(--text-secondary);
		background: transparent;
		border: 1.5px solid var(--border-default);
		border-radius: var(--radius-sm);
		padding: 6px 10px;
		cursor: pointer;
	}
	.ghost:hover:not(:disabled) {
		border-color: var(--border-strong);
		color: var(--text-primary);
	}
	.save {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-family: var(--font-display);
		font-weight: var(--weight-medium);
		font-size: var(--text-xs);
		color: var(--color-on-accent);
		background: var(--color-accent);
		border: 1.5px solid transparent;
		border-radius: var(--radius-sm);
		padding: 6px 11px;
		cursor: pointer;
	}
	.save:hover:not(:disabled) {
		background: var(--color-accent-hover);
	}
	.save:disabled,
	.ghost:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
