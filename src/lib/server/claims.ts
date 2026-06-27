/**
 * Runtime atomic-claim derivation — the live-ingestion twin of `deriveClaims` in
 * scripts/load-seed.mjs.
 *
 * When a new work product is ingested (POST /api/work-products → createWorkProduct)
 * its body must be split into the smallest independently-verifiable text units, the
 * same way the offline ADK seed does. Each claim carries its exact source span
 * (offsets into `work_product.body`), an auto-assigned work-group preset, and a
 * deterministic baseline analysis. The baseline is what the per-claim run reveals
 * as its cached fallback when no model key is configured (see src/lib/server/analyze.ts
 * and the seeded path in /api/work-products/[id]/analyze), so a freshly ingested
 * document behaves exactly like a seeded one offline.
 *
 * `deriveEdges` then builds the reasoning-graph edges between those claims — the
 * deterministic runtime stand-in for the offline ADK `claim_grapher`, so an ingested
 * document gets a real dependency graph (and risk propagation) instead of isolated nodes.
 *
 * This MUST stay in step with `deriveClaims`/`splitSentences`/`classifyKind`/
 * `baselineAnalysis` in scripts/load-seed.mjs so seeded and live-ingested documents
 * split identically. Preset assignment reuses `autoPreset` from $lib/workgroups —
 * the single source of truth (itself mirrored in agents/itaily_agents/workgroups.py).
 */

import { autoPreset } from '$lib/workgroups';
import type { ClaimRelation } from '$lib/types';

/** The `atomic_claim.kind` enum the splitter emits (subset of the schema enum). */
export type ClaimKind = 'citation_ref' | 'obligation' | 'boilerplate' | 'assertion';
/** The three presets the splitter auto-assigns (the narrow `assigned_preset` enum). */
export type AssignedPreset = 'quick_scan' | 'standard_review' | 'authority_deep_dive';

export interface DerivedClaimAnalysis {
	verdict: 'supported' | 'weak' | 'unsupported' | 'flag';
	confidence: number;
	summary: string;
	riskCategory: 'hallucination' | 'jurisdiction' | 'missing_authority' | 'conflict' | 'deadline' | null;
	riskSeverity: 'low' | 'med' | 'high' | null;
	riskRationale: string;
}

export interface DerivedClaim {
	idx: number;
	text: string;
	charStart: number;
	charEnd: number;
	kind: ClaimKind;
	assignedPreset: AssignedPreset;
	citationMarkers: number[];
	analysis: DerivedClaimAnalysis;
}

/** Just the fields claim derivation reads off the new work product. */
export interface DeriveClaimsInput {
	body?: string;
	confidence?: number;
	citations?: Array<{ marker?: number }>;
	riskSignals?: Array<{
		category: 'hallucination' | 'jurisdiction' | 'missing_authority' | 'conflict' | 'deadline';
		severity: 'low' | 'med' | 'high';
		rationale: string;
	}>;
}

const MODAL_OBLIGATION = /\b(shall|must|is required to|may not|prohibited|obliged)\b/i;
// Sentence-final period that is actually an abbreviation — don't split there.
const ABBR_TAIL = /(?:\b(?:Inc|Ltd|Corp|Co|Art|Arts|No|Nos|Reg|Dir|e\.g|i\.e|etc|vs|v|cf|Cf)\.|\b[A-Z]\.)\s*$/;

interface SentenceSpan {
	text: string;
	start: number;
	end: number;
}

/** Split a body into sentence spans, preserving exact [start,end) offsets and merging abbreviations. */
function splitSentences(body: string): SentenceSpan[] {
	const re = /[^.!?]*[.!?]+(?=\s|$)/g;
	const raw: Array<{ index: number; str: string }> = [];
	let m: RegExpExecArray | null;
	let lastEnd = 0;
	while ((m = re.exec(body)) !== null) {
		raw.push({ index: m.index, str: m[0] });
		lastEnd = m.index + m[0].length;
	}
	if (lastEnd < body.length && body.slice(lastEnd).trim()) {
		raw.push({ index: lastEnd, str: body.slice(lastEnd) });
	}
	// Merge a chunk into the next when it ends on an abbreviation.
	const out: SentenceSpan[] = [];
	for (let i = 0; i < raw.length; i++) {
		let { index, str } = raw[i];
		while (i < raw.length - 1 && ABBR_TAIL.test(str.trimEnd())) {
			i++;
			str = body.slice(index, raw[i].index + raw[i].str.length);
		}
		const lead = str.length - str.trimStart().length;
		const start = index + lead;
		const end = index + str.trimEnd().length;
		const text = body.slice(start, end);
		if (text) out.push({ text, start, end });
	}
	return out;
}

