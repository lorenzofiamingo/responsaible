import { dbFrom } from '$lib/server/db/client';
import { getMatters } from '$lib/server/db/queries';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform, locals }) => {
	const db = dbFrom(platform);
	const matters = await getMatters(db);

	const stats = {
		total: matters.length,
		open: matters.filter((m) => m.matter.status === 'open').length,
		highRisk: matters.filter((m) => m.risk.high > 0).length,
		pending: matters.filter((m) => m.pending > 0).length
	};

	return { matters, stats, user: locals.user };
};
