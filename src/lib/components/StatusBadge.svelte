<script lang="ts">
	import { STATUS } from '$lib/format';
	import Badge from './Badge.svelte';
	import Icon from './Icon.svelte';

	let { status }: { status: string } = $props();
	const s = $derived(STATUS[status] ?? STATUS.pending);
</script>

<Badge tone={s.tone}>
	<Icon name={s.icon} size={12} />
	{s.label}
</Badge>
