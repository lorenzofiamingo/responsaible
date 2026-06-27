<script lang="ts">
	import { claimTone, type ClaimGraphInfo } from '$lib/claim-graph';
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
		return claimTone(statusById[id] ?? 'pending', resultById[id], graph?.get(id));
	}

	function isLoadBearing(id: string): boolean {
		return graph?.get(id)?.loadBearing ?? false;
	}
</script>

<div class="doc">
	{#each segments as seg, i (i)}
		{#if seg.type === 'gap'}{seg.text}{:else}<span
				class="atom tone-{tone(seg.claim.id)}"
				class:sel={selectedId === seg.claim.id}
				class:bearing={isLoadBearing(seg.claim.id)}
				role="button"
				tabindex="0"
				aria-pressed={selectedId === seg.claim.id}
				onclick={() => onSelect(seg.claim.id)}
				onkeydown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						onSelect(seg.claim.id);
					}
				}}
				title="Claim {seg.claim.idx + 1}{isLoadBearing(seg.claim.id) ? ' · load-bearing' : ''}">{seg.text}</span
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
	/* Claims read as continuous prose; status is a quiet pen-style underline,
	   not a filled block — so the body looks like a document, not a stack. */
	/* A clickable inline <span> (not a <button>): the browser forces buttons to
	   inline-block, which boxes each claim onto its own line. An inline span lets
	   claims flow and wrap as continuous prose. */
	.atom {
		font: inherit;
		color: inherit;
		border-radius: var(--radius-xs);
		cursor: pointer;
		background: transparent;
		text-decoration-line: underline;
		text-decoration-color: var(--atom-line, transparent);
		text-decoration-thickness: 2px;
		text-decoration-skip-ink: none;
		text-underline-offset: 0.22em;
		-webkit-box-decoration-break: clone;
		box-decoration-break: clone;
		transition:
			background var(--duration-fast) var(--ease-out),
			text-decoration-color var(--duration-fast) var(--ease-out);
	}
	.atom:hover {
		background: var(--surface-hover);
	}
	.atom:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 1px;
		border-radius: var(--radius-xs);
	}
	/* Foundational claims others rest on get a thicker underline. */
	.atom.bearing {
		text-decoration-thickness: 3.5px;
	}
	.tone-pending {
		/* Not analyzed yet — no underline, reads as plain document text. */
		--atom-line: transparent;
	}
	.tone-running {
		--atom-line: var(--color-accent);
		animation: pulse 1.1s var(--ease-in-out) infinite;
	}
	.tone-ok {
		--atom-line: var(--status-success-fg);
	}
	.tone-med {
		--atom-line: var(--status-warning-fg);
	}
	.tone-high {
		--atom-line: var(--status-danger-fg);
	}
	.atom.sel {
		/* Selection is shown by the highlight alone — no underline. */
		background: var(--terracotta-50);
		text-decoration-line: none;
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
