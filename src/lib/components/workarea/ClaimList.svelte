<script lang="ts">
	import type { AtomicClaim, ClaimRunResult } from '$lib/types';
	import ClaimCard from './ClaimCard.svelte';

	let {
		claims,
		selectedId,
		statusById,
		resultById,
		groupLabelFor,
		onSelect,
		onRun
	}: {
		claims: AtomicClaim[];
		selectedId: string | null;
		statusById: Record<string, string>;
		resultById: Record<string, ClaimRunResult>;
		groupLabelFor: (claim: AtomicClaim) => string;
		onSelect: (id: string) => void;
		onRun: (id: string) => void;
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
				groupLabel={groupLabelFor(claim)}
				onSelect={() => onSelect(claim.id)}
				onRun={() => onRun(claim.id)}
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