function classifyKind(text: string): ClaimKind {
	if (/\[\d+\]/.test(text)) return 'citation_ref';
	if (MODAL_OBLIGATION.test(text)) return 'obligation';
	if (text.trim().length < 40) return 'boilerplate';
	return 'assertion';
}

/** A deterministic baseline analysis per claim (the seeded fallback the run reveals). */
function baselineAnalysis(
	input: DeriveClaimsInput,
	claimText: string,
	markers: number[],
	idx: number
): DerivedClaimAnalysis {
	const jitter = (((idx * 37) % 11) - 5) / 100;
	const base = Math.max(0.2, Math.min(0.97, (input.confidence ?? 0.7) + jitter));
	const docRisks = input.riskSignals ?? [];
	const allMarkers = (input.citations ?? []).map((c) => c.marker ?? 0);
	const maxMarker = allMarkers.length ? Math.max(...allMarkers) : 0;
	const badRisk = docRisks.find(
		(r) => (r.category === 'hallucination' || r.category === 'missing_authority') && r.severity === 'high'
	);

	if (markers.length && badRisk && markers.includes(maxMarker)) {
		return {
			verdict: 'unsupported',
			confidence: 0.33,
			summary: 'The cited authority could not be verified against EU law — likely fabricated.',
			riskCategory: badRisk.category,
			riskSeverity: 'high',
			riskRationale: badRisk.rationale
		};
	}
	if (markers.length) {
		const medRisk = docRisks.find((r) => r.severity === 'med' || r.severity === 'high');
		return {
			verdict: 'supported',
			confidence: base,
			summary: 'Grounded in the cited EU authority.',
			riskCategory: medRisk ? medRisk.category : null,
			riskSeverity: medRisk ? medRisk.severity : null,
			riskRationale: medRisk ? medRisk.rationale : ''
		};
	}
	const obligation = MODAL_OBLIGATION.test(claimText);
	return {
		verdict: obligation ? 'weak' : 'supported',
		confidence: obligation ? Math.max(0.4, base - 0.1) : Math.min(0.95, base + 0.04),
		summary: obligation
			? 'States an obligation without a direct citation.'
			: 'Background statement; no authority required.',
		riskCategory: obligation ? 'missing_authority' : null,
		riskSeverity: obligation ? 'low' : null,
		riskRationale: obligation ? 'Obligation asserted without an inline authority on this sentence.' : ''
	};
}

/**
 * Split a work product's body into atomic claims with a seeded baseline analysis.
 * Returns [] for an empty body (a document with no prose has nothing to verify).
 */
export function deriveClaims(input: DeriveClaimsInput): DerivedClaim[] {
	const body = input.body ?? '';
	return splitSentences(body).map((s, idx) => {
		const markers = [...s.text.matchAll(/\[(\d+)\]/g)].map((mm) => Number(mm[1]));
		const kind = classifyKind(s.text);
		return {
			idx,
			text: s.text,
			charStart: s.start,
			charEnd: s.end,
			kind,
			assignedPreset: autoPreset({ text: s.text, kind }) as AssignedPreset,
			citationMarkers: markers,
			analysis: baselineAnalysis(input, s.text, markers, idx)
		};
	});
}

/** A typed reasoning-graph edge between two derived claims (by idx). `from` RESTS ON `to`. */
export interface DerivedEdge {
	fromIdx: number;
	toIdx: number;
	relation: ClaimRelation;
	rationale: string;
	/** True for the ordering family (premise/definition/elaboration) that propagates risk. */
	ordering: boolean;
}

/** The ordering (risk-propagating) relations — mirrors ORDERING_RELATIONS in claim-graph.ts. */
const ORDERING_RELATIONS = new Set<ClaimRelation>(['premise', 'definition', 'elaboration']);

/** A claim that GROUNDS others: it invokes a cited authority (an inline `[n]` marker). */
function isFoundation(c: DerivedClaim): boolean {
	return c.kind === 'citation_ref' || c.citationMarkers.length > 0;
}

