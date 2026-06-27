<script lang="ts">
	import { claimTone, type ClaimGraphInfo } from '$lib/claim-graph';
	import type { AtomicClaim, ClaimEdge, ClaimRunResult } from '$lib/types';

	let {
		claims,
		edges,
		graph,
		statusById,
		resultById,
		selectedId,
		onSelect
	}: {
		claims: AtomicClaim[];
		edges: ClaimEdge[];
		graph?: Map<string, ClaimGraphInfo>;
		statusById: Record<string, string>;
		resultById: Record<string, ClaimRunResult>;
		selectedId: string | null;
		onSelect: (id: string) => void;
	} = $props();

	const R = 17;
	const GAP = 76;
	const PADX = 22;
	const PADY = 26;

	// Layered layout: foundations (no premises) sink to the BOTTOM, the claims that
	// rest on them rise toward the top, so every arrow points down to its support.
	const layout = $derived.by(() => {
		const ordered = [...claims].sort((a, b) => a.idx - b.idx);
		const idset = new Set(ordered.map((c) => c.id));
		const prem = new Map<string, string[]>();
		for (const c of ordered) {
			const info = graph?.get(c.id);
			prem.set(c.id, (info?.dependsOn ?? []).map((e) => e.toClaimId).filter((id) => idset.has(id)));
		}
		const depth = new Map<string, number>();
		const visiting = new Set<string>();
		function d(id: string): number {
			const cached = depth.get(id);
			if (cached != null) return cached;
			if (visiting.has(id)) return 0; // cycle guard (ordering edges are acyclic anyway)
			visiting.add(id);
			let v = 0;
			for (const p of prem.get(id) ?? []) v = Math.max(v, 1 + d(p));
			visiting.delete(id);
			depth.set(id, v);
			return v;
		}
		ordered.forEach((c) => d(c.id));
		const maxDepth = ordered.reduce((m, c) => Math.max(m, depth.get(c.id) ?? 0), 0);

		const layers = new Map<number, AtomicClaim[]>();
		for (const c of ordered) {
			const dd = depth.get(c.id) ?? 0;
			if (!layers.has(dd)) layers.set(dd, []);
			layers.get(dd)!.push(c);
		}
		const maxLayer = [...layers.values()].reduce((m, a) => Math.max(m, a.length), 1);
		const W = Math.max(196, maxLayer * 86 + PADX * 2);
		const H = PADY * 2 + R * 2 + maxDepth * GAP;
		const pos = new Map<string, { x: number; y: number }>();
		for (const [dd, arr] of layers) {
			const y = PADY + R + (maxDepth - dd) * GAP;
			arr.sort((a, b) => a.idx - b.idx);
			arr.forEach((c, i) => pos.set(c.id, { x: (W * (i + 1)) / (arr.length + 1), y }));
		}
		return { W, H, pos, nodes: ordered };
	});

	type Seg = { x1: number; y1: number; x2: number; y2: number; cls: string; head: boolean; title: string };
	const segs = $derived.by(() => {
		const out: Seg[] = [];
		for (const e of edges) {
			const a = layout.pos.get(e.fromClaimId);
			const b = layout.pos.get(e.toClaimId);
			if (!a || !b) continue;
			const dx = b.x - a.x;
			const dy = b.y - a.y;
			const len = Math.hypot(dx, dy) || 1;
			const ux = dx / len;
			const uy = dy / len;
			const conflict = e.relation === 'conflict';
			out.push({
				x1: a.x + ux * R,
				y1: a.y + uy * R,
				x2: b.x - ux * (R + 4),
				y2: b.y - uy * (R + 4),
				cls: e.ordering ? 'e-order' : conflict ? 'e-conf' : 'e-qual',
				head: !conflict,
				title: e.rationale
			});
		}
		return out;
	});

	function toneClass(id: string): string {
		return 'n-' + claimTone(statusById[id] ?? 'pending', resultById[id], graph?.get(id));
	}
	const bearing = (id: string) => graph?.get(id)?.loadBearing ?? false;
	const undermined = (id: string) => graph?.get(id)?.undermined ?? false;
	function onKey(e: KeyboardEvent, id: string) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			onSelect(id);
		}
	}
</script>

