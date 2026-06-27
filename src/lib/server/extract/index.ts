/**
 * Document-intake orchestrator.
 *
 * One entry point — `extractWorkProduct` — that turns raw document text into a
 * review-ready draft. It prefers the live Gemini path when a key is configured
 * and always falls back to the deterministic rules engine, so intake works with
 * zero configuration and no network (the demo's default).
 */

import type { ExtractedDraft } from '$lib/types';
import { extractGemini } from './gemini';
import { extractHeuristic } from './heuristic';

export interface ExtractOptions {
	sourceKind: 'text' | 'pdf' | 'docx';
	filename?: string;
	/** Gemini key from the Worker env; when absent, the rules engine runs. */
	apiKey?: string;
}

export async function extractWorkProduct(
	text: string,
	opts: ExtractOptions
): Promise<ExtractedDraft> {
	const base = { sourceKind: opts.sourceKind, filename: opts.filename };
	if (opts.apiKey) {
		try {
			return await extractGemini(text, opts.apiKey, base);
		} catch (err) {
			// Live path failed — degrade to rules and note it for the operator.
			const draft = extractHeuristic(text, base);
			draft.meta.warnings.push(
				`Live analysis unavailable (${(err as Error).message}); used the on-device rules engine.`
			);
			return draft;
		}
	}
	return extractHeuristic(text, base);
}

export { extractHeuristic } from './heuristic';
