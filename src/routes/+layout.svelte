<script lang="ts">
	import '../app.css';
	import Brand from '$lib/components/Brand.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import Avatar from '$lib/components/Avatar.svelte';

	let { children, data } = $props();
</script>

<svelte:head>
	<link rel="icon" href="/favicon.svg" />
</svelte:head>

<div class="shell">
	<header class="topbar">
		<Brand />
		<div class="who">
			<div class="meta">
				<span class="role"><Icon name="shield-check" size={12} /> Supervising lawyer</span>
				<span class="email">{data.actorEmail}</span>
			</div>
			<Avatar name="Giulia Romano" size={34} />
		</div>
	</header>
	<main class="content">
		{@render children()}
	</main>
</div>

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
		gap: 12px;
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
	.content {
		flex: 1;
		width: 100%;
		max-width: var(--container-max);
		margin: 0 auto;
		padding: var(--space-6);
	}
</style>
