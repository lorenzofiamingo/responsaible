import { CAN_SUBMIT } from '$lib/format';
import { dbFrom } from '$lib/server/db/client';
import { deleteFirmKnowledge } from '$lib/server/db/queries';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Remove one document from the firm's private corpus. Gated to the supervising
 * lawyer, matching the create endpoint. 404 if it is already gone.
 */
export const DELETE: RequestHandler = async ({ params, platform, locals }) => {
	if (!locals.user || !CAN_SUBMIT.has(locals.user.role)) {
		return json({ error: 'Only a supervising lawyer can delete firm knowledge.' }, { status: 403 });
	}

	const db = dbFrom(platform);
	const ok = await deleteFirmKnowledge(db, params.id);
	if (!ok) return json({ error: 'Document not found.' }, { status: 404 });
	return json({ ok: true });
};
