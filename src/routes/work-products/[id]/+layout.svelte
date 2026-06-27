<script lang="ts">
	import { page } from '$app/state';
	import ConfidenceMeter from '$lib/components/ConfidenceMeter.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import { fmtDateTime, WP_TYPE } from '$lib/format';

	let { data, children } = $props();

	const base = $derived(`/work-products/${data.wp.id}`);
	// The workspace tab is active on the child route; Summary is the index route.
	const onWorkspace = $derived(page.url.pathname.startsWith(`${base}/workspace`));
</script>

<div class="wp" class:ws={onWorkspace}>
	<a class="back" href="/"><Icon name="arrow-right" size={14} class="flip" /> Back to queue</a>

	<header class="hdr">
		<div class="eyebrow itaily-eyebrow">
			<Icon name={WP_TYPE[data.wp.type].icon} size={12} />
			{WP_TYPE[data.wp.type].label} · {data.wp.matterName} · {data.wp.matterRef}
		</div>
		<h1>{data.wp.title}</h1>
		<p class="summary">{data.wp.summary}</p>
		<div class="meta">
			<StatusBadge status={data.wp.status} />
			<ConfidenceMeter value={data.wp.confidence} />
			<span class="m"><Icon name="sparkles" size={13} /> {data.wp.agentName}</span>
			<span class="m mono">{data.wp.model}</span>
			<span class="m mono"><Icon name="clock" size={12} /> {fmtDateTime(data.wp.createdAt)}</span>
		</div>
	</header>

	<nav class="tabs">
		<a class="tab" class:active={!onWorkspace} href={base} data-sveltekit-noscroll>
			<Icon name="file-text" size={15} /> Summary
		</a>
		<a class="tab" class:active={onWorkspace} href={`${base}/workspace`} data-sveltekit-noscroll>
			<Icon name="git-branch" size={15} /> Work area
		</a>
	</nav>

	{@render children()}
</div>

<style>
	/* On the Work area tab the page becomes a fixed-height app shell: the header
	   stays put and the three panes below fill the rest of the viewport, each
	   scrolling on its own, so the page itself never scrolls. The bounded height
	   subtracts the sticky top bar (60px) and the page's vertical padding (the
	   --space-6 the root .content adds top and bottom). Gated on BOTH dimensions:
	   only wide AND reasonably tall viewports get the shell — on anything narrower
	   than the three-up breakpoint or shorter than ~700px the panes flow and the
	   page scrolls, so the fixed chrome can never squeeze a pane to nothing. */
	@media (min-width: 1200px) and (min-height: 700px) {
		.wp.ws {
			display: flex;
			flex-direction: column;
			height: calc(100dvh - 60px - 2 * var(--space-6));
			min-height: 0;
		}
		.wp.ws .back,
		.wp.ws .hdr,
		.wp.ws .tabs {
			flex: none;
		}
		.wp.ws :global(.workarea) {
			flex: 1;
			min-height: 0;
		}
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
		margin-bottom: var(--space-4);
	}
	.eyebrow {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		margin-bottom: 8px;
	}
	.hdr h1 {
		font-size: var(--text-xl);
		margin: 0 0 8px;
		line-height: var(--leading-snug);
	}
	.summary {
		margin: 0 0 14px;
		max-width: 80ch;
		font-size: var(--text-md);
		color: var(--text-secondary);
		line-height: var(--leading-normal);
	}
	.meta {
		display: flex;
		align-items: center;
		gap: 16px;
		flex-wrap: wrap;
	}
	.meta .m {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: var(--text-xs);
		color: var(--text-tertiary);
	}
	.meta .mono {
		font-family: var(--font-mono);
	}

	.tabs {
		display: flex;
		gap: var(--space-1);
		margin-bottom: var(--space-5);
		border-bottom: 1.5px solid var(--border-default);
	}
	.tab {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		padding: 10px 14px;
		margin-bottom: -1.5px;
		font-family: var(--font-display);
		font-weight: var(--weight-medium);
		font-size: var(--text-sm);
		color: var(--text-secondary);
		text-decoration: none;
		border-bottom: 2.5px solid transparent;
		transition: color var(--duration-fast) var(--ease-out);
	}
	.tab:hover {
		color: var(--text-primary);
	}
	.tab.active {
		color: var(--color-accent-active);
		border-bottom-color: var(--color-accent);
	}
</style>
