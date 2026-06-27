// Reasoning-graph derivation — client-safe (no server imports), pure functions.
//
// Given the atomic claims, their typed edges, and whatever per-claim results exist
// so far, derive each claim's relationships and its PROPAGATED risk. The core idea
// the product turns on: a claim can be individually well-supported yet undermined by
// a premise it rests on. Per-claim analysis can't see that; this can.
//
// `from` RESTS ON `to`. ORDERING edges (premise/definition/elaboration) propagate
// risk upward — a conclusion can be no more reliable than its weakest premise.
// LATERAL edges (qualification/conflict) are surfaced for consistency review only
// and never enter the propagation. Recompute this whenever results change.

import type { ClaimEdge, ClaimRelation } from './types';

export const ORDERING_RELATIONS = new Set<ClaimRelation>(['premise', 'definition', 'elaboration']);

/** Worse verdict ⇒ higher rank. `null`/unknown ⇒ -1 (ignored in propagation). */
const VERDICT_RANK: Record<string, number> = { supported: 0, weak: 1, flag: 2, unsupported: 3 };
function rank(v: string | null | undefined): number {
	return v != null && v in VERDICT_RANK ? VERDICT_RANK[v] : -1;
}

/** Minimal shape we need from a per-claim result (ClaimRunResult is a superset). */
export interface ResultLike {
	verdict: string | null;
	confidence: number;
}

export interface ClaimGraphInfo {
	/** Ordering edges where this claim is `from` — i.e. its premises. */
	dependsOn: ClaimEdge[];
	/** Ordering edges where this claim is `to` — i.e. claims resting on it. */
	supports: ClaimEdge[];
	/** Lateral (qualification) edges where this claim is `to`. */
	qualifiedBy: ClaimEdge[];
	/** Lateral (qualification) edges where this claim is `from`. */
	qualifies: ClaimEdge[];
	/** Conflict edges touching this claim (either end). */
	conflicts: ClaimEdge[];
	/** Direct ordering dependents (== supports.length). */
	dependentCount: number;
	/** A foundational claim that several others rest on. */
	loadBearing: boolean;
	/** This claim has a verdict. */
	analyzed: boolean;
	/** Analyzed, but a (transitive) premise it rests on is verdict-worse than itself. */
	undermined: boolean;
	/** The worst transitive-premise verdict, when undermined. */
	inheritedVerdict: string | null;
	/** The claim id achieving that worst verdict, when undermined (the culprit). */
	weakestPremiseId: string | null;
	/** min(own confidence, all analyzed transitive-premise confidences); null if unanalyzed. */
	effectiveConfidence: number | null;
}

function empty(): ClaimGraphInfo {
	return {
		dependsOn: [],
		supports: [],
		qualifiedBy: [],
		qualifies: [],
		conflicts: [],
		dependentCount: 0,
		loadBearing: false,
		analyzed: false,
		undermined: false,
		inheritedVerdict: null,
		weakestPremiseId: null,
		effectiveConfidence: null
	};
}

/**
 * Build the per-claim graph view, including propagated risk. Pure: same inputs ⇒
 * same output, so it's safe to wrap in a Svelte `$derived` keyed on `resultById`.
 */
export function buildClaimGraph(
	claims: { id: string }[],
	edges: ClaimEdge[],
	resultById: Record<string, ResultLike | undefined>
): Map<string, ClaimGraphInfo> {
	const ids = new Set(claims.map((c) => c.id));
	const out = new Map<string, ClaimGraphInfo>();
	for (const c of claims) out.set(c.id, empty());

	// Index edges; ignore dangling refs and self-loops defensively.
	const premiseAdj = new Map<string, string[]>(); // from -> [to] over ordering edges
	for (const id of ids) premiseAdj.set(id, []);
	for (const e of edges) {
		if (!ids.has(e.fromClaimId) || !ids.has(e.toClaimId) || e.fromClaimId === e.toClaimId) continue;
		const from = out.get(e.fromClaimId)!;
		const to = out.get(e.toClaimId)!;
		if (e.ordering && ORDERING_RELATIONS.has(e.relation)) {
			from.dependsOn.push(e);
			to.supports.push(e);
			premiseAdj.get(e.fromClaimId)!.push(e.toClaimId);
		} else if (e.relation === 'conflict') {
			from.conflicts.push(e);
			to.conflicts.push(e);
		} else {
			from.qualifies.push(e);
			to.qualifiedBy.push(e);
		}
	}

	// Transitive premises via DFS over ordering edges (cycle-safe).
	function transitivePremises(start: string): string[] {
		const seen = new Set<string>();
		const stack = [...(premiseAdj.get(start) ?? [])];
		while (stack.length) {
			const n = stack.pop()!;
			if (n === start || seen.has(n)) continue;
			seen.add(n);
			for (const m of premiseAdj.get(n) ?? []) if (!seen.has(m)) stack.push(m);
		}
		return [...seen];
	}

	for (const c of claims) {
		const info = out.get(c.id)!;
		info.dependentCount = info.supports.length;
		info.loadBearing = info.supports.length >= 2;

		const own = resultById[c.id];
		info.analyzed = !!own && own.verdict != null;

		// Propagate from analyzed transitive premises only.
		let worst = { rank: rank(own?.verdict), id: null as string | null, verdict: null as string | null };
		let effConf = info.analyzed ? own!.confidence : null;
		for (const pid of transitivePremises(c.id)) {
			const pr = resultById[pid];
			if (!pr || pr.verdict == null) continue;
			if (effConf != null) effConf = Math.min(effConf, pr.confidence);
			const r = rank(pr.verdict);
			if (r > worst.rank) worst = { rank: r, id: pid, verdict: pr.verdict };
		}
		info.effectiveConfidence = effConf;
		const undermined = info.analyzed && worst.id != null && worst.rank > rank(own!.verdict);
		info.undermined = undermined;
		info.inheritedVerdict = undermined ? worst.verdict : null;
		info.weakestPremiseId = undermined ? worst.id : null;
	}

	return out;
}
