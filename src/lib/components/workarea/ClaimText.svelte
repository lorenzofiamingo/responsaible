<script lang="ts">
	import type { ClaimGraphInfo } from '$lib/claim-graph';
	import type { AtomicClaim, ClaimRunResult } from '$lib/types';

	let {
		body,
		claims,
		selectedId,
		statusById,
		resultById,
		graph,
		onSelect
	}: {
		body: string;
		claims: AtomicClaim[];
		selectedId: string | null;
		statusById: Record<string, string>;
		resultById: Record<string, ClaimRunResult>;
		graph?: Map<string, ClaimGraphInfo>;
		onSelect: (id: string) => void;
	} = $props();

	// Interleave plain-text gaps with claim spans, in document order.
	type Seg = { type: 'gap'; text: string } | { type: 'claim'; claim: AtomicClaim; text: string };
	const segments = $derived.by(() => {
		const out: Seg[] = [];
		const ordered = [...claims].sort((a, b) => a.charStart - b.charStart);
		let cursor = 0;
		for (const c of ordered) {
			if (c.charStart > cursor) out.push({ type: 'gap', text: body.slice(cursor, c.charStart) });
			out.push({ type: 'claim', claim: c, text: body.slice(c.charStart, c.charEnd) });
			cursor = Math.max(cursor, c.charEnd);
		}
		if (cursor < body.length) out.push({ type: 'gap', text: body.slice(cursor) });
		return out;
	});

	function tone(id: string): string {
		if (statusById[id] === 'running') return 'running';
		if (statusById[id] !== 'analyzed') return 'pending';
		const r = resultById[id];
		if (!r) return 'pending';
		let t = 'ok';
		if (r.verdict === 'unsupported' || r.verdict === 'flag' || r.riskSeverity === 'high') t = 'high';
		else if (r.riskSeverity === 'med' || r.verdict === 'weak') t = 'med';
		// A claim that looks fine on its own but rests on a weaker premise is risky too.
		const g = graph?.get(id);
		if (g?.undermined) {
			if (g.inheritedVerdict === 'unsupported' || g.inheritedVerdict === 'flag') t = 'high';
			else if (t === 'ok') t = 'med';
		}
		return t;
	}

	function isLoadBearing(id: string): boolean {
		return graph?.get(id)?.loadBearing ?? false;
	}
</script>

<div class="doc">
	{#each segments as seg, i (i)}
		{#if seg.type === 'gap'}{seg.text}{:else}<button
				type="button"
				class="atom tone-{tone(seg.claim.id)}"
				class:sel={selectedId === seg.claim.id}
				class:bearing={isLoadBearing(seg.claim.id)}
				onclick={() => onSelect(seg.claim.id)}
				title="Claim {seg.claim.idx + 1}{isLoadBearing(seg.claim.id) ? ' · load-bearing' : ''}">{seg.text}</button
			>{/if}
	{/each}
</div>

<style>
	.doc {
		font-size: var(--text-base);
		line-height: var(--leading-relaxed);
		color: var(--text-primary);
		white-space: pre-wrap;
	}
	.atom {
		font: inherit;
		color: inherit;
		border: none;
		padding: 1px 2px;
		margin: 0 -1px;
		border-radius: var(--radius-xs);
		cursor: pointer;
		background: var(--atom-bg, transparent);
		box-shadow: inset 0 -1.5px 0 var(--atom-line, var(--border-strong));
		-webkit-box-decoration-break: clone;
		box-decoration-break: clone;
		transition: background var(--duration-fast) var(--ease-out);
	}
	.atom:hover {
		background: var(--atom-hover, var(--surface-sunken));
	}
	/* Foundational claims others rest on get a thicker underline. */
	.atom.bearing {
		box-shadow: inset 0 -3px 0 var(--atom-line, var(--border-strong));
	}
	.tone-pending {
		--atom-line: var(--border-strong);
		--atom-hover: var(--surface-sunken);
	}
	.tone-running {
		--atom-bg: var(--terracotta-50);
		--atom-line: var(--color-accent);
		animation: pulse 1.1s var(--ease-in-out) infinite;
	}
	.tone-ok {
		--atom-bg: var(--status-success-bg);
		--atom-line: var(--status-success-fg);
		--atom-hover: var(--status-success-bg);
	}
	.tone-med {
		--atom-bg: var(--status-warning-bg);
		--atom-line: var(--status-warning-fg);
		--atom-hover: var(--status-warning-bg);
	}
	.tone-high {
		--atom-bg: var(--status-danger-bg);
		--atom-line: var(--status-danger-fg);
		--atom-hover: var(--status-danger-bg);
	}
	.atom.sel {
		outline: 2px solid var(--color-accent);
		outline-offset: 1px;
		background: var(--terracotta-50);
	}
	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.55;
		}
	}
</style>
