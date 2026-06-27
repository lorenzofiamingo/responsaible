import { CAN_SUBMIT } from '$lib/format';
import { redirect } from '@sveltejs/kit';
import { dbFrom } from '$lib/server/db/client';
import { getMatterHeader } from '$lib/server/db/queries';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url, platform }) => {
	// Only roles that may submit AI work can reach the form.
	if (!locals.user || !CAN_SUBMIT.has(locals.user.role)) throw redirect(302, '/');

	// Work is always filed under a matter. Without a valid ?matter, send the user
	// back to the matters list to pick (or create) one first.
	const matterId = url.searchParams.get('matter');
	if (!matterId) throw redirect(303, '/');
	const db = dbFrom(platform);
	const matter = await getMatterHeader(db, matterId);
	if (!matter) throw redirect(303, '/');

	return { user: locals.user, matter };
};
