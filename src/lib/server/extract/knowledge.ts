/**
 * Document → firm-knowledge extractor.
 *
 * The intake engine for the firm's PRIVATE corpus: it turns a raw document (an
 * uploaded file, pasted text, or the body of a promoted work product) into a
 * review-ready knowledge draft — title, category, topical tags, a one-line summary,
 * and a cleaned body. The operator reviews/edits before it is saved.
 *
 * Mirrors the work-product intake orchestrator (./index.ts): the deterministic
 * rules engine is ALWAYS available (no key, no network), and an optional Gemini
 * path lifts the metadata quality when a key is configured, falling back here on
 * any failure. Unlike the work-product path there are no citations/risks/trace — a
 * knowledge document is reference material, not a queue item.
 */

import type { ExtractedKnowledge } from '$lib/types';
import { STOP, terms } from '$lib/server/knowledge';
import { normalize, pickSummary, pickTitle, prettifyFilename } from './heuristic';

/** Keep in step with the intake endpoint's MAX_CHARS — a sane storage bound only
 *  (knowledge has no inline-marker invariant, so this is not load-bearing). */
const BODY_CAP = 60_000;

type SourceKind = 'text' | 'pdf' | 'docx' | 'work_product';
type Category = ExtractedKnowledge['category'];

export interface KnowledgeExtractOptions {
	sourceKind: SourceKind;
	filename?: string;
	/** Gemini key from the Worker env; when absent, the rules engine runs. */
	apiKey?: string;
	/** Set when promoting an existing work product into the shared corpus. */
	promotedFrom?: { workProductId: string; matterRef: string; title: string };
}

// Keyword cues per category, scored over the lowercased text. Most-specific wins on
// a tie (playbook > precedent > guidance > memo); memo is the fallback bucket.
const CATEGORY_CUES: Record<Exclude<Category, 'memo'>, RegExp[]> = {
	playbook: [
		/\bplaybook\b/, /\bstanding position\b/, /\bfirm'?s? position\b/, /\bdefault (?:fallback|position)\b/,
		/\bstandard approach\b/, /\bchecklist\b/, /\bescalate to\b/, /\bfallback\b/, /\bnegotiat\w+ position\b/,
		/\bstep \d\b/
	],
	precedent: [
		/\bprecedent\b/, /\btemplate\b/, /\bmodel clause\b/, /\bwhereas\b/, /\bthe parties\b/,
		/\bthis agreement\b/, /\bexecution version\b/, /\bannex\b/, /\bschedule\b/, /\bsample clause\b/
	],
	guidance: [
		/\bguidance\b/, /\bbest practice\b/, /\brecommend\w*\b/, /\badvisory\b/, /\bhouse rule\b/,
		/\bhow to\b/, /\bwhen handling\b/, /\bshould (?:always|never|ensure)\b/, /\bguidelines?\b/
	]
};

/** Deterministic category classifier — mirrors classifyType in ./heuristic.ts. */
export function classifyKnowledgeCategory(text: string, filename?: string): Category {
	const t = text.toLowerCase();
	const score: Record<Category, number> = { playbook: 0, precedent: 0, guidance: 0, memo: 0 };
	for (const [cat, cues] of Object.entries(CATEGORY_CUES) as [Exclude<Category, 'memo'>, RegExp[]][]) {
		for (const re of cues) if (re.test(t)) score[cat] += 1;
	}
	// A category word in the filename is a strong hint.
	if (filename) {
		const fn = prettifyFilename(filename).toLowerCase();
		for (const cat of ['playbook', 'precedent', 'guidance', 'memo'] as Category[]) {
			if (fn.includes(cat)) score[cat] += 2;
		}
	}
	// Pick the best; tie-break by specificity order. Default memo when nothing dominates.
	const order: Category[] = ['playbook', 'precedent', 'guidance', 'memo'];
	let best: Category = 'memo';
	let bestScore = 0;
	for (const cat of order) {
		if (score[cat] > bestScore) {
			best = cat;
			bestScore = score[cat];
		}
	}
	return best;
}

