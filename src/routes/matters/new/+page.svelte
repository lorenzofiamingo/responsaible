<script lang="ts">
	import { goto } from '$app/navigation';
	import Icon from '$lib/components/Icon.svelte';

	let name = $state('');
	let ref = $state('');
	let client = $state('');
	let description = $state('');
	let submitting = $state(false);
	let error = $state('');

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		if (!name.trim() || !ref.trim()) {
			error = 'Matter name and reference are both required.';
			return;
		}
		submitting = true;
		error = '';
		try {
			const res = await fetch('/api/matters', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ name, ref, client, description })
			});
			const out = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
			if (!res.ok || !out.id) {
				error = out.error ?? `Could not create the matter (HTTP ${res.status}).`;
				submitting = false;
				return;
			}
			await goto(`/matters/${out.id}`);
		} catch (err) {
			error = (err as Error).message;
			submitting = false;
		}
	}
</script>

<div class="page">
	<a class="back" href="/"><Icon name="arrow-right" size={14} class="flip" /> Back to matters</a>

	<header class="hdr">
		<span class="itaily-eyebrow">New matter</span>
		<h1>Open a new matter</h1>
		<p class="sub">
			A matter is a client engagement. Create it here, then file AI work products under it.
		</p>
	</header>

	<form class="form" onsubmit={submit}>
		<div class="grid2">
			<div class="field">
				<span class="lbl">Matter name</span>
				<input bind:value={name} placeholder="Project Borealis" />
			</div>
			<div class="field">
				<span class="lbl">Matter ref</span>
				<input bind:value={ref} placeholder="MAT-2026-0181" />
			</div>
		</div>
		<div class="field">
			<span class="lbl">Client</span>
			<input bind:value={client} placeholder="Borealis Analytics Ltd." />
		</div>
		<div class="field">
			<span class="lbl">Description</span>
			<textarea bind:value={description} rows="3" placeholder="One-line description of the engagement…"
			></textarea>
		</div>

		{#if error}
			<p class="err"><Icon name="triangle-alert" size={14} /> {error}</p>
		{/if}

		<div class="actions">
			<button class="primary" type="submit" disabled={submitting}>
				<Icon name="folder-open" size={15} />
				{submitting ? 'Creating…' : 'Create matter'}
			</button>
			<a class="cancel" href="/">Cancel</a>
		</div>
	</form>
</div>

<style>
	.page {
		max-width: 720px;
		margin: 0 auto;
	}
	.back {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: var(--text-sm);
		color: var(--text-secondary);
		text-decoration: none;
		margin-bottom: var(--space-4);
	}
	.back:hover {
		color: var(--text-link);
	}
	.back :global(.flip) {
		transform: rotate(180deg);
	}

	.hdr {
		margin-bottom: var(--space-5);
	}
	.hdr h1 {
		font-size: var(--text-2xl);
		margin: 6px 0 8px;
	}
	.sub {
		margin: 0;
		max-width: 60ch;
		color: var(--text-secondary);
		font-size: var(--text-md);
		line-height: var(--leading-normal);
	}

	.form {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		background: var(--surface-card);
		border: 1.5px solid var(--border-default);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-xs);
		padding: var(--space-5);
	}
	.grid2 {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-4);
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.lbl {
		font-size: var(--text-sm);
		font-weight: var(--weight-medium);
		color: var(--text-secondary);
	}
	.field input,
	.field textarea {
		font-family: var(--font-sans);
		font-size: var(--text-base);
		color: var(--text-primary);
		background: var(--surface-card);
		border: 1.5px solid var(--border-strong);
		border-radius: var(--radius-md);
		padding: 9px 12px;
	}
	.field input:focus,
	.field textarea:focus {
		outline: none;
		border-color: var(--border-focus);
		box-shadow: var(--shadow-focus);
	}

	.err {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		margin: 0;
		font-size: var(--text-sm);
		color: var(--status-danger-fg, var(--color-accent));
	}

	.actions {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.primary {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		font-family: var(--font-display);
		font-weight: var(--weight-medium);
		font-size: var(--text-sm);
		color: var(--on-accent, #fff);
		background: var(--color-accent);
		border: 1.5px solid var(--color-accent);
		border-radius: var(--radius-md);
		padding: 9px 16px;
		cursor: pointer;
	}
	.primary:hover:not(:disabled) {
		background: var(--color-accent-active, var(--color-accent));
	}
	.primary:disabled {
		opacity: 0.6;
		cursor: progress;
	}
	.cancel {
		font-size: var(--text-sm);
		color: var(--text-secondary);
		text-decoration: none;
	}
	.cancel:hover {
		color: var(--text-primary);
	}

	@media (max-width: 600px) {
		.grid2 {
			grid-template-columns: 1fr;
		}
	}
</style>
