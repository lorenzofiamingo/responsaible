// Live per-claim analysis — server only (never imported client-side).
//
// This is the runtime analogue of the offline ADK pipeline (agents/itaily_agents):
// a faithful MULTI-AGENT run of the chosen work group against one atomic claim, where
// every figure actually makes its own model call and every trace records real time:
//   1. GROUNDING — resolve the claim's cited CELEX(es) (+ any supervisor source)
//      against EU CELLAR (secret-free, KV-cached — reuses src/lib/server/cellar.ts).
//   2. RESEARCHERS run in PARALLEL — each research figure makes its own call on its
//      tool: the EU Law Researcher drives CELLAR as a real MCP client (agentic tool
//      loop on Claude Sonnet); the Web Researcher reasons over Perplexity results; the
//      Firm-Knowledge Researcher summarises the private corpus on an open model.
//   3. CRITIC — the decisive figure makes ONE structured call over the claim + every
//      researcher finding, producing the verdict + confidence + risk + supporting [n].
//   4. ESCALATION (optional, env-gated) — if the critic is unsure or flags a
//      hallucination, re-run it once at higher effort / a stronger model (bounded).
//
// Routed by model id to Anthropic / Google / NVIDIA using a key from platform.env.
// Researcher calls fail soft (degrade to a tool-only trace); only the critic call may
// throw so the caller can fall back to the claim's seeded baseline (demo stays offline).

import type { Citation, FigureTrace, SupervisorInput, SupervisorSource, TraceSource } from '$lib/types';
import type { KVNamespace } from '@cloudflare/workers-types';
import {
	MODELS,
	figureTools,
	type Effort,
	type Figure,
	type ModelId,
	type ResearchTool,
	type WorkGroup
} from '$lib/workgroups';
import { resolveCelex } from './cellar';
import { cellarSearch, searchPerplexity } from './research';
import { searchFirmKnowledge } from './knowledge';
import { connectCellarMcp } from './mcp/cellarClient';
import type { DB } from './db/client';

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
	'claude-opus-4-8': 'claude-opus-4-8',
	// NVIDIA NIM exposes Nemotron under this OpenAI-style id; override via env.
	nemotron: 'nvidia/llama-3.3-nemotron-super-49b-v1',
	// Perplexity's online, web-grounded model (override the variant via PERPLEXITY_MODEL).
	perplexity: 'sonar'
};

/** Default NVIDIA NIM endpoint; point at a self-hosted NIM for true on-prem privacy. */
const NIM_DEFAULT_BASE = 'https://integrate.api.nvidia.com/v1';
/** Perplexity chat-completions endpoint (OpenAI-compatible). */
const PERPLEXITY_URL = 'https://api.perplexity.ai/chat/completions';

const EFFORT_PARAMS: Record<Effort, { maxTokens: number; temperature: number }> = {
	low: { maxTokens: 512, temperature: 0.2 },
	med: { maxTokens: 768, temperature: 0.3 },
	high: { maxTokens: 1024, temperature: 0.4 }
};

/** Anthropic models that REJECT an explicit `temperature` (only the default is allowed).
 *  Opus 4.8 returns 400 "temperature is deprecated for this model" — so we omit it. */
const NO_TEMPERATURE = new Set(['claude-opus-4-8']);

const TIER_RANK = { small: 1, medium: 2, large: 3 } as const;
const ROLE_RANK = { research: 1, drafter: 2, critic: 3 } as const;

/** Bound the per-claim cost: at most this many research model calls (deduped by tool). */
const MAX_RESEARCH_CALLS = 3;
/** Tool-use iterations the EU Law Researcher's MCP agentic loop may take. */
const MCP_MAX_TOOL_ITERATIONS = 4;
/** The critic may be re-run at most this many times by the escalation loop. */
const MAX_ESCALATIONS = 1;
/** Escalate when the critic's confidence falls below this. */
const ESCALATE_CONFIDENCE = 0.45;

/** Human label per research tool — used in the trace and the critic's findings block. */
const TOOL_LABEL: Record<ResearchTool, string> = {
	cellar: 'EU Law (CELLAR)',
	web: 'Open-web',
	knowledge: 'Firm knowledge'
};

export interface AnalyzeInput {
	claimText: string;
	docCitations: Citation[];
	group: WorkGroup;
	env: App.Platform['env'];
	kv?: KVNamespace;
	/** Needed by the knowledge tool to read the private firm corpus. */
	db?: DB;
	/** Manual guidance / sources the supervisor attached to this run. */
	supervisorInput?: SupervisorInput | null;
	/** CELLAR MCP endpoint the EU Law Researcher drives as a real MCP client. */
	mcpCellarUrl?: string;
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
	/** The supervisor input the run used, with each source's CELLAR status filled in. */
	supervisorInput?: SupervisorInput | null;
}

