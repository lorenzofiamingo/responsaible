// Firm knowledge-base retrieval — server only, fully on-perimeter.
//
// PRIVACY BY DESIGN: this does NO external call. The firm's confidential corpus is
// scored with a small lexical ranker (term overlap weighted by field) right here in
// the Worker, and the Knowledge researcher figure reasons over the result with an
// open, self-hostable model. Confidential text never reaches a third-party API.

import { firmKnowledge } from './db/schema';
import type { DB } from './db/client';

export interface KnowledgeHit {
	title: string;
	/** Internal reference (no public URL — the document is private). */
	ref: string;
	snippet: string;
	score: number;
}

const STOP = new Set([
	'the', 'and', 'for', 'with', 'that', 'this', 'from', 'are', 'was', 'has', 'have',
	'not', 'but', 'any', 'all', 'its', 'a', 'an', 'of', 'to', 'in', 'on', 'or', 'is',
	'as', 'by', 'be', 'it', 'shall', 'must', 'may', 'under', 'where'
]);

/** Lowercase content words of length ≥ 3, de-duplicated. */
function terms(text: string): string[] {
	const out = new Set<string>();
	for (const w of (text.toLowerCase().match(/[a-z]{3,}/g) ?? [])) {
		if (!STOP.has(w)) out.add(w);
	}
	return [...out];
}

/** Count whole-word occurrences of `term` in `haystack` (already lowercased). */
function count(haystack: string, term: string): number {
	let n = 0;
	let i = haystack.indexOf(term);
	while (i !== -1) {
		n++;
		i = haystack.indexOf(term, i + term.length);
	}
	return n;
}

/** The first sentence mentioning any query term, else the opening of the body. */
function snippetFor(body: string, qterms: string[]): string {
	const sentences = body.split(/(?<=[.!?])\s+/);
	const lc = (s: string) => s.toLowerCase();
	const hit = sentences.find((s) => qterms.some((t) => lc(s).includes(t)));
	const chosen = (hit ?? body).trim();
	return chosen.length > 240 ? chosen.slice(0, 237).trimEnd() + '…' : chosen;
}

/**
 * Rank the private firm corpus against a claim, lexically. Returns the top-k
 * documents (score > 0). Title matches weigh most, then tags, then body.
 */
export async function searchFirmKnowledge(db: DB, query: string, k = 3): Promise<KnowledgeHit[]> {
	const qterms = terms(query);
	if (!qterms.length) return [];

	const rows = await db.select().from(firmKnowledge).all();
	const scored: KnowledgeHit[] = [];
	for (const r of rows) {
		const title = r.title.toLowerCase();
		const tags = r.tags.toLowerCase();
		const body = r.body.toLowerCase();
		let score = 0;
		for (const t of qterms) {
			score += count(title, t) * 3 + count(tags, t) * 2 + Math.min(count(body, t), 4);
		}
		if (score > 0) {
			scored.push({
				title: r.title,
				ref: r.sourceRef || r.id,
				snippet: snippetFor(r.body, qterms),
				score
			});
		}
	}
	scored.sort((a, b) => b.score - a.score);
	return scored.slice(0, k);
}
