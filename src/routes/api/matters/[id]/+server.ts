import { CAN_SUBMIT } from '$lib/format';
import { dbFrom } from '$lib/server/db/client';
import { deleteMatter } from '$lib/server/db/queries';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Delete a matter, cascading to every work product filed under it (each with its
 * own children). The insert-only supervisory audit chain is preserved — see
 * deleteMatter. Gated to the supervising lawyer; 404 if the matter is already gone.
 */
export const DELETE: RequestHandler = async ({ params, platform, locals }) => {
	if (!locals.user || !CAN_SUBMIT.has(locals.user.role)) {
		return json({ error: 'Only a supervising lawyer can delete matters.' }, { status: 403 });
	}

	const db = dbFrom(platform);
	const removed = await deleteMatter(db, params.id);
	if (removed < 0) return json({ error: 'Matter not found.' }, { status: 404 });
	return json({ ok: true, workProductsRemoved: removed });
};
