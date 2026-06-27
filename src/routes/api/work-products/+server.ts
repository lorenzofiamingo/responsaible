import { CAN_SUBMIT } from '$lib/format';
import { dbFrom } from '$lib/server/db/client';
import { createWorkProduct, getMatterHeader, type NewWorkProductInput } from '$lib/server/db/queries';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const TYPES = ['draft', 'memo', 'opinion', 'risk_analysis'];
const KINDS = ['search', 'retrieve', 'reason', 'draft', 'cite', 'critique'];
const CATEGORIES = ['hallucination', 'jurisdiction', 'missing_authority', 'conflict', 'deadline'];
const SEVERITIES = ['low', 'med', 'high'];

type Raw = Record<string, unknown>;
const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback);
const num = (v: unknown, fallback = 0) => (typeof v === 'number' && !Number.isNaN(v) ? v : fallback);
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function validate(raw: Raw): { ok: true; value: NewWorkProductInput } | { ok: false; error: string } {
	if (!raw || typeof raw !== 'object') return { ok: false, error: 'Body must be a JSON object.' };
	if (!TYPES.includes(str(raw.type))) return { ok: false, error: `type must be one of ${TYPES.join(', ')}.` };
	if (!str(raw.title).trim()) return { ok: false, error: 'title is required.' };

	const trace = Array.isArray(raw.trace) ? (raw.trace as Raw[]) : [];
	for (const a of trace) {
		if (!KINDS.includes(str(a.kind))) return { ok: false, error: `trace.kind must be one of ${KINDS.join(', ')}.` };
		if (!str(a.summary).trim()) return { ok: false, error: 'each trace step needs a summary.' };
	}
	const citations = Array.isArray(raw.citations) ? (raw.citations as Raw[]) : [];
	const risks = Array.isArray(raw.riskSignals) ? (raw.riskSignals as Raw[]) : [];
	for (const r of risks) {
		if (!CATEGORIES.includes(str(r.category))) return { ok: false, error: `riskSignals.category must be one of ${CATEGORIES.join(', ')}.` };
		if (!SEVERITIES.includes(str(r.severity))) return { ok: false, error: `riskSignals.severity must be one of ${SEVERITIES.join(', ')}.` };
		if (!str(r.rationale).trim()) return { ok: false, error: 'each risk signal needs a rationale.' };
	}

	const value: NewWorkProductInput = {
		type: str(raw.type) as NewWorkProductInput['type'],
		title: str(raw.title).trim(),
		summary: str(raw.summary),
		body: str(raw.body),
		matterId: str(raw.matterId),
		matterRef: str(raw.matterRef),
		matterName: str(raw.matterName),
		agentName: str(raw.agentName, 'Itaily Agent'),
		priority: clamp(Math.round(num(raw.priority, 50)), 0, 100),
		confidence: clamp(num(raw.confidence, 0.7), 0, 1),
		model: str(raw.model),
		trace: trace.map((a, i) => ({
			step: typeof a.step === 'number' ? a.step : i + 1,
			kind: str(a.kind) as 'search',
			actorAgent: str(a.actorAgent),
			summary: str(a.summary),
			detail: a.detail && typeof a.detail === 'object' ? (a.detail as Record<string, unknown>) : null
		})),
		citations: citations.map((c) => ({
			marker: typeof c.marker === 'number' ? c.marker : undefined,
			claim: str(c.claim),
			celex: str(c.celex) || null,
			eli: str(c.eli) || null,
			title: str(c.title),
			sourceUrl: str(c.sourceUrl) || null,
			snippet: str(c.snippet),
			locator: str(c.locator),
			supportsClaim: c.supportsClaim !== false
		})),
		riskSignals: risks.map((r) => ({
			category: str(r.category) as 'hallucination',
			severity: str(r.severity) as 'low',
			rationale: str(r.rationale),
			confidence: clamp(num(r.confidence, 0.7), 0, 1)
		}))
	};
	return { ok: true, value };
}

/**
 * Live ingestion of a new AI work product into the supervision queue.
 * Gated to the supervising lawyer.
 */
export const POST: RequestHandler = async ({ request, platform, locals }) => {
	// Only the supervising lawyer may submit AI work.
	if (!locals.user || !CAN_SUBMIT.has(locals.user.role)) {
		return json({ error: 'Only a supervising lawyer can submit work products.' }, { status: 403 });
	}

	let raw: Raw;
	try {
		raw = (await request.json()) as Raw;
	} catch {
		return json({ error: 'Invalid JSON.' }, { status: 400 });
	}

	const result = validate(raw);
	if (!result.ok) return json({ error: result.error }, { status: 400 });

	const db = dbFrom(platform);

	// Work must belong to an existing matter. The matter is authoritative for the
	// ref/name snapshot, so client-supplied matter text can never forge a grouping.
	if (!result.value.matterId) return json({ error: 'matterId is required.' }, { status: 400 });
	const matter = await getMatterHeader(db, result.value.matterId);
	if (!matter) return json({ error: 'Unknown matter.' }, { status: 400 });
	result.value.matterRef = matter.ref;
	result.value.matterName = matter.name;

	const id = await createWorkProduct(db, result.value);
	return json({ id }, { status: 201 });
};
