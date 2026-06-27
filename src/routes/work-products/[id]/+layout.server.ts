import { dbFrom } from '$lib/server/db/client';
import { getClaimAssessment, getWorkProductHeader } from '$lib/server/db/queries';
import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

// Shared across the Summary tab (/work-products/[id]) and the Work area tab
// (/work-products/[id]/workspace): the header, the per-claim assessment roll-up
// (so the header confidence reflects the claims actually studied, not the seed
// constant), and the signed-in user.
export const load: LayoutServerLoad = async ({ params, platform, locals }) => {
	const db = dbFrom(platform);
	const [wp, assessed] = await Promise.all([
		getWorkProductHeader(db, params.id),
		getClaimAssessment(db, params.id)
	]);
	if (!wp) throw error(404, 'Work product not found');
	return { wp, assessed, user: locals.user };
};
