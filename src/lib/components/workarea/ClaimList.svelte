<script lang="ts">
	import type { ClaimGraphInfo } from '$lib/claim-graph';
	import type { AtomicClaim, ClaimRunResult } from '$lib/types';
	import ClaimCard from './ClaimCard.svelte';

	let {
		claims,
		selectedId,
		statusById,
		resultById,
		graph,
		groupLabelFor,
		onSelect
	}: {
		claims: AtomicClaim[];
		selectedId: string | null;
		statusById: Record<string, string>;
		resultById: Record<string, ClaimRunResult>;
		graph?: Map<string, ClaimGraphInfo>;
		groupLabelFor: (claim: AtomicClaim) => string;
		onSelect: (id: string) => void;
	} = $props();
</script>

<div class="list">
	{#each claims as claim (claim.id)}
		<div id="claim-{claim.id}">
			<ClaimCard
				{claim}
				selected={selectedId === claim.id}
				status={statusById[claim.id] ?? 'pending'}
				result={resultById[claim.id]}
				info={graph?.get(claim.id)}
				groupLabel={groupLabelFor(claim)}
				onSelect={() => onSelect(claim.id)}
			/>
		</div>
	{/each}
</div>

<style>
	.list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
</style>