/** Trim a supervisor input to its non-empty parts (or null). */
function normalizeSupervisorInput(input: SupervisorInput | null | undefined): SupervisorInput | null {
	if (!input) return null;
	const guidance = (input.guidance ?? '').trim();
	const sources = (input.sources ?? [])
		.map((s) => ({
			celex: (s.celex ?? '').trim(),
			title: (s.title ?? '').trim(),
			locator: (s.locator ?? '').trim(),
			snippet: (s.snippet ?? '').trim(),
			url: (s.url ?? '').trim()
		}))
		.filter((s) => s.celex || s.title || s.snippet || s.url);
	if (!guidance && sources.length === 0) return null;
	return { guidance: guidance || undefined, sources };
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
	const body: Record<string, unknown> = {
		model: apiModel,
		max_tokens: maxTokens,
		system,
		messages: [{ role: 'user', content: user }]
	};
	if (!NO_TEMPERATURE.has(apiModel)) body.temperature = temperature;
	const res = await fetch('https://api.anthropic.com/v1/messages', {
		method: 'POST',
		headers: {
			'x-api-key': key,
			'anthropic-version': '2023-06-01',
			'content-type': 'application/json'
		},
		body: JSON.stringify(body),
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

/** NVIDIA NIM is OpenAI-compatible — used for the open, self-hostable Nemotron path. */
async function callNvidia(
	apiModel: string,
	effort: Effort,
	system: string,
	user: string,
	key: string,
	baseUrl: string
): Promise<string> {
	const { maxTokens, temperature } = EFFORT_PARAMS[effort];
	const res = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
		method: 'POST',
		headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
		body: JSON.stringify({
			model: apiModel,
			max_tokens: maxTokens,
			temperature,
			messages: [
				{ role: 'system', content: system },
				{ role: 'user', content: user }
			]
		}),
		signal: AbortSignal.timeout(20_000)
	});
	if (!res.ok) throw new Error(`nvidia ${res.status}: ${(await res.text()).slice(0, 200)}`);
	const data = (await res.json()) as {
		choices?: Array<{ message?: { content?: string; reasoning_content?: string; reasoning?: string } }>;
	};
	// Reasoning Nemotron variants put their answer in `reasoning_content` with `content` null.
	const msg = data.choices?.[0]?.message ?? {};
	const text = (msg.content || msg.reasoning_content || msg.reasoning || '').trim();
	if (!text) throw new Error('nvidia: empty reply');
	return text;
}

/** Perplexity's chat-completions API (OpenAI-compatible) — the Web researcher's model. */
async function callPerplexity(
	apiModel: string,
	effort: Effort,
	system: string,
	user: string,
	key: string
): Promise<string> {
	const { maxTokens, temperature } = EFFORT_PARAMS[effort];
	const res = await fetch(PERPLEXITY_URL, {
		method: 'POST',
		headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
		body: JSON.stringify({
			model: apiModel,
			max_tokens: maxTokens,
			temperature,
			messages: [
				{ role: 'system', content: system },
				{ role: 'user', content: user }
			]
		}),
		signal: AbortSignal.timeout(20_000)
	});
	if (!res.ok) throw new Error(`perplexity ${res.status}: ${(await res.text()).slice(0, 200)}`);
	const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
	const text = (data.choices?.[0]?.message?.content ?? '').trim();
	if (!text) throw new Error('perplexity: empty reply');
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
	const provider = MODELS[model].provider;
	if (provider === 'anthropic') {
		if (!env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured');
		return callAnthropic(apiModel, effort, system, user, env.ANTHROPIC_API_KEY);
	}
	if (provider === 'nvidia') {
		if (!env.NVIDIA_NIM_API_KEY) throw new Error('NVIDIA_NIM_API_KEY not configured');
		const apiId = env.ITAILY_NEMOTRON_MODEL || apiModel;
		return callNvidia(apiId, effort, system, user, env.NVIDIA_NIM_API_KEY, env.NVIDIA_NIM_BASE_URL || NIM_DEFAULT_BASE);
	}
	if (provider === 'perplexity') {
		if (!env.PERPLEXITY_API_KEY) throw new Error('PERPLEXITY_API_KEY not configured');
		return callPerplexity(env.PERPLEXITY_MODEL || apiModel, effort, system, user, env.PERPLEXITY_API_KEY);
	}
	if (!env.GOOGLE_API_KEY) throw new Error('GOOGLE_API_KEY not configured');
	return callGoogle(apiModel, effort, system, user, env.GOOGLE_API_KEY);
}

function isTruthy(v: string | undefined): boolean {
	return !!v && ['1', 'true', 'yes', 'on'].includes(v.trim().toLowerCase());
}

/** Loose JSON parse — returns {} instead of throwing (for best-effort researcher output). */
function parseJsonLoose(raw: string): Record<string, unknown> {
	try {
		return parseJson(raw);
	} catch {
		return {};
	}
}

/** One structured finding a research figure contributes to the critic. */
interface ResearcherFinding {
	tool: ResearchTool;
	/** For the cellar tool: did the cited authority resolve & match? (null = n/a) */
	resolves?: boolean | null;
	assessment: string;
	sources: TraceSource[];
}

/** Render the research panel's findings for the critic prompt. */
function foldFindings(findings: ResearcherFinding[]): string {
	if (!findings.length) return '';
	const blocks = findings.map((f) => {
		const status =
			f.tool === 'cellar' && f.resolves != null
				? ` — cited authority ${f.resolves ? 'RESOLVES & matches' : 'does NOT resolve'}`
				: '';
		const src = f.sources.length ? `\n  sources: ${f.sources.map((s) => s.title).join('; ')}` : '';
		return `RESEARCHER FINDING — ${TOOL_LABEL[f.tool]}${status}:\n  ${f.assessment}${src}`;
	});
	return `\nRESEARCH PANEL FINDINGS (each produced by a specialist figure; weigh them):\n\n${blocks.join('\n\n')}\n`;
}

/** The figure that makes the decisive verdict call: an explicit critic (highest tier) else the lead. */
function pickCritic(figures: Figure[]): Figure {
	const critics = figures.filter((f) => f.role === 'critic');
	if (critics.length) {
		return [...critics].sort((a, b) => TIER_RANK[MODELS[b.model].tier] - TIER_RANK[MODELS[a.model].tier])[0];
	}
	return leadFigure(figures);
}

/** A stronger variant of the critic for one escalation pass, or null if already maxed. */
function strongerVariant(f: Figure): Figure | null {
	if (f.effort !== 'high') return { ...f, effort: 'high' };
	if (TIER_RANK[MODELS[f.model].tier] < TIER_RANK.large) return { ...f, model: 'claude-opus-4-8' };
	return null;
}

function shouldEscalate(v: { confidence: number; riskCategory: string | null }): boolean {
	return v.confidence < ESCALATE_CONFIDENCE || v.riskCategory === 'hallucination';
}

/** The decisive verdict shape both the model critic and its deterministic fallback return. */
interface Verdict {
	verdict: AnalyzeOutput['verdict'];
	confidence: number;
	summary: string;
	riskCategory: string | null;
	riskSeverity: string | null;
	riskRationale: string;
	citationMarkers: number[];
}

/**
 * The reviewer verdict derived WITHOUT a model call — the fallback used when no critic
 * model is reachable (e.g. running on localhost with no API key configured). Instead of
 * throwing away the real CELLAR + firm-knowledge research the figures already did, we
 * read off the live EU CELLAR grounding and apply the same hard rules the critic prompt
 * states: a cited authority that fails to resolve is a hallucination risk; a claim with
 * no authority lacks one.
 *
 * Deliberately CONSERVATIVE: it scores citation HYGIENE (does each cited CELEX resolve
 * against live EU CELLAR), not semantic support — so confidence stays in the low band to
 * signal that no model weighed the argument. Web / firm-knowledge findings still appear
 * in the trace, but a no-model fallback does NOT synthesise them into the verdict; that
 * judgement is exactly what needs a reviewer model.
 */
function deterministicVerdict(g: {
	groundedTotal: number;
	resolvedCount: number;
	unresolvedCount: number;
	verifiedMarkers: number[];
	refMarkers: number[];
	hasGuidance: boolean;
}): Verdict {
	const citationMarkers = g.verifiedMarkers.length ? g.verifiedMarkers : g.refMarkers;
	const note = g.hasGuidance ? ' Applied the supervisor’s instruction.' : '';

	if (g.groundedTotal === 0) {
		return {
			verdict: 'weak',
			confidence: 0.5,
			summary: `No authority is cited; grounded against EU CELLAR only.${note}`,
			riskCategory: 'missing_authority',
			riskSeverity: 'low',
			riskRationale:
				'The claim cites no EU instrument, and no reviewer model was reachable to judge whether one is required.',
			citationMarkers
		};
	}
	if (g.unresolvedCount > 0) {
		return {
			verdict: 'unsupported',
			confidence: 0.35,
			summary: `${g.unresolvedCount} of ${g.groundedTotal} cited authority(ies) did not resolve in EU CELLAR.${note}`,
			riskCategory: 'hallucination',
			riskSeverity: 'high',
			riskRationale:
				'A cited CELEX could not be resolved in EU CELLAR — the authority may be fabricated or mis-cited.',
			citationMarkers
		};
	}
	if (g.resolvedCount === g.groundedTotal) {
		return {
			verdict: 'supported',
			confidence: 0.55,
			summary: `All ${g.groundedTotal} cited authority(ies) resolve in EU CELLAR.${note}`,
			riskCategory: null,
			riskSeverity: null,
			riskRationale: '',
			citationMarkers
		};
	}
	return {
		verdict: 'weak',
		confidence: 0.45,
		summary: `${g.resolvedCount} of ${g.groundedTotal} cited authority(ies) verified in EU CELLAR; the rest were inconclusive.${note}`,
		riskCategory: 'missing_authority',
		riskSeverity: 'med',
		riskRationale:
			'Some cited authorities could not be confirmed against CELLAR and no reviewer model was available to weigh them.',
		citationMarkers
	};
}

// ---- Anthropic tool-use turn — powers the EU Law Researcher's MCP agentic loop ------

interface AnthropicToolDef {
	name: string;
	description?: string;
	input_schema: unknown;
}
interface AnthropicBlock {
	type: string;
	text?: string;
	id?: string;
	name?: string;
	input?: unknown;
}

/** One assistant turn that may request tool calls (returns its content blocks + stop reason). */
async function anthropicToolTurn(
	apiModel: string,
	effort: Effort,
	system: string,
	messages: Array<{ role: 'user' | 'assistant'; content: unknown }>,
	tools: AnthropicToolDef[],
	key: string
): Promise<{ stopReason: string | null; content: AnthropicBlock[] }> {
	const { maxTokens, temperature } = EFFORT_PARAMS[effort];
	const body: Record<string, unknown> = { model: apiModel, max_tokens: maxTokens, system, tools, messages };
	if (!NO_TEMPERATURE.has(apiModel)) body.temperature = temperature;
	const res = await fetch('https://api.anthropic.com/v1/messages', {
		method: 'POST',
		headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
		body: JSON.stringify(body),
		signal: AbortSignal.timeout(25_000)
	});
	if (!res.ok) throw new Error(`anthropic(tools) ${res.status}: ${(await res.text()).slice(0, 200)}`);
	const data = (await res.json()) as { content?: AnthropicBlock[]; stop_reason?: string };
	return { stopReason: data.stop_reason ?? null, content: data.content ?? [] };
}

/** Pull {title,url} sources out of a CELLAR tool-result payload into `into`. */
function collectMcpSources(payload: unknown, into: TraceSource[]): void {
	const p = payload as
		| { results?: Array<{ title?: string; celex?: string; url?: string }>; celex?: string; source_url?: string; resolves?: boolean }
		| null
		| undefined;
	if (!p) return;
	if (Array.isArray(p.results)) {
		for (const r of p.results) {
			if (r.celex || r.title) into.push({ title: r.title || r.celex || 'authority', url: r.url || undefined });
		}
	} else if (p.celex && p.source_url) {
		into.push({ title: `${p.celex}${p.resolves === false ? ' (does not resolve)' : ''}`, url: p.source_url });
	}
}

function dedupeSources(list: TraceSource[]): TraceSource[] {
	const seen = new Set<string>();
	const out: TraceSource[] = [];
	for (const s of list) {
		const k = (s.url || '') + '|' + s.title;
		if (seen.has(k)) continue;
		seen.add(k);
		out.push(s);
	}
	return out;
}

const CELLAR_AGENT_SYSTEM =
	DOMAIN_PREAMBLE +
	'\n\nROLE: EU Law researcher. Using ONLY the CELLAR tools provided, verify the authorities a claim relies on. ' +
	'Derive a CELEX with `celex`, confirm it with `fetch` (resolves true/false), and use `search` to find the governing act when none is cited. ' +
	'Never assert an authority that `fetch` reports as not resolving. When finished, reply with ONLY a JSON object ' +
	'{"resolves": true|false|null (do the cited authorities resolve AND support the claim?), "assessment": "1-2 sentences"}.';

/**
 * Drive CELLAR as a REAL MCP client: the EU Law Researcher's model (Claude) calls the
 * `search`/`fetch`/`celex` tools over the Streamable-HTTP transport in a bounded loop.
 * Returns null (caller falls back to in-process grounding) if MCP/Anthropic is unavailable.
 */
async function runCellarMcpAgent(
	figure: Figure,
	claimText: string,
	citeLines: string,
	mcpUrl: string,
	env: App.Platform['env']
): Promise<{ resolves: boolean | null; assessment: string; sources: TraceSource[]; ms: number } | null> {
	const key = env.ANTHROPIC_API_KEY;
	if (!key || MODELS[figure.model].provider !== 'anthropic') return null;
	let client: Awaited<ReturnType<typeof connectCellarMcp>>;
	try {
		client = await connectCellarMcp(mcpUrl);
	} catch {
		return null;
	}
	const t0 = Date.now();
	try {
		const tools: AnthropicToolDef[] = client.tools.map((t) => ({
			name: t.name,
			description: t.description,
			input_schema: t.inputSchema ?? { type: 'object', properties: {} }
		}));
		if (!tools.length) return null;

		const sources: TraceSource[] = [];
		const messages: Array<{ role: 'user' | 'assistant'; content: unknown }> = [
			{
				role: 'user',
				content: `CLAIM:\n"${claimText}"\n\nCITED AUTHORITIES:\n${citeLines}\n\nVerify them via the CELLAR tools, then return the JSON.`
			}
		];
		let finalText = '';
		for (let i = 0; i < MCP_MAX_TOOL_ITERATIONS; i++) {
			const turn = await anthropicToolTurn(API_MODEL[figure.model], figure.effort, CELLAR_AGENT_SYSTEM, messages, tools, key);
			messages.push({ role: 'assistant', content: turn.content });
			const toolUses = turn.content.filter((b) => b.type === 'tool_use');
			finalText = turn.content.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('') || finalText;
			if (turn.stopReason === 'tool_use' && toolUses.length) {
				const results: unknown[] = [];
				for (const tu of toolUses) {
					let out: { payload: unknown; isError: boolean };
					try {
						out = await client.callTool(String(tu.name), (tu.input as Record<string, unknown>) ?? {});
					} catch (e) {
						out = { payload: { ok: false, error: String(e) }, isError: true };
					}
					collectMcpSources(out.payload, sources);
					results.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(out.payload), is_error: out.isError });
				}
				messages.push({ role: 'user', content: results });
				continue;
			}
			break; // stopped without a tool call → final answer
		}
		const parsed = parseJsonLoose(finalText);
		const resolves = typeof parsed.resolves === 'boolean' ? parsed.resolves : null;
		const assessment =
			String(parsed.assessment ?? finalText ?? '').trim().slice(0, 600) ||
			'Verified the cited authorities against CELLAR via MCP.';
		return { resolves, assessment, sources: dedupeSources(sources).slice(0, 6), ms: Date.now() - t0 };
	} catch {
		return null;
	} finally {
		await client.close().catch(() => {});
	}
}

