<script lang="ts">
	import { authClient } from '$lib/auth-client';
	import Avatar from '$lib/components/Avatar.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { ROLE } from '$lib/format';

	let { data } = $props();
	let busy = $state('');
	let error = $state('');

	async function signInAs(email: string) {
		busy = email;
		error = '';
		const res = await authClient.signIn.email({ email, password: data.demoPassword });
		if (res.error) {
			error = res.error.message ?? 'Sign-in failed.';
			busy = '';
			return;
		}
		// Full reload so the root layout re-reads the new session (SvelteKit won't
		// re-run a shared layout's load on a client-side nav).
		window.location.href = '/';
	}
</script>

<div class="login">
	<div class="card">
		<img class="logo" src="/itaily-logo.svg" alt="Itaily" />
		<span class="itaily-eyebrow">Oversight</span>
		<h1>Sign in to the supervision console</h1>
		<p class="sub">
			Sign in as the <strong>supervising lawyer</strong> — upload documents, review the AI work
			queue and sign off decisions.
		</p>

		<div class="users">
			{#each data.demoUsers as u (u.email)}
				<button class="user" onclick={() => signInAs(u.email)} disabled={!!busy}>
					<Avatar name={u.name} size={42} />
					<span class="info">
						<span class="name">{u.name}</span>
						<span class="role">
							<Icon name={ROLE[u.role]?.icon ?? 'shield'} size={12} color="var(--color-accent)" />
							{ROLE[u.role]?.label ?? u.role}
						</span>
						<span class="can">{ROLE[u.role]?.can ?? ''}</span>
					</span>
					<Icon name={busy === u.email ? 'clock' : 'arrow-right'} size={18} color="var(--text-tertiary)" />
				</button>
			{/each}
		</div>

		{#if error}
			<p class="err"><Icon name="triangle-alert" size={14} /> {error}</p>
		{/if}
		<p class="note">Demo workspace · password <code>{data.demoPassword}</code> for every account.</p>
	</div>
</div>

<style>
	.login {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--space-6);
	}
	.card {
		width: 480px;
		max-width: 100%;
		background: var(--surface-card);
		border: 1.5px solid var(--border-default);
		border-radius: var(--radius-xl);
		box-shadow: var(--shadow-lg);
		padding: var(--space-7);
	}
	.logo {
		height: 30px;
		margin-bottom: var(--space-4);
	}
	.itaily-eyebrow {
		display: block;
		margin-bottom: 6px;
	}
	h1 {
		font-size: var(--text-xl);
		margin: 0 0 8px;
	}
	.sub {
		margin: 0 0 var(--space-5);
		color: var(--text-secondary);
		font-size: var(--text-base);
		line-height: var(--leading-normal);
	}
	.users {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.user {
		display: flex;
		align-items: center;
		gap: 14px;
		width: 100%;
		text-align: left;
		background: var(--surface-card);
		border: 1.5px solid var(--border-default);
		border-radius: var(--radius-md);
		padding: 12px 14px;
		cursor: pointer;
		transition:
			border-color var(--duration-fast) var(--ease-out),
			background var(--duration-fast) var(--ease-out);
	}
	.user:hover:not(:disabled) {
		border-color: var(--color-accent);
		background: var(--terracotta-50);
	}
	.user:disabled {
		opacity: 0.6;
		cursor: progress;
	}
	.info {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
		flex: 1;
	}
	.name {
		font-family: var(--font-display);
		font-weight: var(--weight-semibold);
		font-size: var(--text-base);
		color: var(--text-primary);
	}
	.role {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--text-secondary);
	}
	.can {
		font-size: var(--text-xs);
		color: var(--text-tertiary);
	}
	.err {
		display: flex;
		align-items: center;
		gap: 6px;
		margin: var(--space-4) 0 0;
		font-size: var(--text-sm);
		color: var(--status-danger-fg);
	}
	.note {
		margin: var(--space-5) 0 0;
		text-align: center;
		font-size: var(--text-xs);
		color: var(--text-tertiary);
	}
	code {
		font-family: var(--font-mono);
		background: var(--surface-sunken);
		padding: 1px 6px;
		border-radius: var(--radius-xs);
	}
</style>