/**
 * Derive up to `k` single-word topical tags by frequency, using the SAME tokenizer
 * and stop-words the retriever scores with (so every derived tag is a term that can
 * actually match). Title words are weighted ×3 — symmetry with searchFirmKnowledge's
 * title×3 boost. Multi-word phrase tags (as some seed docs use) are left for the
 * operator or the Gemini path to add.
 */
export function deriveTags(text: string, title: string, k = 7): string[] {
	const freq = new Map<string, number>();
	for (const w of text.toLowerCase().match(/[a-z]{3,}/g) ?? []) {
		if (STOP.has(w)) continue;
		freq.set(w, (freq.get(w) ?? 0) + 1);
	}
	const titleTerms = new Set(terms(title));
	for (const w of titleTerms) freq.set(w, (freq.get(w) ?? 0) + 3);
	return [...freq.entries()]
		.filter(([w]) => w.length >= 4 || titleTerms.has(w))
		.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
		.slice(0, k)
		.map(([w]) => w);
}

const SOURCE_LABEL: Record<SourceKind, string> = {
	pdf: 'PDF',
	docx: 'Word document',
	text: 'document',
	work_product: 'work product'
};

/** The deterministic, offline firm-knowledge extractor. Always available. */
export function extractKnowledgeHeuristic(
	rawText: string,
	opts: KnowledgeExtractOptions = { sourceKind: 'text' }
): ExtractedKnowledge {
	const text = normalize(rawText);
	// pickTitle/pickSummary take a citation list to synthesise from a leading
	// authority; the firm corpus is internal prose, so we pass none and they fall
	// through to filename → first heading / first paragraph.
	const title = pickTitle(text, opts.filename, []);
	const summary = pickSummary(text, []);
	const category = classifyKnowledgeCategory(text, opts.filename);
	const tags = deriveTags(text, title);

	const body = text.length > BODY_CAP ? text.slice(0, BODY_CAP).trimEnd() + ' …' : text;

	const warnings: string[] = [];
	if (tags.length < 2) warnings.push('Few topical tags could be derived — add tags before saving so the corpus stays searchable.');
	if (text.length > BODY_CAP) warnings.push(`Document is long (${text.length} chars); the body was trimmed to ${BODY_CAP} for review.`);
	if (category === 'memo' && opts.sourceKind !== 'work_product') warnings.push('Category defaulted to "Memo" — confirm it before saving.');

	const sourceRef = opts.promotedFrom
		? `KB/Promoted/${opts.promotedFrom.matterRef} — ${opts.promotedFrom.title}`.slice(0, 160)
		: '';

	return {
		title,
		category,
		tags,
		summary,
		body,
		sourceRef,
		model: opts.promotedFrom ? 'promoted from work product' : 'itaily-intake (rules)',
		meta: {
			method: 'rules',
			sourceKind: opts.sourceKind,
			chars: text.length,
			warnings,
			...(opts.promotedFrom ? { promotedFrom: opts.promotedFrom } : {})
		}
	};
}

/**
 * Turn raw document text into a review-ready firm-knowledge draft. Prefers the live
 * Gemini path when a key is configured and always falls back to the rules engine, so
 * intake works with zero configuration and no network (the demo's default).
 */
export async function extractFirmKnowledge(
	text: string,
	opts: KnowledgeExtractOptions
): Promise<ExtractedKnowledge> {
	if (opts.apiKey) {
		try {
			const { extractKnowledgeGemini } = await import('./knowledge-gemini');
			return await extractKnowledgeGemini(text, opts.apiKey, opts);
		} catch (err) {
			const draft = extractKnowledgeHeuristic(text, opts);
			draft.meta.warnings.push(
				`Live analysis unavailable (${(err as Error).message}); used the on-device rules engine.`
			);
			return draft;
		}
	}
	return extractKnowledgeHeuristic(text, opts);
}

export { SOURCE_LABEL as KNOWLEDGE_SOURCE_LABEL };
