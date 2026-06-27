<script lang="ts">
	import { ACTION, fmtDateTime } from '$lib/format';
	import type { SupervisoryAction } from '$lib/types';
	import Icon from './Icon.svelte';

	let { entries }: { entries: SupervisoryAction[] } = $props();

	let verifying = $state(false);
	let result = $state<null | {
		ok: boolean;
		length: number;
		brokenAt: number | null;
		reason: string | null;
	}>(null);

	async function verify() {
		verifying = true;
		result = null;
		try {
			const res = await fetch('/api/audit/verify');
			result = await res.json();
		} catch {
			result = { ok: false, length: 0, brokenAt: null, reason: 'verification request failed' };
		} finally {
			verifying = false;
		}
	}
</script>

<div class="audit">
	<div class="bar">
		<span class="meta">
			<Icon name="lock" size={13} color="var(--text-tertiary)" />
			Hash-chained · {entries.length}
			{entries.length === 1 ? 'action' : 'actions'} on this matter
		</span>
		<button class="vbtn" onclick={verify} disabled={verifying}>
			<Icon name="shield-check" size={14} />
			{verifying ? 'Verifying…' : 'Verify ledger'}
		</button>
	</div>

	{#if result}
		<div class="result" class:ok={result.ok} class:bad={!result.ok}>
			{#if result.ok}
				<Icon name="circle-check" size={15} color="var(--status-success-fg)" />
				Ledger intact — {result.length} actions verified across all matters, chain unbroken.
			{:else}
				<Icon name="triangle-alert" size={15} color="var(--status-danger-fg)" />
				Tamper detected at entry #{(result.brokenAt ?? 0) + 1}: {result.reason}.
			{/if}
		</div>
	{/if}

	{#if entries.length === 0}
		<p class="empty">No supervisory actions yet. The trail begins with your first decision.</p>
	{:else}
		<ol class="trail">
			{#each entries as e (e.id)}
				<li class="entry">
					<span class="dot"><Icon name={ACTION[e.action]?.icon ?? 'gavel'} size={13} /></span>
					<div class="body">
						<div class="line">
							<strong>{ACTION[e.action]?.label ?? e.action}</strong>
							<span class="actor">{e.actorEmail}</span>
							<span class="when">{fmtDateTime(e.createdAt)}</span>
						</div>
						{#if e.reason}<p class="reason">“{e.reason}”</p>{/if}
						<div class="hash" title={e.hash}><Icon name="lock" size={10} /> {e.hash.slice(0, 18)}…</div>
					</div>
				</li>
			{/each}
		</ol>
	{/if}
</div>

<style>
	.bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
		margin-bottom: var(--space-3);
	}
	.meta {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--text-tertiary);
	}
	.vbtn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-family: var(--font-display);
		font-weight: var(--weight-medium);
		font-size: var(--text-sm);
		color: var(--text-primary);
		background: var(--surface-card);
		border: 1.5px solid var(--border-strong);
		border-radius: var(--radius-md);
		padding: 7px 12px;
		cursor: pointer;
	}
	.vbtn:hover {
		background: var(--surface-hover);
	}
	.vbtn:disabled {
		opacity: 0.5;
		cursor: progress;
	}
	.result {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: var(--text-sm);
		font-weight: var(--weight-medium);
		padding: 10px 12px;
		border-radius: var(--radius-md);
		margin-bottom: var(--space-4);
	}
	.result.ok {
		background: var(--status-success-bg);
		color: var(--status-success-fg);
	}
	.result.bad {
		background: var(--status-danger-bg);
		color: var(--status-danger-fg);
	}
	.empty {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--text-tertiary);
	}
	.trail {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.entry {
		position: relative;
		display: grid;
		grid-template-columns: 26px 1fr;
		gap: 12px;
		padding-bottom: var(--space-4);
	}
	.entry:not(:last-child)::before {
		content: '';
		position: absolute;
		left: 12px;
		top: 24px;
		bottom: 0;
		width: 1.5px;
		background: var(--border-default);
	}
	.dot {
		width: 24px;
		height: 24px;
		border-radius: var(--radius-pill);
		background: var(--surface-sunken);
		border: 1.5px solid var(--border-default);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-secondary);
		z-index: 1;
	}
	.line {
		display: flex;
		align-items: baseline;
		gap: 8px;
		flex-wrap: wrap;
		font-size: var(--text-sm);
		color: var(--text-primary);
	}
	.actor {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--text-secondary);
	}
	.when {
		margin-left: auto;
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--text-tertiary);
	}
	.reason {
		margin: 4px 0 0;
		font-family: var(--font-serif);
		font-style: italic;
		font-size: var(--text-sm);
		color: var(--neutral-700);
	}
	.hash {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		margin-top: 5px;
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--text-tertiary);
	}
</style>
