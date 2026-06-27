import { asc, desc, eq, sql } from 'drizzle-orm';
import { GENESIS_HASH } from '../audit';
import { deriveClaims } from '../claims';
import type { DB } from './client';
import {
	agentAction,
	atomicClaim,
	citation,
	claimEdge,
	firmKnowledge,
	matter,
	riskSignal,
	supervisoryAction,
	workProduct
} from './schema';
import type { AtomicClaim, Matter, WorkProduct } from './schema';
import type { QueueRowData } from '$lib/types';

/** Queue ordering: most urgent first (priority desc), then least confident first. */
export async function getQueue(db: DB) {
	return db
		.select()
		.from(workProduct)
		.orderBy(desc(workProduct.priority), asc(workProduct.confidence))
		.all();
}

export async function getWorkProduct(db: DB, id: string) {
	const wp = await db.select().from(workProduct).where(eq(workProduct.id, id)).get();
	if (!wp) return null;
	const [actions, citations, risks, audit] = await Promise.all([
		db
			.select()
			.from(agentAction)
			.where(eq(agentAction.workProductId, id))
			.orderBy(asc(agentAction.step))
			.all(),
		db
			.select()
			.from(citation)
			.where(eq(citation.workProductId, id))
			.orderBy(asc(citation.marker))
			.all(),
		db.select().from(riskSignal).where(eq(riskSignal.workProductId, id)).all(),
		db
			.select()
			.from(supervisoryAction)
			.where(eq(supervisoryAction.workProductId, id))
			.orderBy(asc(supervisoryAction.createdAt))
			.all()
	]);
	return { wp, actions, citations, risks, audit };
}

/** Just the work-product header row (for the shared [id] layout). */
export async function getWorkProductHeader(db: DB, id: string) {
	return db.select().from(workProduct).where(eq(workProduct.id, id)).get();
}

/** The atomic claims for a work product, in document order. */
export async function getClaims(db: DB, workProductId: string) {
	return db
		.select()
		.from(atomicClaim)
		.where(eq(atomicClaim.workProductId, workProductId))
		.orderBy(asc(atomicClaim.idx))
		.all();
}

/**
 * Document-level confidence under per-claim supervision: the mean confidence of
 * the claims actually analyzed so far. `mean` is null until at least one claim
 * has been run — there is no honest single number before the supervisor studies
 * the document claim by claim. (The work product's seeded `confidence` is only
 * the generator's self-reported prior, used for queue triage — not a verdict.)
 */
export async function getClaimAssessment(db: DB, workProductId: string) {
	const row = await db
		.select({
			total: sql<number>`count(*)`,
			analyzed: sql<number>`sum(case when ${atomicClaim.status} = 'analyzed' then 1 else 0 end)`,
			sumConf: sql<number>`sum(case when ${atomicClaim.status} = 'analyzed' then ${atomicClaim.confidence} else 0 end)`
		})
		.from(atomicClaim)
		.where(eq(atomicClaim.workProductId, workProductId))
		.get();
	const total = Number(row?.total ?? 0);
	const analyzed = Number(row?.analyzed ?? 0);
	const mean = analyzed > 0 ? Number(row?.sumConf ?? 0) / analyzed : null;
	return { total, analyzed, mean };
}

export interface ClaimAssessment {
	total: number;
	analyzed: number;
	mean: number | null;
}

/**
 * The same per-claim assessment as {@link getClaimAssessment}, but for EVERY work
 * product in one grouped pass — for the home queue, so each row's confidence can
 * reflect the claims actually studied instead of the seeded prior.
 */
export async function getClaimAssessments(db: DB): Promise<Map<string, ClaimAssessment>> {
	const rows = await db
		.select({
			workProductId: atomicClaim.workProductId,
			total: sql<number>`count(*)`,
			analyzed: sql<number>`sum(case when ${atomicClaim.status} = 'analyzed' then 1 else 0 end)`,
			sumConf: sql<number>`sum(case when ${atomicClaim.status} = 'analyzed' then ${atomicClaim.confidence} else 0 end)`
		})
		.from(atomicClaim)
		.groupBy(atomicClaim.workProductId)
		.all();
	const map = new Map<string, ClaimAssessment>();
	for (const r of rows) {
		const total = Number(r.total);
		const analyzed = Number(r.analyzed);
		map.set(r.workProductId, { total, analyzed, mean: analyzed > 0 ? Number(r.sumConf) / analyzed : null });
	}
	return map;
}

