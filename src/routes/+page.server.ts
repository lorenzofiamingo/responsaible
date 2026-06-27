import { dbFrom } from '$lib/server/db/client';
import { getClaimAssessments, getQueue } from '$lib/server/db/queries';
import { citation, riskSignal } from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform, locals }) => {
	const db = dbFrom(platform);
	const items = await getQueue(db);
	const risks = await db.select().from(riskSignal).all();
	const cits = await db.select({ wp: citation.workProductId }).from(citation).all();
	const assessMap = await getClaimAssessments(db);

	const riskMap = new Map<string, { high: number; med: number; low: number; total: number }>();
	for (const r of risks) {
		const e = riskMap.get(r.workProductId) ?? { high: 0, med: 0, low: 0, total: 0 };
		e.total++;
		if (r.severity === 'high') e.high++;
		else if (r.severity === 'med') e.med++;
		else e.low++;
		riskMap.set(r.workProductId, e);
	}
	const citMap = new Map<string, number>();
	for (const c of cits) citMap.set(c.wp, (citMap.get(c.wp) ?? 0) + 1);

	const queue = items.map((wp) => {
		const assessed = assessMap.get(wp.id) ?? { total: 0, analyzed: 0, mean: null };
		return {
			...wp,
			risk: riskMap.get(wp.id) ?? { high: 0, med: 0, low: 0, total: 0 },
			citationCount: citMap.get(wp.id) ?? 0,
			assessed,
			// Effective confidence for triage: the verified per-claim mean once any
			// claim is analyzed, else the generator's self-reported prior. Keeps the
			// "lowest confidence first" queue working before any claim is run.
			effConfidence: assessed.mean ?? wp.confidence
		};
	});

	const stats = {
		total: queue.length,
		pending: queue.filter((q) => q.status === 'pending').length,
		highRisk: queue.filter((q) => q.risk.high > 0).length,
		lowConfidence: queue.filter((q) => q.effConfidence < 0.6).length
	};

	return { queue, stats, user: locals.user };
};
