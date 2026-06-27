/**
 * Deterministic, offline document → work-product extractor.
 *
 * This is the ALWAYS-ON intake engine: no API key, no network, fully reproducible.
 * It reads an uploaded document and assembles a review-ready draft — title,
 * summary, a body with inline [n] markers, grounded citations, risk signals, a
 * synthetic agent trace, and confidence/priority scores — so the operator edits
 * instead of types. The optional Gemini path (./gemini.ts) returns the same shape
 * and falls back here on any failure.
 */

import type {
	ExtractedCitation,
	ExtractedDraft,
	ExtractedRisk,
	ExtractedTraceStep
} from '$lib/types';
import { detectCitations, suspiciousCelex, type DetectedCitation } from './celex';

const BODY_CAP = 6000;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Collapse the document to clean, single-spaced prose for analysis. */
function normalize(raw: string): string {
	return raw
		.replace(/\r\n?/g, '\n')
		// Drop any bracketed-number tokens the source already carries (foreign
		// footnote/clause markers). We re-number with OUR citations, so every [n]
		// in the final body maps 1:1 to a citation — no orphan or duplicate markers.
		.replace(/\[\d+\]/g, '')
		.replace(/[ \t]+/g, ' ')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

interface MarkerItem {
	marker: number;
	/** Character offset of the citation's trigger phrase in the (normalized) body. */
	index: number;
	len: number;
}

/**
 * Insert `[n]` immediately after each citation's trigger phrase, using the
 * word-aware offset the detector already computed (NOT a raw substring search —
 * that would land a marker mid-word, e.g. "DMA" inside "DMARC"). Inserts from the
 * last offset to the first so earlier offsets stay valid as the string grows.
 */
function injectMarkers(body: string, items: MarkerItem[]): string {
	let out = body;
	const ordered = items
		.filter((it) => it.index >= 0 && it.index + it.len <= body.length)
		.sort((a, b) => b.index - a.index);
	for (const it of ordered) {
		const end = it.index + it.len;
		if (out.slice(end, end + 6).includes(`[${it.marker}]`)) continue;
		out = out.slice(0, end) + ` [${it.marker}]` + out.slice(end);
	}
	return out;
}

function prettifyFilename(name: string): string {
	return name
		.replace(/\.[a-z0-9]+$/i, '')
		.replace(/[_\-]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		// Capitalise the first letter of each word ("project aurora" → "Project Aurora"),
		// leaving codes like "MAT-2026-0142" untouched.
		.replace(/\b([a-z])/g, (_, c: string) => c.toUpperCase());
}

/** A generic-looking filename ("document", "scan 1") shouldn't become the title. */
function genericName(name: string): boolean {
	return /^(document|untitled|scan|file|download|new doc|copy)\b/i.test(name) || name.length < 4;
}

/** Drop an email/memo header prefix ("Re:", "Subject -", …) from a line. */
function stripHeadingPrefix(s: string): string {
	return s.replace(/^(re|subject|matter|project|fwd?|memo)\s*[:\-–]\s*/i, '').trim();
}

function pickTitle(text: string, filename: string | undefined, cits: DetectedCitation[]): string {
	if (filename) {
		const pretty = prettifyFilename(filename);
		if (!genericName(pretty)) return pretty.slice(0, 140);
	}
	// A short, heading-like first line (with any "Re:"/"Subject:" prefix removed).
	const firstLine = stripHeadingPrefix(
		text.split('\n').map((l) => l.trim()).find((l) => l.length > 0) ?? ''
	);
	if (firstLine && firstLine.length <= 120 && !/[.?!]$/.test(firstLine) && firstLine.split(' ').length <= 16) {
		return firstLine;
	}
	// Synthesised from the leading authority.
	if (cits.length) {
		const short = cits[0].title.replace(/\s*\([^()]*\)\s*$/, '').trim();
		return `${short} — intake analysis`.slice(0, 140);
	}
	return firstLine ? firstLine.slice(0, 140) : 'Document intake — review required';
}

const HEADING_LINE = /^(re|subject|matter|project|fwd?|memo)\s*[:\-–]/i;

function pickSummary(text: string, cits: DetectedCitation[]): string {
	// Work block-by-block (not sentence-split — that mis-fires on "Inc.", "Art.",
	// "No." in legal prose). Take the first real paragraph and trim it to a clean
	// one-liner at a sentence boundary.
	const blocks = text
		.split(/\n+/)
		.map((b) => b.trim())
		.filter((b) => b.length >= 40 && !HEADING_LINE.test(b));
	const first = blocks[0];
	if (first) {
		if (first.length <= 240) return first;
		const cut = first.slice(0, 240);
		const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '));
		return stop > 80 ? cut.slice(0, stop + 1).trim() : cut.trimEnd() + '…';
	}
	if (cits.length) {
		const lead = cits[0].title.replace(/\s*\([^()]*\)\s*$/, '').trim();
		const rest = cits.length - 1;
		const tail = rest > 0 ? ` and ${rest} further EU ${rest === 1 ? 'authority' : 'authorities'}` : '';
		return `Reviews the document against ${lead}${tail}.`;
	}
	return text.slice(0, 200).replace(/\s+/g, ' ').trim();
}

function classifyType(text: string): ExtractedDraft['type'] {
	const t = text.toLowerCase();
	const riskHits = (t.match(/\b(risk|exposure|liabilit|penalt|fine|sanction|non[- ]?complian|breach)\b/g) ?? []).length;
	const draftHits = (t.match(/\b(hereby|the parties|shall mean|this agreement|whereas|clause|enters into force|undertakes to)\b/g) ?? []).length;
	if (draftHits >= 2 && draftHits >= riskHits) return 'draft';
	if (riskHits >= 3) return 'risk_analysis';
	return 'memo';
}

/** A short, deduped human label for the act kind, for risk rationales. */
function kindLabel(celex: string): 'Regulation' | 'Directive' | 'Decision' {
	const l = celex[5];
	return l === 'L' ? 'Directive' : l === 'D' ? 'Decision' : 'Regulation';
}

function detectRisks(text: string, cits: DetectedCitation[]): ExtractedRisk[] {
	const risks: ExtractedRisk[] = [];
	const lower = text.toLowerCase();

	if (cits.length === 0) {
		risks.push({
			category: 'missing_authority',
			severity: 'high',
			rationale:
				'No EU legal authority was detected in the document. Every legal proposition should be grounded in a CELEX-identified instrument before sign-off.',
			confidence: 0.85
		});
	}

	for (const c of cits) {
		if (suspiciousCelex(c.celex)) {
			risks.push({
				category: 'hallucination',
				severity: 'high',
				rationale: `The cited authority ${c.celex} does not look like a valid CELEX — verify it resolves in CELLAR before relying on it.`,
				confidence: 0.8
			});
		}
	}

	// Time-sensitive obligations.
	const deadline = text.match(
		/\b(within\s+\d+\s+(?:days|months|weeks|years)|no later than[^.]{0,40}|by\s+\d{1,2}\s+\w+\s+\d{4}|deadline|time limit|expir\w+)\b/i
	);
	if (deadline) {
		risks.push({
			category: 'deadline',
			severity: 'med',
			rationale: `Time-sensitive obligation detected ("${deadline[0].trim()}"). Confirm the deadline, trigger and responsible party.`,
			confidence: 0.7
		});
	}

	// Directives need national transposition.
	const directive = cits.find((c) => kindLabel(c.celex) === 'Directive');
	if (directive) {
		risks.push({
			category: 'jurisdiction',
			severity: 'low',
			rationale: `Relies on a Directive (${directive.title}), which requires national transposition — confirm the implementing measure in the relevant Member State.`,
			confidence: 0.6
		});
	}

	// Competing provisions / internal tension.
	if (/\b(notwithstanding|however,|conflict|inconsistent|contradict|tension between|on the other hand)\b/i.test(lower)) {
		risks.push({
			category: 'conflict',
			severity: 'low',
			rationale:
				'Language suggesting competing or qualifying provisions was detected. Verify there is no conflict between the cited authorities.',
			confidence: 0.5
		});
	}

	return risks;
}

function scoreConfidence(cits: DetectedCitation[], risks: ExtractedRisk[]): number {
	let c = 0.55 + Math.min(cits.length, 3) * 0.08;
	if (cits.length === 0) c -= 0.2;
	for (const r of risks) c -= r.severity === 'high' ? 0.12 : r.severity === 'med' ? 0.05 : 0.02;
	return Number(clamp(c, 0.3, 0.95).toFixed(2));
}

function scorePriority(
	type: ExtractedDraft['type'],
	risks: ExtractedRisk[],
	confidence: number
): number {
	let p = 45;
	const high = risks.filter((r) => r.severity === 'high').length;
	const med = risks.filter((r) => r.severity === 'med').length;
	if (high) p += 20 + (high - 1) * 8;
	p += med * 6;
	if (type === 'risk_analysis') p += 8;
	if (risks.some((r) => r.category === 'deadline')) p += 8;
	p += Math.round((1 - confidence) * 18); // lower confidence ⇒ needs a human sooner
	return clamp(Math.round(p), 20, 96);
}

/** "MAT-2026-0142" style matter reference, if present. */
function detectMatterRef(text: string): string {
	const m = text.match(/\b(MAT[- ]?\d{4}[- ]?\d{3,4})\b/i) ?? text.match(/\bmatter\s*(?:ref|no\.?|number)?\s*[:#]?\s*([A-Z0-9\-\/]{4,})/i);
	return m ? m[1].toUpperCase().replace(/\s/g, '-') : '';
}

function detectMatterName(text: string, filename: string | undefined): string {
	const re = text.match(/\b(?:Re|Matter|Project|Subject)\s*[:\-]\s*(.{4,80})/i);
	if (re) return re[1].split('\n')[0].trim();
	if (filename) {
		const p = prettifyFilename(filename);
		if (!genericName(p)) return p;
	}
	return '';
}

/**
 * Run the deterministic extractor over already-cleaned document text.
 * `sourceKind` / `filename` only steer titling and the trace narrative.
 */
const SOURCE_LABEL: Record<'text' | 'pdf' | 'docx', string> = {
	pdf: 'PDF',
	docx: 'Word document',
	text: 'document'
};

export function extractHeuristic(
	rawText: string,
	opts: { sourceKind: 'text' | 'pdf' | 'docx'; filename?: string } = { sourceKind: 'text' }
): ExtractedDraft {
	const text = normalize(rawText);
	const detected = detectCitations(text);

	const citations: ExtractedCitation[] = detected.map((d, i) => ({
		marker: i + 1,
		claim: d.snippet.slice(0, 200),
		celex: d.celex,
		eli: d.eli,
		title: d.title,
		sourceUrl: d.sourceUrl,
		snippet: d.snippet,
		locator: d.locator,
		supportsClaim: true
	}));

	const type = classifyType(text);
	const risks = detectRisks(text, detected);
	const confidence = scoreConfidence(detected, risks);
	const priority = scorePriority(type, risks, confidence);

	const cappedBody = text.length > BODY_CAP ? text.slice(0, BODY_CAP).trimEnd() + ' …' : text;
	// Place [n] markers at the detector's word-aware offsets (same normalized text).
	const body = injectMarkers(
		cappedBody,
		detected.map((d, i) => ({ marker: i + 1, index: d.index, len: d.matchText.length }))
	);

	const warnings: string[] = [];
	if (detected.length === 0) warnings.push('No EU legal authority was detected — add at least one CELEX before submitting.');
	if (text.length > BODY_CAP) warnings.push(`Document is long (${text.length} chars); the body was trimmed to ${BODY_CAP} for review.`);

	const high = risks.filter((r) => r.severity === 'high').length;
	const med = risks.filter((r) => r.severity === 'med').length;

	const trace: ExtractedTraceStep[] = [
		{
			step: 1,
			kind: 'search',
			actorAgent: 'intake',
			summary: `Parsed the ${SOURCE_LABEL[opts.sourceKind]} (${text.length.toLocaleString('en-GB')} characters) and scanned for EU legal authorities.`,
			detail: { chars: text.length, sourceKind: opts.sourceKind }
		},
		{
			step: 2,
			kind: 'retrieve',
			actorAgent: 'intake',
			summary: detected.length
				? `Identified ${detected.length} candidate ${detected.length === 1 ? 'authority' : 'authorities'} and derived their CELEX ids.`
				: 'No citeable EU authority was found in the text.',
			detail: { celex: detected.map((d) => d.celex) }
		},
		{
			step: 3,
			kind: 'reason',
			actorAgent: 'intake',
			summary: `Classified the work product as a ${type.replace('_', ' ')} and assessed ${risks.length} risk ${risks.length === 1 ? 'signal' : 'signals'}.`,
			detail: { type, confidence }
		},
		{
			step: 4,
			kind: 'draft',
			actorAgent: 'intake',
			summary: `Assembled the draft with ${citations.length} grounding ${citations.length === 1 ? 'citation' : 'citations'} and inline [n] markers.`,
			detail: null
		}
	];
	if (risks.length) {
		trace.push({
			step: 5,
			kind: 'critique',
			actorAgent: 'intake',
			summary: `Flagged ${high} high / ${med} medium risk ${high + med === 1 ? 'signal' : 'signals'} for supervisor review.`,
			detail: { high, med, low: risks.length - high - med }
		});
	}

	return {
		type,
		title: pickTitle(text, opts.filename, detected),
		summary: pickSummary(text, detected),
		body,
		matterName: detectMatterName(text, opts.filename),
		matterRef: detectMatterRef(text),
		agentName: 'Itaily Intake Agent',
		priority,
		confidence,
		model: 'itaily-intake (rules)',
		citations,
		riskSignals: risks,
		trace,
		meta: { method: 'rules', sourceKind: opts.sourceKind, chars: text.length, warnings }
	};
}