<div class="wrap">
	{#if claims.length}
		<svg viewBox="0 0 {layout.W} {layout.H}" width="100%" role="img" aria-label="Claim dependency graph">
			<defs>
				<marker
					id="cg-arrow"
					viewBox="0 0 10 10"
					refX="8.5"
					refY="5"
					markerWidth="6.5"
					markerHeight="6.5"
					orient="auto-start-reverse"
				>
					<path d="M0,0 L10,5 L0,10 z" fill="context-stroke" />
				</marker>
			</defs>

			{#each segs as s, i (i)}
				<line class={s.cls} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} marker-end={s.head ? 'url(#cg-arrow)' : undefined}>
					<title>{s.title}</title>
				</line>
			{/each}

			{#each layout.nodes as c (c.id)}
				{@const p = layout.pos.get(c.id)}
				{#if p}
					<g
						class="node"
						class:sel={selectedId === c.id}
						role="button"
						tabindex="0"
						aria-label="Claim {c.idx + 1}"
						transform="translate({p.x},{p.y})"
						onclick={() => onSelect(c.id)}
						onkeydown={(e) => onKey(e, c.id)}
					>
						<title>{c.text}</title>
						{#if selectedId === c.id}<circle class="ring" r={R + 4} />{/if}
						<circle class="dot {toneClass(c.id)}" class:bearing={bearing(c.id)} r={R} />
						{#if undermined(c.id)}<circle class="flag" r="3.5" cx={R - 4} cy={-(R - 4)} />{/if}
						<text class="lbl" text-anchor="middle" dominant-baseline="central">{c.idx + 1}</text>
					</g>
				{/if}
			{/each}
		</svg>

		<div class="legend">
			<span class="li" role="button" tabindex="0" aria-describedby="cg-tip-order">
				<i class="sw order"></i> depends on
				<span class="tip" role="tooltip" id="cg-tip-order"
					>Solid arrow: this claim rests on another as a premise, definition, or elaboration. If
					the supporting claim fails, this one is undermined.</span
				>
			</span>
			<span class="li" role="button" tabindex="0" aria-describedby="cg-tip-qual">
				<i class="sw qual"></i> qualifies
				<span class="tip" role="tooltip" id="cg-tip-qual"
					>Dashed arrow: this claim narrows or adds conditions to another, without supporting or
					contradicting it.</span
				>
			</span>
			<span class="li" role="button" tabindex="0" aria-describedby="cg-tip-conf">
				<i class="sw conf"></i> conflict
				<span class="tip" role="tooltip" id="cg-tip-conf"
					>Dashed line: this claim contradicts or is in tension with another.</span
				>
			</span>
		</div>
		{#if !edges.length}
			<p class="none">No dependencies mapped for this document.</p>
		{/if}
	{/if}
</div>

<style>
	.wrap {
		padding: 6px 2px 2px;
	}
	svg {
		display: block;
		max-width: 100%;
		height: auto;
		overflow: visible;
	}
	line {
		stroke-width: 1.6;
		fill: none;
	}
	.e-order {
		stroke: var(--text-primary);
	}
	.e-qual {
		stroke: var(--text-primary);
		stroke-dasharray: 4 3;
	}
	.e-conf {
		stroke: var(--status-danger-fg);
		stroke-dasharray: 2 3;
	}
	.node {
		cursor: pointer;
	}
	.node:focus-visible .dot {
		stroke: var(--color-accent);
	}
	.dot {
		stroke-width: 1.5;
		transition: filter var(--duration-fast) var(--ease-out);
	}
	.dot.bearing {
		stroke-width: 3.2;
	}
	.node:hover .dot {
		filter: brightness(0.96);
	}
	.ring {
		fill: none;
		stroke: var(--color-accent);
		stroke-width: 1.5;
	}
	.flag {
		fill: var(--status-danger-fg);
		stroke: var(--surface-card);
		stroke-width: 1.5;
	}
	.lbl {
		font-family: var(--font-mono);
		font-size: 13px;
		fill: var(--text-primary);
		pointer-events: none;
	}
	.n-pending {
		fill: var(--surface-sunken);
		stroke: var(--border-strong);
	}
	.n-running {
		fill: var(--terracotta-50);
		stroke: var(--color-accent);
	}
	.n-ok {
		fill: var(--status-success-bg);
		stroke: var(--status-success-fg);
	}
	.n-med {
		fill: var(--status-warning-bg);
		stroke: var(--status-warning-fg);
	}
	.n-high {
		fill: var(--status-danger-bg);
		stroke: var(--status-danger-fg);
	}
	.legend {
		position: relative; /* anchor for tooltips so they can't overflow the clipped panel */
		display: flex;
		flex-wrap: wrap;
		gap: 8px 14px;
		margin-top: 12px;
		padding-top: 9px;
		border-top: 1.5px solid var(--border-subtle);
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
		color: var(--text-tertiary);
	}
	.legend .li {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		cursor: help;
	}
	.legend .li:focus-visible {
		outline: 2px solid var(--border-focus);
		outline-offset: 2px;
		border-radius: var(--radius-xs);
	}
	.tip {
		position: absolute;
		left: 0;
		bottom: calc(100% + 8px);
		z-index: 5;
		width: max-content;
		max-width: 100%; /* relative to .legend = panel content width, never overflows */
		padding: 7px 9px;
		background: var(--surface-inverse);
		color: var(--text-on-inverse);
		border-radius: var(--radius-sm);
		box-shadow: var(--shadow-lg);
		font-size: var(--text-xs);
		text-transform: none;
		letter-spacing: normal;
		line-height: var(--leading-snug);
		text-align: left;
		opacity: 0;
		visibility: hidden;
		transform: translateY(2px);
		transition:
			opacity var(--duration-fast) var(--ease-out),
			transform var(--duration-fast) var(--ease-out),
			visibility var(--duration-fast);
		pointer-events: none;
	}
	.legend .li:hover .tip,
	.legend .li:focus-visible .tip {
		opacity: 1;
		visibility: visible;
		transform: translateY(0);
	}
	.sw {
		width: 14px;
		height: 0;
		border-top: 2px solid transparent;
		display: inline-block;
	}
	.sw.order {
		border-top-color: var(--text-primary);
	}
	.sw.qual {
		border-top: 2px dashed var(--text-primary);
	}
	.sw.conf {
		border-top: 2px dashed var(--status-danger-fg);
	}
	.none {
		margin: 8px 0 0;
		font-size: var(--text-xs);
		color: var(--text-tertiary);
	}
</style>
