<script lang="ts">
	import { VERIFY } from '$lib/format';
	import Badge from './Badge.svelte';
	import Icon from './Icon.svelte';

	let { status }: { status: string } = $props();
	const v = $derived(VERIFY[status] ?? VERIFY.unchecked);
</script>

<Badge tone={v.tone}>
	<Icon name={v.icon} size={12} />
	{v.label}
</Badge>
