// Live per-claim analysis — server only (never imported client-side).
//
// Runs the chosen work group against one atomic claim:
//   1. The research figure GROUNDS the claim by resolving its cited CELEX(es)
//      against EU CELLAR (secret-free, KV-cached — reuses src/lib/server/cellar.ts).
//   2. The lead figure makes ONE structured LLM call to rate the claim
//      (verdict + confidence + risk + which citations actually support it),
//      routed by model id to Anthropic or Google using a key from platform.env.
//
// Throws on a missing key / fetch error / bad JSON so the caller can fall back to
// the claim's seeded baseline (keeping the demo fully offline-capable).

import type { Citation, FigureTrace } from '$lib/types';
import type { KVNamespace } from '@cloudflare/workers-types';
import { MODELS, type Effort, type Figure, type ModelId, type WorkGroup } from '$lib/workgroups';
import { resolveCelex } from './cellar';

const DOMAIN_PREAMBLE =
	'You are part of Itaily, a legal-AI supervision system working ONLY with European Union law ' +
	'(Regulations, Directives, Decisions, CJEU case law). Every legal proposition must be grounded ' +
	'in a real EU instrument identified by its CELEX number. Never invent an authority. A human ' +
	'supervisor reviews everything, so be transparent about uncertainty.';

// Work-group model ids → real provider model ids.
const API_MODEL: Record<ModelId, string> = {
	'gemini-2.5-flash': 'gemini-2.5-flash',
	'gemini-2.5-pro': 'gemini-2.5-pro',
	'claude-haiku': 'claude-haiku-4-5-20251001',
	'claude-sonnet': 'claude-sonnet-4-6',
	'claude-opus-4-8': 'claude-opus-4-8'
};

const EFFORT_PARAMS: Record<Effort, { maxTokens: number; temperature: number }> = {
	low: { maxTokens: 512, temperature: 0.2 },
	med: { maxTokens: 768, temperature: 0.3 },
	high: { maxTokens: 1024, temperature: 0.4 }
};

const TIER_RANK = { small: 1, medium: 2, large: 3 } as const;
const ROLE_RANK = { research: 1, drafter: 2, critic: 3 } as const;

export interface AnalyzeInput {
	claimText: string;
	docCitations: Citation[];
	group: WorkGroup;
	env: App.Platform['env'];
	kv?: KVNamespace;
}

export interface AnalyzeOutput {
	verdict: 'supported' | 'weak' | 'unsupported' | 'flag';
	confidence: number;
	summary: string;
	riskCategory: string | null;
	riskSeverity: string | null;
	riskRationale: string;
	citationMarkers: number[];
	figureTrace: FigureTrace[];
}

const VERDICTS = new Set(['supported', 'weak', 'unsupported', 'flag']);
const RISK_CATS = new Set(['hallucination', 'jurisdiction', 'missing_authority', 'conflict', 'deadline']);
const SEVERITIES = new Set(['low', 'med', 'high']);

/** The figure that makes the decisive LLM call: highest tier, ties to the critic. */
function leadFigure(figures: Figure[]): Figure {
	return [...figures].sort((a, b) => {
		const t = TIER_RANK[MODELS[b.model].tier] - TIER_RANK[MODELS[a.model].tier];
		if (t) return t;
		return ROLE_RANK[b.role] - ROLE_RANK[a.role];
	})[0];
}

function clamp01(v: unknown, dflt = 0.5): number {
	const n = typeof v === 'number' ? v : Number(v);
	return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : dflt;
}

/** Best-effort parse of a model reply (strips ``` fences, grabs the outer {…}). */
function parseJson(raw: string): Record<string, unknown> {
	let s = raw.trim();
	if (s.startsWith('```')) s = s.replace(/^```[a-z]*\n?/i, '').replace(/```$/, '').trim();
	const start = s.indexOf('{');
	const end = s.lastIndexOf('}');
	if (start === -1 || end <= start) throw new Error('no JSON object in model reply');
	return JSON.parse(s.slice(start, end + 1));
}

function markersIn(text: string): number[] {
	return [...text.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]));
}

