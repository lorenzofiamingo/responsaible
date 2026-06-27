import { verifyChain } from '$lib/server/audit';
import { dbFrom } from '$lib/server/db/client';
import { getAllAudit } from '$lib/server/db/queries';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Recompute the entire supervisory-action hash chain and report whether it is
 * intact. Tampering with (or deleting) any row makes this fail at that index —
 * the live proof that the supervisory trail is tamper-evident.
 */
export const GET: RequestHandler = async ({ platform }) => {
	const db = dbFrom(platform);
	const rows = await getAllAudit(db);
	const result = await verifyChain(rows);
	return json(result);
};
