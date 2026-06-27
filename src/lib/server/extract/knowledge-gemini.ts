/**
 * Optional live firm-knowledge intake via Gemini — the runtime analogue of the
 * offline pipeline. Enabled only when GEMINI_API_KEY / GOOGLE_API_KEY is present;
 * otherwise the rules engine (./knowledge.ts) runs.
 *
 * The LLM lifts the metadata quality (a sharper title, a tighter summary, better
 * category placement, phrase tags). It grounds nothing external — a firm-knowledge
 * document is internal reference material — so unlike the work-product Gemini path
 * there is no CELEX detector here. Any failure throws so the orchestrator falls back.
 */

import type { ExtractedKnowledge } from '$lib/types';
import { extractKnowledgeHeuristic, type KnowledgeExtractOptions } from './knowledge';

const MODEL = 'gemini-2.5-flash';
const ENDPOINT = (model: string, key: string) =>
	`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
const TIMEOUT_MS = 25_000;

const CATEGORIES = ['memo', 'precedent', 'playbook', 'guidance'];

const PREAMBLE =
	'You are part of Itaily, a legal-AI supervision system working ONLY with European Union law. ' +
	"You are filing a document into the firm's PRIVATE, confidential knowledge base — internal memos, " +
	'precedents, playbook clauses, and guidance that future analyses draw on. A human supervisor reviews ' +
	'everything before it is saved, so be accurate and never invent content.';

interface GeminiKnowledge {
	title?: string;
	category?: string;
	summary?: string;
	tags?: unknown;
	body?: string;
}

function prompt(text: string): string {
	return (
		`${PREAMBLE}\n\n` +
		'TASK: An operator is adding the document below to the firm knowledge base. Classify and summarise ' +
		'it for the library. Do NOT change the substance — keep the body faithful to the source.\n\n' +
		'Return ONLY a JSON object with keys: ' +
		'{"title":str,"category":"memo|precedent|playbook|guidance (memo = internal analysis; precedent = a ' +
		'prior position/authority/template; playbook = a reusable clause or standing negotiation position; ' +
		'guidance = a standing house rule)","summary":str (one line),"tags":[str] (3-8 short topical ' +
		'keywords/phrases),"body":str (the cleaned document text)}.\n\n' +
		'--- DOCUMENT ---\n' +
		text.slice(0, 24_000)
	);
}

/** Pull the first JSON object out of a model reply (handles ```json fences). */
function parseJson(reply: string): GeminiKnowledge {
	const fenced = reply.match(/```(?:json)?\s*([\s\S]*?)```/i);
	const raw = fenced ? fenced[1] : reply;
	const start = raw.indexOf('{');
	const end = raw.lastIndexOf('}');
	if (start === -1 || end === -1) throw new Error('Gemini returned no JSON object.');
	return JSON.parse(raw.slice(start, end + 1)) as GeminiKnowledge;
}

function cleanTags(input: unknown): string[] {
	if (!Array.isArray(input)) return [];
	return input
		.map((t) => String(t ?? '').trim())
		.filter((t) => t.length > 0)
		.slice(0, 8);
}

/**
 * Call Gemini and assemble a knowledge draft, falling back field-by-field to the
 * deterministic engine. Throws on any error so the orchestrator degrades to rules.
 */
export async function extractKnowledgeGemini(
	rawText: string,
	apiKey: string,
	opts: KnowledgeExtractOptions
): Promise<ExtractedKnowledge> {
	const res = await fetch(ENDPOINT(MODEL, apiKey), {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({
			contents: [{ role: 'user', parts: [{ text: prompt(rawText) }] }],
			generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
		}),
		signal: AbortSignal.timeout(TIMEOUT_MS)
	});
	if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
	const data = (await res.json()) as {
		candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
	};
	const reply = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
	if (!reply.trim()) throw new Error('Gemini returned an empty reply.');

	const a = parseJson(reply);

	// The rules engine over the model's body (or the source) gives us a guaranteed
	// baseline for every field, so partial model output never yields an empty draft.
	const groundOn = String(a.body ?? '').trim() || rawText;
	const base = extractKnowledgeHeuristic(groundOn, opts);

	const category = CATEGORIES.includes(String(a.category)) ? (a.category as ExtractedKnowledge['category']) : base.category;
	const tags = cleanTags(a.tags);

	return {
		...base,
		title: (a.title ?? '').trim() || base.title,
		category,
		summary: (a.summary ?? '').trim() || base.summary,
		tags: tags.length ? tags : base.tags,
		model: opts.promotedFrom ? `promoted · ${MODEL} (live)` : `${MODEL} (live)`,
		meta: { ...base.meta, method: 'gemini' }
	};
}