/** One claim by id (the analyze endpoint's seeded-fallback read). */
export async function getClaim(db: DB, claimId: string) {
	return db.select().from(atomicClaim).where(eq(atomicClaim.id, claimId)).get();
}

/** The typed reasoning-graph edges between a work product's atomic claims. */
export async function getClaimEdges(db: DB, workProductId: string) {
	return db.select().from(claimEdge).where(eq(claimEdge.workProductId, workProductId)).all();
}

/** Fields written back to a claim after a (live or seeded-fallback) run. */
export type ClaimRunUpdate = Partial<
	Pick<
		AtomicClaim,
		| 'analysisSource'
		| 'presetUsed'
		| 'workGroupJson'
		| 'verdict'
		| 'analysisSummary'
		| 'confidence'
		| 'riskCategory'
		| 'riskSeverity'
		| 'riskRationale'
		| 'citationMarkers'
		| 'figureTrace'
		| 'ranAt'
		| 'supervisorInput'
	>
>;

/** Persist a claim's run result so it survives a reload. */
export async function recordClaimRun(db: DB, claimId: string, update: ClaimRunUpdate) {
	await db
		.update(atomicClaim)
		.set({ status: 'analyzed', ...update })
		.where(eq(atomicClaim.id, claimId));
}

/** The supervisor's manual verdict override on a claim (null verdict ⇒ cleared). */
export interface ClaimReviewUpdate {
	verdict: 'supported' | 'weak' | 'unsupported' | 'flag' | null;
	note: string;
	reviewedBy: string;
	reviewedAt: string;
}

/**
 * Persist a manual verdict override on a claim. Clearing (verdict === null) wipes
 * the note/by/at too. This is a mutable domain write; the caller ALSO appends the
 * override to the insert-only audit chain so the supervisory judgment is defensible.
 */
export async function recordClaimReview(db: DB, claimId: string, update: ClaimReviewUpdate) {
	await db
		.update(atomicClaim)
		.set(
			update.verdict === null
				? { reviewVerdict: null, reviewNote: '', reviewedBy: null, reviewedAt: null }
				: {
						reviewVerdict: update.verdict,
						reviewNote: update.note,
						reviewedBy: update.reviewedBy,
						reviewedAt: update.reviewedAt
					}
		)
		.where(eq(atomicClaim.id, claimId));
}

/** The whole audit ledger, oldest-first — the chain to verify. */
export async function getAllAudit(db: DB) {
	return db.select().from(supervisoryAction).orderBy(asc(supervisoryAction.createdAt)).all();
}

/** Tip of the global hash chain (or genesis when empty) — the next action's prevHash. */
export async function getLastHash(db: DB): Promise<string> {
	const rows = await getAllAudit(db);
	return rows.length ? rows[rows.length - 1].hash : GENESIS_HASH;
}

export interface NewWorkProductInput {
	type: 'draft' | 'memo' | 'opinion' | 'risk_analysis';
	title: string;
	summary?: string;
	body?: string;
	matterId?: string;
	matterRef?: string;
	matterName?: string;
	agentName?: string;
	priority?: number;
	confidence?: number;
	model?: string;
	trace?: Array<{
		step?: number;
		kind: 'search' | 'retrieve' | 'reason' | 'draft' | 'cite' | 'critique';
		actorAgent?: string;
		summary: string;
		detail?: Record<string, unknown> | null;
	}>;
	citations?: Array<{
		marker?: number;
		claim?: string;
		celex?: string | null;
		eli?: string | null;
		title?: string;
		sourceUrl?: string | null;
		snippet?: string;
		locator?: string;
		supportsClaim?: boolean;
	}>;
	riskSignals?: Array<{
		category: 'hallucination' | 'jurisdiction' | 'missing_authority' | 'conflict' | 'deadline';
		severity: 'low' | 'med' | 'high';
		rationale: string;
		confidence?: number;
	}>;
}

/**
 * Insert a new work product with its trace / citations / risk signals in one
 * atomic D1 batch. Live ingestion path (no DB reset) — the riskiest new item then
 * surfaces in the queue immediately. Returns the new work-product id.
 */
