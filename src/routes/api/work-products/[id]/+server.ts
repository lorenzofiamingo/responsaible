import { CAN_SUBMIT } from '$lib/format';
import { dbFrom } from '$lib/server/db/client';
import { deleteWorkProduct } from '$lib/server/db/queries';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Delete a work product and all of its generated children (trace, citations,
 * risks, claims, edges). The insert-only supervisory audit chain is preserved —
 * see deleteWorkProduct. Gated to the supervising lawyer; 404 if already gone.
 */
export const DELETE: RequestHandler = async ({ params, platform, locals }) => {
	if (!locals.user || !CAN_SUBMIT.has(locals.user.role)) {
		return json({ error: 'Only a supervising lawyer can delete work products.' }, { status: 403 });
	}

	const db = dbFrom(platform);
	const ok = await deleteWorkProduct(db, params.id);
	if (!ok) return json({ error: 'Work product not found.' }, { status: 404 });
	return json({ ok: true });
};