/**
 * Derive the reasoning-graph edges for a live-ingested work product — the deterministic
 * runtime stand-in for the offline ADK `claim_grapher` (which produces the authored
 * `edges` the seed loads, see scripts/load-seed.mjs). Live ingestion has no LLM grapher,
 * so the structure is inferred from claim kinds + citation anchoring.
 *
 * The graph hangs off a set of FOUNDATION claims, chosen in tiers so a real ingested
 * document gets a dependency backbone even when it carries no inline `[n]` citation
 * markers (most contracts, letters and memos don't — only the ADK-authored seed bodies
 * reliably do):
 *
 *   1. `citation`: claims that invoke a cited authority (an inline `[n]` marker), if any;
 *   2. `framing`:  otherwise the substantive *assertions* — the document's framing and
 *                  definitional statements — which obligations and other prose rest on;
 *   3. `sequence`: otherwise every non-boilerplate claim, giving at least a linear
 *                  reading-order backbone.
 *
 * Then, in every tier:
 *   - Each non-boilerplate claim that is NOT itself a foundation rests (`premise`) on the
 *     nearest foundation — "this prose stands on that anchor".
 *   - Each foundation after the first builds (`elaboration`) on the previous foundation,
 *     giving the argument a backbone so risk propagates transitively.
 *
 * Every edge points to an earlier-or-foundation claim, so the graph is a DAG. Without the
 * tiered fallback a citation-less document would have nodes but no edges: a flat row of
 * isolated claims with no risk propagation (the undermined-by-a-premise signal in
 * claim-graph.ts) — and the workspace graph would render "No dependencies mapped".
 */
export function deriveEdges(claims: DerivedClaim[]): DerivedEdge[] {
	const cited = claims.filter(isFoundation).map((c) => c.idx);
	const assertions = claims.filter((c) => c.kind === 'assertion').map((c) => c.idx);
	const substantive = claims.filter((c) => c.kind !== 'boilerplate').map((c) => c.idx);
	const mode: 'citation' | 'framing' | 'sequence' = cited.length
		? 'citation'
		: assertions.length
			? 'framing'
			: 'sequence';
	const foundations = mode === 'citation' ? cited : mode === 'framing' ? assertions : substantive;
	if (!foundations.length) return [];
	const foundationSet = new Set(foundations);

	// Nearest foundation to a claim, preferring the closest PRECEDING one on a tie.
	function nearestFoundation(idx: number): number | null {
		let best: number | null = null;
		let bestDist = Infinity;
		for (const f of foundations) {
			if (f === idx) continue;
			const dist = idx - f >= 0 ? idx - f : f - idx + 0.5;
			if (dist < bestDist) {
				bestDist = dist;
				best = f;
			}
		}
		return best;
	}

	// Closest foundation strictly before `idx` (foundations is ascending).
	function prevFoundation(idx: number): number | null {
		let prev: number | null = null;
		for (const f of foundations) {
			if (f < idx) prev = f;
			else break;
		}
		return prev;
	}

	// Rationale wording follows the anchoring mode — an authority for `citation`, the
	// document's own framing otherwise — so the tooltip never claims a citation that the
	// fallback tiers didn't actually find.
	const elaborationRationale = (to: number) =>
		mode === 'citation'
			? `Develops the argument from the authority cited in claim ${to + 1}.`
			: mode === 'framing'
				? `Develops the framing established in claim ${to + 1}.`
				: `Follows in the document's reasoning from claim ${to + 1}.`;
	const premiseRationale = (to: number) =>
		mode === 'citation'
			? `Rests on the authority cited in claim ${to + 1}.`
			: `Rests on the framing established in claim ${to + 1}.`;

	const edges: DerivedEdge[] = [];
	for (const c of claims) {
		if (c.kind === 'boilerplate') continue;
		if (foundationSet.has(c.idx)) {
			const prev = prevFoundation(c.idx);
			if (prev != null) {
				edges.push({
					fromIdx: c.idx,
					toIdx: prev,
					relation: 'elaboration',
					rationale: elaborationRationale(prev),
					ordering: ORDERING_RELATIONS.has('elaboration')
				});
			}
		} else {
			const f = nearestFoundation(c.idx);
			if (f != null) {
				edges.push({
					fromIdx: c.idx,
					toIdx: f,
					relation: 'premise',
					rationale: premiseRationale(f),
					ordering: ORDERING_RELATIONS.has('premise')
				});
			}
		}
	}
	return edges;
}
