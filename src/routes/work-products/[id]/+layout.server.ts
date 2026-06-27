import { dbFrom } from '$lib/server/db/client';
import { getWorkProductHeader } from '$lib/server/db/queries';
import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

// Shared across the Summary tab (/work-products/[id]) and the Work area tab
// (/work-products/[id]/workspace): the header + the signed-in user.
export const load: LayoutServerLoad = async ({ params, platform, locals }) => {
	const db = dbFrom(platform);
	const wp = await getWorkProductHeader(db, params.id);
	if (!wp) throw error(404, 'Work product not found');
	return { wp, user: locals.user };
};
