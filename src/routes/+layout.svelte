<script lang="ts">
	import '../app.css';
	import { authClient } from '$lib/auth-client';
	import Avatar from '$lib/components/Avatar.svelte';
	import Brand from '$lib/components/Brand.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { CAN_SUBMIT, ROLE } from '$lib/format';

	let { children, data } = $props();

	let switching = $state(false);
	async function switchUser() {
		switching = true;
		await authClient.signOut();
		// Full reload so the layout drops the old session cleanly.
		window.location.href = '/login';
	}

	const role = $derived(data.user ? (ROLE[data.user.role] ?? ROLE.operator) : null);
	const canSubmit = $derived(!!data.user && CAN_SUBMIT.has(data.user.role));
</script>

<svelte:head>
	<link rel="icon" href="/favicon.svg" />
</svelte:head>

{#if data.user && role}
	<div class="shell">
		<header class="topbar">
			<Brand />
			<div class="who">
				{#if canSubmit}
					<a class="add" href="/new" title="Add work product">
						<Icon name="file-text" size={14} /> <span class="label">Add work product</span>
					</a>
				{/if}
				<div class="meta">
					<span class="role"><Icon name={role.icon} size={12} /> {role.label}</span>
					<span class="email">{data.user.email}</span>
				</div>
				<Avatar name={data.user.name} size={34} />
				<button class="switch" onclick={switchUser} disabled={switching} title="Sign out and switch user">
					<Icon name="rotate-ccw" size={14} />
					<span class="label">Switch</span>
				</button>
			</div>
		</header>
		<main class="content">
			{@render children()}
		</main>
	</div>
{:else}
	<main class="auth-shell">
		{@render children()}
	</main>
{/if}

<style>
	.shell {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}
	.topbar {
		position: sticky;
		top: 0;
		z-index: 10;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		height: 60px;
		padding: 0 var(--space-6);
		background: rgba(250, 248, 244, 0.85);
		backdrop-filter: blur(8px);
		border-bottom: 1.5px solid var(--border-default);
	}
	.who {
		display: flex;
		align-items: center;
		gap: 14px;
	}
	.add {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-family: var(--font-display);
		font-weight: var(--weight-medium);
		font-size: var(--text-sm);
		color: var(--text-primary);
		text-decoration: none;
		background: var(--surface-card);
		border: 1.5px solid var(--border-strong);
		border-radius: var(--radius-md);
		padding: 7px 12px;
	}
	.add:hover {
		border-color: var(--color-accent);
		background: var(--terracotta-50);
	}
	.meta {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		line-height: 1.25;
	}
	.role {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--text-tertiary);
	}
	.email {
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		color: var(--text-secondary);
	}
	.switch {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-family: var(--font-display);
		font-weight: var(--weight-medium);
		font-size: var(--text-sm);
		color: var(--text-secondary);
		background: transparent;
		border: 1.5px solid var(--border-default);
		border-radius: var(--radius-md);
		padding: 7px 11px;
		cursor: pointer;
	}
	.switch:hover:not(:disabled) {
		color: var(--text-primary);
		border-color: var(--border-strong);
		background: var(--surface-hover);
	}
	.switch:disabled {
		opacity: 0.6;
		cursor: progress;
	}
	.content {
		flex: 1;
		width: 100%;
		max-width: var(--container-max);
		margin: 0 auto;
		padding: var(--space-6);
	}
	.auth-shell {
		min-height: 100vh;
	}

	/* Reclaim space as the bar narrows: drop the email, then the role,
	   then collapse the buttons to icon-only — the avatar still carries identity. */
	@media (max-width: 860px) {
		.topbar {
			gap: 12px;
			padding: 0 var(--space-4);
		}
		.who {
			gap: 12px;
		}
		.email {
			display: none;
		}
	}
	@media (max-width: 600px) {
		.who {
			gap: 8px;
		}
		.meta {
			display: none;
		}
		.add,
		.switch {
			padding: 7px;
		}
		.add .label,
		.switch .label {
			/* Visually hidden but kept for screen readers; the title attr labels it too. */
			position: absolute;
			width: 1px;
			height: 1px;
			padding: 0;
			margin: -1px;
			overflow: hidden;
			clip: rect(0, 0, 0, 0);
			white-space: nowrap;
			border: 0;
		}
		.content {
			padding: var(--space-4);
		}
	}
</style>
