import { asc, desc, eq } from 'drizzle-orm';
import { GENESIS_HASH } from '../audit';
import type { DB } from './client';
import { agentAction, citation, riskSignal, supervisoryAction, workProduct } from './schema';

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

/** The whole audit ledger, oldest-first — the chain to verify. */
export async function getAllAudit(db: DB) {
	return db.select().from(supervisoryAction).orderBy(asc(supervisoryAction.createdAt)).all();
}

/** Tip of the global hash chain (or genesis when empty) — the next action's prevHash. */
export async function getLastHash(db: DB): Promise<string> {
	const rows = await getAllAudit(db);
	return rows.length ? rows[rows.length - 1].hash : GENESIS_HASH;
}
