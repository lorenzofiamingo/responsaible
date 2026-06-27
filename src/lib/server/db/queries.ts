import { asc, desc, eq } from 'drizzle-orm';
import { GENESIS_HASH } from '../audit';
import type { DB } from './client';
import {
	agentAction,
	atomicClaim,
	citation,
	riskSignal,
	supervisoryAction,
	workProduct
} from './schema';
import type { AtomicClaim } from './schema';

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

/** One claim by id (the analyze endpoint's seeded-fallback read). */
export async function getClaim(db: DB, claimId: string) {
	return db.select().from(atomicClaim).where(eq(atomicClaim.id, claimId)).get();
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
	>
>;

/** Persist a claim's run result so it survives a reload. */
export async function recordClaimRun(db: DB, claimId: string, update: ClaimRunUpdate) {
	await db
		.update(atomicClaim)
		.set({ status: 'analyzed', ...update })
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
	type: 'draft' | 'memo' | 'risk_analysis';
	title: string;
	summary?: string;
	body?: string;
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

	await db.batch(stmts as unknown as Parameters<typeof db.batch>[0]);
	return id;
}
