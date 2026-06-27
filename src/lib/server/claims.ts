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
 * This MUST stay in step with `deriveClaims`/`splitSentences`/`classifyKind`/
 * `baselineAnalysis` in scripts/load-seed.mjs so seeded and live-ingested documents
 * split identically. Preset assignment reuses `autoPreset` from $lib/workgroups —
 * the single source of truth (itself mirrored in agents/itaily_agents/workgroups.py).
 */

import { autoPreset } from '$lib/workgroups';

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
