<script lang="ts">
	let { href = '/' }: { href?: string } = $props();
</script>

<a class="brand" {href}>
	<img class="word" src="/itaily-logo.svg" alt="Itaily" />
	<span class="sep"></span>
	<span class="product">Oversight</span>
</a>

<style>
	.brand {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		text-decoration: none;
	}
	.word {
		height: 20px;
		display: block;
	}
	.sep {
		width: 1.5px;
		height: 18px;
		background: var(--border-strong);
	}
	.product {
		font-family: var(--font-display);
		font-weight: var(--weight-semibold);
		font-size: var(--text-md);
		letter-spacing: var(--tracking-tight);
		color: var(--text-primary);
	}

	/* On phones, keep just the logo so the topbar never overflows. */
	@media (max-width: 440px) {
		.sep,
		.product {
			display: none;
		}
	}
</style>