async function callAnthropic(
	apiModel: string,
	effort: Effort,
	system: string,
	user: string,
	key: string
): Promise<string> {
	const { maxTokens, temperature } = EFFORT_PARAMS[effort];
	const res = await fetch('https://api.anthropic.com/v1/messages', {
		method: 'POST',
		headers: {
			'x-api-key': key,
			'anthropic-version': '2023-06-01',
			'content-type': 'application/json'
		},
		body: JSON.stringify({
			model: apiModel,
			max_tokens: maxTokens,
			temperature,
			system,
			messages: [{ role: 'user', content: user }]
		}),
		signal: AbortSignal.timeout(20_000)
	});
	if (!res.ok) throw new Error(`anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
	const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
	const text = (data.content ?? []).filter((p) => p.type === 'text').map((p) => p.text ?? '').join('');
	if (!text) throw new Error('anthropic: empty reply');
	return text;
}

async function callGoogle(
	apiModel: string,
	effort: Effort,
	system: string,
	user: string,
	key: string
): Promise<string> {
	const { maxTokens, temperature } = EFFORT_PARAMS[effort];
	const url = `https://generativelanguage.googleapis.com/v1beta/models/${apiModel}:generateContent?key=${key}`;
	const res = await fetch(url, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({
			systemInstruction: { parts: [{ text: system }] },
			contents: [{ role: 'user', parts: [{ text: user }] }],
			generationConfig: {
				temperature,
				maxOutputTokens: maxTokens,
				responseMimeType: 'application/json'
			}
		}),
		signal: AbortSignal.timeout(20_000)
	});
	if (!res.ok) throw new Error(`google ${res.status}: ${(await res.text()).slice(0, 200)}`);
	const data = (await res.json()) as {
		candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
	};
	const text = (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('');
	if (!text) throw new Error('google: empty reply');
	return text;
}

async function callModel(
	model: ModelId,
	effort: Effort,
	system: string,
	user: string,
	env: App.Platform['env']
): Promise<string> {
	const apiModel = API_MODEL[model];
	if (MODELS[model].provider === 'anthropic') {
		if (!env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured');
		return callAnthropic(apiModel, effort, system, user, env.ANTHROPIC_API_KEY);
	}
	if (!env.GOOGLE_API_KEY) throw new Error('GOOGLE_API_KEY not configured');
	return callGoogle(apiModel, effort, system, user, env.GOOGLE_API_KEY);
}

/**
 * Run the work group against one claim, live. Throws if the lead model can't be
 * reached (caller falls back to the seeded baseline).
 */
export async function analyzeClaimLive(input: AnalyzeInput): Promise<AnalyzeOutput> {
	const { claimText, docCitations, group, env, kv } = input;
	const figures = group.figures.length ? group.figures : [{ role: 'critic', model: 'claude-sonnet', effort: 'med', desc: '' } as Figure];

	// 1. Grounding — resolve the CELEX(es) this claim cites against CELLAR.
	const refMarkers = markersIn(claimText);
	const refCitations = docCitations.filter((c) => c.marker != null && refMarkers.includes(c.marker));
	const t0 = Date.now();
	const resolutions = await Promise.all(
		refCitations.map(async (c) => ({
			marker: c.marker,
			celex: c.celex,
			status: c.celex ? (await resolveCelex(c.celex, kv)).status : 'unchecked'
		}))
	);
	const groundingMs = Date.now() - t0;
	const resolvedCount = resolutions.filter((r) => r.status === 'verified').length;

	// 2. Decisive LLM call.
	const lead = leadFigure(figures);
	const citeLines = refCitations.length
		? refCitations
				.map((c) => {
					const r = resolutions.find((x) => x.marker === c.marker);
					return `[${c.marker}] ${c.title} (CELEX ${c.celex ?? 'none'}, ${c.locator || 'no locator'}) — CELLAR: ${r?.status ?? 'unchecked'}. Claim it supports: ${c.claim}`;
				})
				.join('\n')
		: '(this claim cites no authority)';

	const user =
		`Assess this single atomic claim from an EU-law work product.\n\n` +
		`CLAIM:\n"${claimText}"\n\n` +
		`CITED AUTHORITIES (with their live CELLAR resolution):\n${citeLines}\n\n` +
		`Return ONLY a JSON object:\n` +
		`{"verdict":"supported|weak|unsupported|flag","confidence":0.0-1.0,` +
		`"summary":"one sentence on whether the cited authority supports the claim",` +
		`"risk":{"category":"hallucination|jurisdiction|missing_authority|conflict|deadline","severity":"low|med|high","rationale":"…"}|null,` +
		`"citationMarkers":[the [n] markers that genuinely support the claim]}\n` +
		`Rules: if a cited CELEX did NOT resolve, the verdict must be "unsupported" or "flag" and raise a "hallucination" risk. ` +
		`If the claim states an obligation with no citation, prefer "weak" and a "missing_authority" risk.`;

	const tLlm = Date.now();
	const reply = await callModel(lead.model, lead.effort, DOMAIN_PREAMBLE, user, env);
	const llmMs = Date.now() - tLlm;
	const parsed = parseJson(reply);

	const verdict = VERDICTS.has(String(parsed.verdict)) ? (parsed.verdict as AnalyzeOutput['verdict']) : 'weak';
	const risk = parsed.risk as { category?: string; severity?: string; rationale?: string } | null | undefined;
	const riskCategory = risk && RISK_CATS.has(String(risk.category)) ? String(risk.category) : null;
	const riskSeverity = risk && SEVERITIES.has(String(risk.severity)) ? String(risk.severity) : null;
	const citationMarkers = Array.isArray(parsed.citationMarkers)
		? (parsed.citationMarkers as unknown[]).map((n) => Number(n)).filter((n) => Number.isFinite(n))
		: refMarkers;

	// 3. Per-figure trace — attribute grounding to research, the verdict to the lead.
	const figureTrace: FigureTrace[] = figures.map((f) => {
		if (f.role === 'research') {
			return {
				role: f.role,
				model: f.model,
				effort: f.effort,
				kind: 'retrieve',
				summary: refCitations.length
					? `Grounded ${refCitations.length} citation(s) against EU CELLAR — ${resolvedCount} resolved.`
					: 'No inline authority to ground for this claim.',
				ms: groundingMs
			};
		}
		const isLead = f.role === lead.role && f.model === lead.model;
		return {
			role: f.role,
			model: f.model,
			effort: f.effort,
			kind: f.role === 'critic' ? 'critique' : 'draft',
			summary: isLead ? String(parsed.summary ?? 'Rated the claim.') : f.desc,
			ms: isLead ? llmMs : EFFORT_PARAMS[f.effort].temperature > 0.25 ? 320 : 200
		};
	});

	return {
		verdict,
		confidence: clamp01(parsed.confidence, 0.6),
		summary: String(parsed.summary ?? '').slice(0, 400),
		riskCategory,
		riskSeverity,
		riskRationale: riskCategory && risk?.rationale ? String(risk.rationale) : '',
		citationMarkers,
		figureTrace
	};
}
