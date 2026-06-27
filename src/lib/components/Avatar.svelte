<script lang="ts">
	let { name = '', size = 36 }: { name?: string; size?: number } = $props();
	const initials = $derived(
		name
			.split(' ')
			.map((p) => p[0])
			.filter(Boolean)
			.slice(0, 2)
			.join('')
			.toUpperCase()
	);
</script>

<span class="avatar" style="--s:{size}px; font-size:{Math.round(size * 0.38)}px">{initials}</span>

<style>
	.avatar {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: var(--s);
		height: var(--s);
		border-radius: var(--radius-pill);
		background: var(--terracotta-100);
		color: var(--terracotta-800);
		font-family: var(--font-display);
		font-weight: var(--weight-semibold);
		flex: none;
	}
</style>
