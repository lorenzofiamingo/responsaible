<script lang="ts">
	import { RISK_CATEGORY, SEVERITY } from '$lib/format';
	import Badge from './Badge.svelte';
	import Icon from './Icon.svelte';

	let {
		category,
		severity,
		showCategory = true
	}: { category: string; severity: string; showCategory?: boolean } = $props();

	const c = $derived(RISK_CATEGORY[category] ?? { label: category, icon: 'shield-alert' });
	const s = $derived(SEVERITY[severity] ?? SEVERITY.low);
</script>

<Badge tone={s.tone}>
	<Icon name={c.icon} size={12} />
	{#if showCategory}{c.label} · {s.label}{:else}{s.label}{/if}
</Badge>