/**
 * Run the work group against one claim as a faithful multi-agent pass: parallel
 * researchers → critic decisive call → optional bounded escalation. The critic call
 * throws if its model can't be reached (caller falls back to the seeded baseline).
 */
export async function analyzeClaimLive(input: AnalyzeInput): Promise<AnalyzeOutput> {
	const { claimText, docCitations, group, env, kv, db } = input;
	const figures = group.figures.length ? group.figures : [{ role: 'critic', model: 'claude-sonnet', effort: 'med', desc: '' } as Figure];
	const supervisorInput = normalizeSupervisorInput(input.supervisorInput);

	// 1. Grounding — resolve the CELEX(es) this claim cites against CELLAR, plus any
	//    authority the supervisor inserted by hand for this run.
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

	// Resolve the supervisor's manual sources against CELLAR and stamp each with its
	// status (echoed back so the panel can show whether the inserted authority verified).
	const supSources: SupervisorSource[] = await Promise.all(
		(supervisorInput?.sources ?? []).map(async (s): Promise<SupervisorSource> => ({
			...s,
			celexStatus: s.celex ? (await resolveCelex(s.celex, kv)).status : 'unchecked'
		}))
	);
	const groundingMs = Date.now() - t0;
	const resolvedCount =
		resolutions.filter((r) => r.status === 'verified').length +
		supSources.filter((s) => s.celexStatus === 'verified').length;
	// Authorities that ACTIVELY failed to resolve (4xx) vs. merely inconclusive — used
	// by the deterministic critic fallback to tell a hallucination from a missing check.
	const unresolvedCount =
		resolutions.filter((r) => r.status === 'unresolved').length +
		supSources.filter((s) => s.celexStatus === 'unresolved').length;
	const verifiedMarkers = resolutions
		.filter((r) => r.status === 'verified' && r.marker != null)
		.map((r) => r.marker as number);
	const usedInput: SupervisorInput | null =
		supervisorInput && (supervisorInput.guidance || supSources.length)
			? { guidance: supervisorInput.guidance, sources: supSources }
			: null;
	// Grounding sources for the trace: cited authorities plus any the supervisor added.
	const groundingSources: TraceSource[] = [
		...refCitations.map((c) => ({ title: `[${c.marker}] ${c.title}`, url: c.sourceUrl ?? undefined })),
		...supSources.map((s) => ({ title: s.title || s.celex || 'supervisor source', url: s.url || undefined }))
	];

	// Shared prompt blocks — the cited authorities (with live CELLAR status) and the
	// supervisor's manual steering. Both flow into the researchers and the critic.
	const citeLines = refCitations.length
		? refCitations
				.map((c) => {
					const r = resolutions.find((x) => x.marker === c.marker);
					return `[${c.marker}] ${c.title} (CELEX ${c.celex ?? 'none'}, ${c.locator || 'no locator'}) — CELLAR: ${r?.status ?? 'unchecked'}. Claim it supports: ${c.claim}`;
				})
				.join('\n')
		: '(this claim cites no authority)';

	const supSourceLines = supSources.length
		? supSources
				.map((s) => {
					const head = [s.title, s.locator].filter(Boolean).join(', ') || s.url || 'untitled source';
					const cx = s.celex ? `CELEX ${s.celex} — CELLAR: ${s.celexStatus}` : 'no CELEX';
					return `- ${head} (${cx})${s.snippet ? `: ${s.snippet}` : ''}`;
				})
				.join('\n')
		: '';
	const supervisorBlock = usedInput
		? `SUPERVISOR-PROVIDED CONTEXT (a human reviewer inserted this for this run — weigh it as authoritative):\n` +
			(usedInput.guidance ? `Instruction: ${usedInput.guidance}\n` : '') +
			(supSourceLines ? `Sources:\n${supSourceLines}\n` : '') +
			`\n`
		: '';

	const groundedTotal = refCitations.length + supSources.length;
	const supNote = supSources.length ? ` (incl. ${supSources.length} supervisor-provided)` : '';

	// ---- STAGE 1: researchers in parallel -------------------------------------------
	// One task per DISTINCT tool (deduped, capped) so cost stays bounded; the owning
	// figure makes a real call on it. Each returns a finding + its honest trace steps.
	const researchFigures = figures.filter((f) => f.role === 'research');
	const tasks: Array<{ figure: Figure; tool: ResearchTool }> = [];
	const seenTools = new Set<ResearchTool>();
	for (const f of researchFigures) {
		const tools = figureTools(f).length ? figureTools(f) : (['cellar'] as ResearchTool[]);
		for (const t of tools) {
			if (seenTools.has(t) || tasks.length >= MAX_RESEARCH_CALLS) continue;
			seenTools.add(t);
			tasks.push({ figure: f, tool: t });
		}
	}

	const mcpUrl = input.mcpCellarUrl;

	async function runResearcher(
		figure: Figure,
		tool: ResearchTool
	): Promise<{ finding: ResearcherFinding | null; trace: FigureTrace[] }> {
		const stamp = { role: figure.role, model: figure.model, effort: figure.effort, tool };

		if (tool === 'web') {
			const ts = Date.now();
			const web = await searchPerplexity(claimText, figure.web, env, kv);
			const retrieveMs = Date.now() - ts;
			if (!web || (!web.answer && !web.sources.length)) {
				return {
					finding: null,
					trace: [
						{
							...stamp,
							kind: 'search',
							summary: web
								? 'Open-web research returned no usable sources.'
								: 'Open-web research is unavailable here — no web-search API key is configured.',
							ms: retrieveMs
						}
					]
				};
			}
			const trace: FigureTrace[] = [
				{ ...stamp, kind: 'search', summary: web.answer.slice(0, 200) || 'Retrieved open-web sources.', sources: web.sources, ms: retrieveMs }
			];
			// When the figure's model IS Perplexity, the search call above already IS the
			// model's reasoning — use its answer directly, no redundant second call.
			if (MODELS[figure.model].provider === 'perplexity') {
				return { finding: { tool, assessment: web.answer.slice(0, 400) || 'Open-web research completed.', sources: web.sources }, trace };
			}
			// Otherwise the figure's own model scopes the open-web result to THIS claim.
			try {
				const u =
					`Claim:\n"${claimText}"\n\nOpen-web research (Perplexity, trusted domains):\n${web.answer}\n` +
					web.sources.map((s) => `- ${s.title} ${s.url ?? ''}`).join('\n') +
					`\n\nIn 1-2 sentences, does this corroborate or undercut the claim under EU law? Return ONLY {"assessment":"..."}.`;
				const r0 = Date.now();
				const reply = await callModel(figure.model, figure.effort, DOMAIN_PREAMBLE, u, env);
				const assessment = String(parseJsonLoose(reply).assessment ?? reply).trim().slice(0, 400) || web.answer.slice(0, 400);
				trace.push({ role: figure.role, model: figure.model, effort: figure.effort, kind: 'reason', summary: assessment, ms: Date.now() - r0 });
				return { finding: { tool, assessment, sources: web.sources }, trace };
			} catch {
				return { finding: { tool, assessment: web.answer.slice(0, 400), sources: web.sources }, trace };
			}
		}

		if (tool === 'knowledge') {
			if (!db) return { finding: null, trace: [{ ...stamp, kind: 'retrieve', summary: 'Firm knowledge unavailable in this run.', ms: 0 }] };
			const ts = Date.now();
			const hits = await searchFirmKnowledge(db, claimText);
			const retrieveMs = Date.now() - ts;
			if (!hits.length) return { finding: null, trace: [{ ...stamp, kind: 'retrieve', summary: 'No matching firm knowledge found.', ms: retrieveMs }] };
			// `ref` carries the doc id so the trace can deep-link into /knowledge — the
			// document is private (no public URL), so the link is an internal app route.
			const sources = hits.map((k) => ({ title: k.title, ref: k.id }));
			const trace: FigureTrace[] = [
				{ ...stamp, kind: 'retrieve', summary: `Consulted ${hits.length} private firm document(s) on a self-hostable model.`, sources, ms: retrieveMs }
			];
			try {
				const u =
					`Claim:\n"${claimText}"\n\nFirm knowledge (internal & privileged — inform only, do not quote verbatim):\n` +
					hits.map((k) => `- ${k.title}: ${k.snippet}`).join('\n') +
					`\n\nIn 1-2 sentences, how does the firm's position bear on this claim? Return ONLY {"assessment":"..."}.`;
				const r0 = Date.now();
				const reply = await callModel(figure.model, figure.effort, DOMAIN_PREAMBLE, u, env);
				const assessment = String(parseJsonLoose(reply).assessment ?? reply).trim().slice(0, 400) || `Consulted ${hits.length} firm document(s).`;
				trace.push({ role: figure.role, model: figure.model, effort: figure.effort, kind: 'reason', summary: assessment, ms: Date.now() - r0 });
				return { finding: { tool, assessment, sources }, trace };
			} catch {
				return {
					finding: { tool, assessment: `Consulted ${hits.length} firm document(s): ${hits.map((k) => k.title).join(', ')}.`, sources },
					trace
				};
			}
		}

		// cellar — REAL MCP agentic path for an Anthropic-driven EU Law Researcher.
		if (mcpUrl && MODELS[figure.model].provider === 'anthropic' && env.ANTHROPIC_API_KEY) {
			const agent = await runCellarMcpAgent(figure, claimText, citeLines, mcpUrl, env);
			if (agent) {
				const groundSources = groundingSources.length ? groundingSources : agent.sources;
				return {
					finding: { tool, resolves: agent.resolves, assessment: agent.assessment, sources: groundSources.slice(0, 6) },
					trace: [
						{
							...stamp,
							kind: 'retrieve',
							summary: groundedTotal
								? `Verified ${groundedTotal} cited authority(ies)${supNote} against CELLAR over MCP — ${resolvedCount} resolved.`
								: 'Searched CELLAR over MCP for the governing authority.',
							sources: groundSources,
							ms: groundingMs
						},
						{ role: figure.role, model: figure.model, effort: figure.effort, kind: 'reason', summary: agent.assessment, ms: agent.ms }
					]
				};
			}
			// fall through to deterministic grounding if MCP/agent is unavailable
		}

		// Deterministic in-process grounding (no MCP) — plus a keyword search when the
		// claim cites nothing, to surface the authority it *should* rely on.
		let cellarHits: Awaited<ReturnType<typeof cellarSearch>> = null;
		let searchMs = 0;
		if (refCitations.length === 0) {
			const kw = (claimText.toLowerCase().match(/[a-z]{5,}/g) ?? []).sort((a, b) => b.length - a.length)[0];
			if (kw) {
				const ts = Date.now();
				cellarHits = await cellarSearch(kw, kv);
				searchMs = Date.now() - ts;
			}
		}
		if (groundedTotal) {
			const resolvesAll = resolvedCount === groundedTotal;
			const summary = `Grounded ${groundedTotal} citation(s)${supNote} against EU CELLAR — ${resolvedCount} resolved.`;
			return {
				finding: { tool, resolves: resolvesAll, assessment: summary, sources: groundingSources },
				trace: [{ ...stamp, kind: 'retrieve', summary, sources: groundingSources, ms: groundingMs }]
			};
		}
		if (cellarHits && cellarHits.length) {
			const sources = cellarHits.map((h) => ({ title: h.title, url: h.url }));
			const summary = `Searched CELLAR — surfaced ${cellarHits.length} candidate authority(ies).`;
			return { finding: { tool, resolves: null, assessment: summary, sources }, trace: [{ ...stamp, kind: 'search', summary, sources, ms: searchMs || groundingMs }] };
		}
		const summary = usedInput?.guidance
			? 'No authority to ground; applied the supervisor’s instruction.'
			: 'No inline authority to ground for this claim.';
		return { finding: null, trace: [{ ...stamp, kind: 'retrieve', summary, ms: groundingMs }] };
	}

	const researchResults = await Promise.all(tasks.map((t) => runResearcher(t.figure, t.tool)));
	// Map results back to the owning figure (a figure may own more than one tool).
	const traceByFigure = new Map<Figure, FigureTrace[]>();
	const findings: ResearcherFinding[] = [];
	tasks.forEach((t, i) => {
		const r = researchResults[i];
		const list = traceByFigure.get(t.figure) ?? [];
		list.push(...r.trace);
		traceByFigure.set(t.figure, list);
		if (r.finding) findings.push(r.finding);
	});

	// ---- STAGE 2: critic decisive call ----------------------------------------------
	const critic = pickCritic(figures);
	const criticUser =
		`Assess this single atomic claim from an EU-law work product.\n\n` +
		`CLAIM:\n"${claimText}"\n\n` +
		`CITED AUTHORITIES (with their live CELLAR resolution):\n${citeLines}\n\n` +
		supervisorBlock +
		foldFindings(findings) +
		`\nReturn ONLY a JSON object:\n` +
		`{"verdict":"supported|weak|unsupported|flag","confidence":0.0-1.0,` +
		`"summary":"one sentence on whether the cited authority supports the claim",` +
		`"risk":{"category":"hallucination|jurisdiction|missing_authority|conflict|deadline","severity":"low|med|high","rationale":"…"}|null,` +
		`"citationMarkers":[the [n] markers that genuinely support the claim]}\n` +
		`Rules: if a cited CELEX did NOT resolve, the verdict must be "unsupported" or "flag" and raise a "hallucination" risk. ` +
		`If the claim states an obligation with no citation, prefer "weak" and a "missing_authority" risk.`;

	async function runCriticOnce(fig: Figure): Promise<{ parsed: Record<string, unknown>; ms: number }> {
		const t = Date.now();
		const reply = await callModel(fig.model, fig.effort, DOMAIN_PREAMBLE, criticUser, env);
		return { parsed: parseJson(reply), ms: Date.now() - t };
	}

	function readVerdict(parsed: Record<string, unknown>) {
		const verdict = VERDICTS.has(String(parsed.verdict)) ? (parsed.verdict as AnalyzeOutput['verdict']) : 'weak';
		const risk = parsed.risk as { category?: string; severity?: string; rationale?: string } | null | undefined;
		const riskCategory = risk && RISK_CATS.has(String(risk.category)) ? String(risk.category) : null;
		const riskSeverity = risk && SEVERITIES.has(String(risk.severity)) ? String(risk.severity) : null;
		const citationMarkers = Array.isArray(parsed.citationMarkers)
			? (parsed.citationMarkers as unknown[]).map((n) => Number(n)).filter((n) => Number.isFinite(n))
			: refMarkers;
		return {
			verdict,
			confidence: clamp01(parsed.confidence, 0.6),
			summary: String(parsed.summary ?? '').slice(0, 400),
			riskCategory,
			riskSeverity,
			riskRationale: riskCategory && risk?.rationale ? String(risk.rationale) : '',
			citationMarkers
		};
	}

	// The critic makes the decisive call. If its model is UNREACHABLE (e.g. running on
	// localhost with no API key), we do NOT discard the real CELLAR + firm-knowledge
	// research the figures just did — we derive the verdict from the live grounding so the
	// work group still returns an honest, grounded result instead of the seeded baseline.
	// The model call and the JSON parse are kept separate on purpose: only a failed CALL
	// (no key / network / provider error) falls to the deterministic path. A reachable
	// model that replies with unparseable JSON is a genuine bug — we let parseJson throw so
	// the caller falls back to the seed, rather than mislabelling it "no model reachable".
	let v: Verdict;
	let criticMs: number;
	let criticDeterministic = false;
	let criticReply: string | null = null;
	const criticStart = Date.now();
	try {
		criticReply = await callModel(critic.model, critic.effort, DOMAIN_PREAMBLE, criticUser, env);
	} catch {
		criticReply = null; // model unreachable → deterministic, CELLAR-grounded verdict
	}
	if (criticReply !== null) {
		v = readVerdict(parseJson(criticReply));
		criticMs = Date.now() - criticStart;
	} else {
		v = deterministicVerdict({
			groundedTotal,
			resolvedCount,
			unresolvedCount,
			verifiedMarkers,
			refMarkers,
			hasGuidance: !!usedInput?.guidance
		});
		criticMs = 0;
		criticDeterministic = true;
	}
	let escalated = false;

	// ---- STAGE 3: bounded escalation ------------------------------------------------
	if (!criticDeterministic && isTruthy(env.ITAILY_ESCALATION) && MAX_ESCALATIONS > 0 && shouldEscalate(v)) {
		const stronger = strongerVariant(critic);
		if (stronger) {
			try {
				const retry = await runCriticOnce(stronger);
				v = readVerdict(retry.parsed);
				criticMs += retry.ms;
				escalated = true;
			} catch {
				/* keep the first verdict */
			}
		}
	}
	const verdictSummary = v.summary || 'Rated the claim.';
	const criticSummary = criticDeterministic
		? `${verdictSummary} (no reviewer model reachable — verdict derived from the live CELLAR grounding)`
		: verdictSummary;

	// ---- Honest per-figure trace (real ms + real model per figure) ------------------
	// Each configured figure is one work-group MEMBER, but a member can emit several
	// steps (e.g. a CELLAR researcher does a `retrieve` then a `reason`). We collect a
	// member's steps together and tag them all with its 1-based index so the UI can group
	// them under one heading instead of reading two steps as two figures.
	const figureTrace: FigureTrace[] = [];
	let member = 0;
	for (const f of figures) {
		member++;
		const steps: FigureTrace[] = [];
		if (f.role === 'research') {
			const research = traceByFigure.get(f);
			if (research && research.length) steps.push(...research);
			else
				steps.push({
					role: f.role,
					model: f.model,
					effort: f.effort,
					kind: 'retrieve',
					tool: figureTools(f)[0],
					summary: 'Shared the research already gathered for this claim.',
					ms: 0
				});
			if (f === critic) {
				steps.push({ role: f.role, model: f.model, effort: f.effort, kind: 'critique', summary: criticSummary, ms: criticMs, escalated });
			}
		} else if (f === critic) {
			steps.push({
				role: f.role,
				model: f.model,
				effort: f.effort,
				kind: 'critique',
				summary: escalated ? `${verdictSummary} (escalated for a closer look).` : criticSummary,
				ms: criticMs,
				escalated
			});
		} else {
			// A non-decisive critic or a drafter makes no call at verification time.
			steps.push({
				role: f.role,
				model: f.model,
				effort: f.effort,
				kind: f.role === 'drafter' ? 'draft' : 'critique',
				summary:
					f.role === 'drafter'
						? 'Drafting happens offline at seed time; no runtime call.'
						: 'Deferred to the lead reviewer for the decisive verdict.',
				ms: 0
			});
		}
		for (const s of steps) s.member = member;
		figureTrace.push(...steps);
	}

	return {
		verdict: v.verdict,
		confidence: v.confidence,
		summary: criticSummary,
		riskCategory: v.riskCategory,
		riskSeverity: v.riskSeverity,
		riskRationale: v.riskRationale,
		citationMarkers: v.citationMarkers,
		figureTrace,
		supervisorInput: usedInput
	};
}