export async function createWorkProduct(db: DB, input: NewWorkProductInput): Promise<string> {
	const id = `wp_${crypto.randomUUID()}`;
	const createdAt = new Date().toISOString();

	const stmts: unknown[] = [
		db.insert(workProduct).values({
			id,
			type: input.type,
			title: input.title,
			summary: input.summary ?? '',
			body: input.body ?? '',
			matterId: input.matterId ?? '',
			matterRef: input.matterRef ?? '',
			matterName: input.matterName ?? '',
			agentName: input.agentName ?? '',
			status: 'pending',
			priority: input.priority ?? 0,
			confidence: input.confidence ?? 0,
			model: input.model ?? '',
			createdAt
		})
	];

	(input.trace ?? []).forEach((a, i) => {
		const step = a.step ?? i + 1;
		stmts.push(
			db.insert(agentAction).values({
				id: `${id}_a${step}`,
				workProductId: id,
				step,
				kind: a.kind,
				actorAgent: a.actorAgent ?? '',
				summary: a.summary,
				detail: a.detail ?? null,
				createdAt
			})
		);
	});

	(input.citations ?? []).forEach((c, i) => {
		const marker = c.marker ?? i + 1;
		stmts.push(
			db.insert(citation).values({
				id: `${id}_c${marker}`,
				workProductId: id,
				marker,
				claim: c.claim ?? '',
				celex: c.celex ?? null,
				eli: c.eli ?? null,
				title: c.title ?? '',
				sourceUrl: c.sourceUrl ?? null,
				snippet: c.snippet ?? '',
				locator: c.locator ?? '',
				supportsClaim: c.supportsClaim ?? true,
				verified: false,
				verifyStatus: 'unchecked',
				verifiedAt: null
			})
		);
	});

	(input.riskSignals ?? []).forEach((r, i) => {
		stmts.push(
			db.insert(riskSignal).values({
				id: `${id}_r${i + 1}`,
				workProductId: id,
				category: r.category,
				severity: r.severity,
				rationale: r.rationale,
				confidence: r.confidence ?? 0
			})
		);
	});

	// Atomic claims — split the body into verifiable units with a seeded baseline
	// analysis, the SAME way the offline seed does (scripts/load-seed.mjs). Without
	// this the document is ingested with zero claims and the workspace is empty:
	// the per-claim run reveals each claim's baseline as its offline fallback.
	for (const c of deriveClaims(input)) {
		const a = c.analysis;
		stmts.push(
			db.insert(atomicClaim).values({
				id: `${id}_claim${c.idx}`,
				workProductId: id,
				idx: c.idx,
				text: c.text,
				charStart: c.charStart,
				charEnd: c.charEnd,
				kind: c.kind,
				assignedPreset: c.assignedPreset,
				status: 'pending',
				analysisSource: null,
				presetUsed: '',
				workGroupJson: null,
				verdict: a.verdict,
				analysisSummary: a.summary,
				confidence: a.confidence,
				riskCategory: a.riskCategory,
				riskSeverity: a.riskSeverity,
				riskRationale: a.riskRationale,
				citationMarkers: c.citationMarkers,
				figureTrace: null,
				ranAt: null,
				createdAt
			})
		);
	}

	await db.batch(stmts as unknown as Parameters<typeof db.batch>[0]);
	return id;
}

// --- Matters -----------------------------------------------------------------

/**
 * Augment work products with the risk rollup, citation count and per-claim
 * assessment the queue and matter views render. One pass over the child tables so
 * the cross-matter queue and the per-matter list compute confidence identically.
 */
export async function augmentQueue(db: DB, items: WorkProduct[]): Promise<QueueRowData[]> {
	const [risks, cits, assessMap] = await Promise.all([
		db.select().from(riskSignal).all(),
		db.select({ wp: citation.workProductId }).from(citation).all(),
		getClaimAssessments(db)
	]);
	const riskMap = new Map<string, { high: number; med: number; low: number; total: number }>();
	for (const r of risks) {
		const e = riskMap.get(r.workProductId) ?? { high: 0, med: 0, low: 0, total: 0 };
		e.total++;
		if (r.severity === 'high') e.high++;
		else if (r.severity === 'med') e.med++;
		else e.low++;
		riskMap.set(r.workProductId, e);
	}
	const citMap = new Map<string, number>();
	for (const c of cits) citMap.set(c.wp, (citMap.get(c.wp) ?? 0) + 1);
	return items.map((wp) => {
		const assessed = assessMap.get(wp.id) ?? { total: 0, analyzed: 0, mean: null };
		// Effective confidence: the verified per-claim mean once any claim is run,
		// else the generator's self-reported prior — keeps "lowest confidence first".
		return {
			...wp,
			risk: riskMap.get(wp.id) ?? { high: 0, med: 0, low: 0, total: 0 },
			citationCount: citMap.get(wp.id) ?? 0,
			assessed,
			effConfidence: assessed.mean ?? wp.confidence
		};
	});
}

