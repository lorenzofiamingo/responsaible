import { KNOWLEDGE_CATEGORY_ORDER } from '$lib/format';
import { dbFrom } from '$lib/server/db/client';
import { listFirmKnowledge } from '$lib/server/db/queries';
import type { PageServerLoad } from './$types';

// The firm's private corpus is FIRM-LEVEL — one shared library across every matter.
// Browse is open to any signed-in user (like the queue); only adding is gated.
export const load: PageServerLoad = async ({ platform, locals }) => {
	const db = dbFrom(platform);
	const docs = await listFirmKnowledge(db);

	const byCategory = Object.fromEntries(
		KNOWLEDGE_CATEGORY_ORDER.map((c) => [c, docs.filter((d) => d.category === c).length])
	) as Record<(typeof KNOWLEDGE_CATEGORY_ORDER)[number], number>;

	return { docs, stats: { total: docs.length, ...byCategory }, user: locals.user };
};
