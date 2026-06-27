import { dbFrom } from '$lib/server/db/client';
import { augmentQueue, getQueue } from '$lib/server/db/queries';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform, locals }) => {
	const db = dbFrom(platform);
	const queue = await augmentQueue(db, await getQueue(db));

	const stats = {
		total: queue.length,
		pending: queue.filter((q) => q.status === 'pending').length,
		highRisk: queue.filter((q) => q.risk.high > 0).length,
		lowConfidence: queue.filter((q) => q.effConfidence < 0.6).length
	};

	return { queue, stats, user: locals.user };
};