/** A matter with its rolled-up work-product stats — one matters-list card. */
export interface MatterCard {
	matter: Matter;
	count: number;
	pending: number;
	risk: { high: number; med: number; low: number; total: number };
	citationCount: number;
	/** Mean effective confidence across the matter's work products (null if none). */
	effConfidence: number | null;
	/** Lowest effective confidence in the matter — the item most needing a human. */
	lowestConfidence: number | null;
}

/** Every matter with rolled-up risk / confidence / pending counts — the home list. */
export async function getMatters(db: DB): Promise<MatterCard[]> {
	const [matters, rows] = await Promise.all([
		db.select().from(matter).orderBy(asc(matter.name)).all(),
		augmentQueue(db, await getQueue(db))
	]);
	const byMatter = new Map<string, QueueRowData[]>();
	for (const r of rows) {
		const list = byMatter.get(r.matterId) ?? [];
		list.push(r);
		byMatter.set(r.matterId, list);
	}
	return matters.map((m) => {
		const own = byMatter.get(m.id) ?? [];
		const risk = { high: 0, med: 0, low: 0, total: 0 };
		let citationCount = 0;
		let pending = 0;
		const confs: number[] = [];
		for (const w of own) {
			risk.high += w.risk.high;
			risk.med += w.risk.med;
			risk.low += w.risk.low;
			risk.total += w.risk.total;
			citationCount += w.citationCount;
			if (w.status === 'pending') pending++;
			confs.push(w.effConfidence);
		}
		return {
			matter: m,
			count: own.length,
			pending,
			risk,
			citationCount,
			effConfidence: confs.length ? confs.reduce((a, b) => a + b, 0) / confs.length : null,
			lowestConfidence: confs.length ? Math.min(...confs) : null
		};
	});
}

/** A matter and its work products (augmented, queue-ordered), or null if absent. */
export async function getMatter(db: DB, id: string) {
	const m = await db.select().from(matter).where(eq(matter.id, id)).get();
	if (!m) return null;
	const items = await db
		.select()
		.from(workProduct)
		.where(eq(workProduct.matterId, id))
		.orderBy(desc(workProduct.priority), asc(workProduct.confidence))
		.all();
	const queue = await augmentQueue(db, items);
	return { matter: m, queue };
}

/** Just the matter row — for the /new guard and the create API. */
export async function getMatterHeader(db: DB, id: string) {
	return db.select().from(matter).where(eq(matter.id, id)).get();
}

export interface NewMatterInput {
	ref: string;
	name: string;
	client?: string;
	description?: string;
	status?: 'open' | 'closed';
}

/** Create a matter; returns the new id. Caller enforces ref uniqueness (409). */
export async function createMatter(db: DB, input: NewMatterInput): Promise<string> {
	const id = `mat_${crypto.randomUUID()}`;
	await db.insert(matter).values({
		id,
		ref: input.ref,
		name: input.name,
		client: input.client ?? '',
		description: input.description ?? '',
		status: input.status ?? 'open',
		createdAt: new Date().toISOString()
	});
	return id;
}

// --- Firm knowledge ----------------------------------------------------------

export interface NewFirmKnowledgeInput {
	title: string;
	category: 'memo' | 'precedent' | 'playbook' | 'guidance';
	body?: string;
	/** Already comma-joined by the endpoint (the lexical ranker substring-matches it). */
	tags?: string;
	sourceRef?: string;
}

/**
 * Insert one firm-knowledge row (a single insert — no child tables, unlike
 * createWorkProduct). The corpus is FIRM-LEVEL: there is no matter scoping, so the
 * same document is shared across every matter. Returns the new id.
 */
export async function createFirmKnowledge(db: DB, input: NewFirmKnowledgeInput): Promise<string> {
	const id = `fk_${crypto.randomUUID()}`;
	await db.insert(firmKnowledge).values({
		id,
		title: input.title,
		category: input.category,
		body: input.body ?? '',
		tags: input.tags ?? '',
		sourceRef: input.sourceRef ?? '',
		createdAt: new Date().toISOString()
	});
	return id;
}

/** The whole firm corpus for the library view (newest first). */
export async function listFirmKnowledge(db: DB) {
	return db.select().from(firmKnowledge).orderBy(desc(firmKnowledge.createdAt)).all();
}
