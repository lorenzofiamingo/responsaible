import { dbFrom } from '$lib/server/db/client';
import { getClaimEdges, getClaims } from '$lib/server/db/queries';
import { citation } from '$lib/server/db/schema';
import { asc, eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

// `wp` + `user` come from the shared +layout.server.ts.
export const load: PageServerLoad = async ({ params, platform }) => {
	const db = dbFrom(platform);
	const [claims, citations, edges] = await Promise.all([
		getClaims(db, params.id),
		db.select().from(citation).where(eq(citation.workProductId, params.id)).orderBy(asc(citation.marker)).all(),
		getClaimEdges(db, params.id)
	]);
	return { claims, citations, edges };
};
