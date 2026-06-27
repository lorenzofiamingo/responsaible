/**
 * Optional live intake path via Gemini — the runtime analogue of the offline ADK
 * pipeline (agents/itaily_agents). Enabled only when GEMINI_API_KEY / GOOGLE_API_KEY
 * is present in the Worker env; otherwise the rules engine runs.
 *
 * Design choice: this is a SUPERVISION console, so the uploaded document is the
 * evidence the lawyer signs off on — the LLM must NOT rewrite or summarise it. The
 * model only lifts the *metadata* around it (title, summary, type, matter, sharper
 * risk rationales); the BODY stays the operator's original text, and CITATIONS are
 * grounded by the deterministic detector over that original — so the model can't
 * invent an authority (or silently reword the document) the supervisor never saw.
 * Any failure throws so the caller falls back to the rules engine.
 */

import type { ExtractedDraft, ExtractedRisk, ExtractedTraceStep } from '$lib/types';
import { extractHeuristic } from './heuristic';

const MODEL = 'gemini-2.5-flash';
const ENDPOINT = (model: string, key: string) =>
	`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
const TIMEOUT_MS = 25_000;

const PREAMBLE =
	'You are part of Itaily, a legal-AI supervision system working ONLY with European Union law ' +
	'(Regulations, Directives, Decisions, CJEU case law). A human supervisor reviews everything you ' +
	'produce, so be transparent and never invent an authority.';

const CATEGORIES = ['hallucination', 'jurisdiction', 'missing_authority', 'conflict', 'deadline'];
const SEVERITIES = ['low', 'med', 'high'];
const TYPES = ['draft', 'memo', 'opinion', 'risk_analysis'];

interface GeminiAnalysis {
	type?: string;
	title?: string;
	summary?: string;
	matterName?: string;
	matterRef?: string;
	riskSignals?: Array<{ category?: string; severity?: string; rationale?: string; confidence?: number }>;
}

function prompt(text: string): string {
	return (
		`${PREAMBLE}\n\n` +
		'TASK: A legal operator uploaded the document below for supervision review. Do NOT rewrite, ' +
		'summarise, condense or re-order the document — its original text is kept verbatim as the ' +
		'work-product body and inline [n] citation markers are added separately by a deterministic ' +
		'detector. Your job is ONLY to describe and triage it: classify it, title it, write a one-line ' +
		'summary, identify the matter, and flag risks. Never invent an authority the document does not ' +
		'mention.\n\n' +
		'Return ONLY a JSON object with keys: ' +
		'{"type":"draft|memo|opinion|risk_analysis (opinion = an external, reliance-bearing legal opinion ' +
		'addressed to a client or third party; memo = internal analysis not relied upon)","title":str,' +
		'"summary":str (one line),"matterName":str,"matterRef":str,' +
		'"riskSignals":[{"category":"hallucination|jurisdiction|' +
		'missing_authority|conflict|deadline","severity":"low|med|high","rationale":str,"confidence":0-1}]}.\n\n' +
		'--- DOCUMENT ---\n' +
		text.slice(0, 24_000)
	);
}

/** Pull the first JSON object out of a model reply (handles ```json fences). */
function parseJson(reply: string): GeminiAnalysis {
	const fenced = reply.match(/```(?:json)?\s*([\s\S]*?)```/i);
	const raw = fenced ? fenced[1] : reply;
	const start = raw.indexOf('{');
	const end = raw.lastIndexOf('}');
	if (start === -1 || end === -1) throw new Error('Gemini returned no JSON object.');
	return JSON.parse(raw.slice(start, end + 1)) as GeminiAnalysis;
}

function cleanRisks(input: GeminiAnalysis['riskSignals']): ExtractedRisk[] {
	if (!Array.isArray(input)) return [];
	return input
		.filter((r) => r && CATEGORIES.includes(String(r.category)) && SEVERITIES.includes(String(r.severity)) && String(r.rationale ?? '').trim())
		.map((r) => ({
			category: r!.category as ExtractedRisk['category'],
			severity: r!.severity as ExtractedRisk['severity'],
			rationale: String(r!.rationale).trim(),
			confidence: typeof r!.confidence === 'number' ? Math.min(1, Math.max(0, r!.confidence)) : 0.7
		}));
}

/** Merge LLM risks with rules-derived risks, de-duped by category. */
function mergeRisks(base: ExtractedRisk[], extra: ExtractedRisk[]): ExtractedRisk[] {
	const seen = new Set(base.map((r) => r.category));
	return [...base, ...extra.filter((r) => !seen.has(r.category))];
}

/**
 * Call Gemini and assemble a draft. Throws on any error (missing reply, bad JSON,
 * network/timeout) so the orchestrator can fall back to the rules engine.
 */
export async function extractGemini(
	rawText: string,
	apiKey: string,
	opts: { sourceKind: 'text' | 'pdf' | 'docx'; filename?: string }
): Promise<ExtractedDraft> {
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

	// The body is the operator's ORIGINAL document, never the model's prose: run the
	// deterministic engine over the source text so the stored/displayed body stays
	// faithful and every inline [n] marker lands on the real wording the lawyer signs.
	const base = extractHeuristic(rawText, opts);

	const type = TYPES.includes(String(a.type)) ? (a.type as ExtractedDraft['type']) : base.type;
	const risks = mergeRisks(base.riskSignals, cleanRisks(a.riskSignals));

	const detail = base.trace[1]?.detail as { celex?: string[] } | null | undefined;
	const celex = detail?.celex ?? [];
	const high = risks.filter((r) => r.severity === 'high').length;
	const med = risks.filter((r) => r.severity === 'med').length;
	const trace: ExtractedTraceStep[] = [
		{
			step: 1,
			kind: 'retrieve',
			actorAgent: 'research',
			summary: `Gemini reviewed the ${opts.sourceKind === 'pdf' ? 'PDF' : opts.sourceKind === 'docx' ? 'Word document' : 'document'} and grounded ${celex.length} EU ${celex.length === 1 ? 'authority' : 'authorities'}.`,
			detail: { celex }
		},
		{
			step: 2,
			kind: 'reason',
			actorAgent: 'intake',
			summary: `Kept the uploaded ${type.replace('_', ' ')} verbatim as the body and anchored ${base.citations.length} inline [n] ${base.citations.length === 1 ? 'citation' : 'citations'}.`,
			detail: null
		},
		{
			step: 3,
			kind: 'critique',
			actorAgent: 'critic',
			summary: risks.length
				? `Raised ${high} high / ${med} medium risk ${high + med === 1 ? 'signal' : 'signals'} for supervisor review.`
				: 'No material risks flagged; citations should still be verified against CELLAR.',
			detail: { high, med }
		}
	];

	return {
		...base,
		type,
		title: (a.title ?? '').trim() || base.title,
		summary: (a.summary ?? '').trim() || base.summary,
		matterName: (a.matterName ?? '').trim() || base.matterName,
		matterRef: (a.matterRef ?? '').trim() || base.matterRef,
		agentName: 'Itaily Research Agent',
		model: `${MODEL} (live)`,
		riskSignals: risks,
		trace,
		meta: { ...base.meta, method: 'gemini' }
	};
}
