import { CAN_SUBMIT } from '$lib/format';
import { dbFrom } from '$lib/server/db/client';
import { getWorkProductHeader } from '$lib/server/db/queries';
import { extractKnowledgeHeuristic } from '$lib/server/extract/knowledge';
import type { ExtractedKnowledge } from '$lib/types';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url, platform }) => {
	// Only the supervising lawyer can add to the corpus.
	if (!locals.user || !CAN_SUBMIT.has(locals.user.role)) throw redirect(302, '/knowledge');

	// Promote path: ?from=<workProductId> pre-fills the review form from an existing
	// work product (from ANY matter — the corpus is firm-level). We run the extractor
	// on its body so category/tags auto-derive and inline [n] markers are stripped
	// (normalize), but keep the work product's own curated title/summary.
	const fromId = url.searchParams.get('from');
	if (fromId) {
		const db = dbFrom(platform);
		const wp = await getWorkProductHeader(db, fromId);
		if (wp) {
			const seed: ExtractedKnowledge = extractKnowledgeHeuristic(wp.body, {
				sourceKind: 'work_product',
				promotedFrom: { workProductId: wp.id, matterRef: wp.matterRef, title: wp.title }
			});
			seed.title = wp.title;
			if (wp.summary?.trim()) seed.summary = wp.summary.trim();
			return { user: locals.user, seed, fromWp: { id: wp.id, title: wp.title, matterName: wp.matterName } };
		}
	}

	return { user: locals.user, seed: null, fromWp: null };
};
