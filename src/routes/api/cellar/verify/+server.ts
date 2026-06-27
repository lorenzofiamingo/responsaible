import { dbFrom } from '$lib/server/db/client';
import { citation } from '$lib/server/db/schema';
import { resolveCelex } from '$lib/server/cellar';
import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

/**
 * Live-verify a work product's citations against EU CELLAR. Resolves each CELEX,
 * writes the verify_status back to D1 (so it persists), and returns the per-citation
 * verdicts. Sequential (concurrency < 5) and KV-cached to respect CELLAR's limits.
 */
export const POST: RequestHandler = async ({ request, platform }) => {
	const db = dbFrom(platform);
	const kv = platform?.env?.KV;

	const body = (await request.json().catch(() => ({}))) as { workProductId?: string };
	const workProductId = body.workProductId;
	if (!workProductId) {
		return json({ error: 'workProductId required' }, { status: 400 });
	}

	const cits = await db.select().from(citation).where(eq(citation.workProductId, workProductId)).all();

	const results: Array<{ id: string; celex: string | null; status: string }> = [];
	for (const c of cits) {
		if (!c.celex) {
			results.push({ id: c.id, celex: null, status: 'unchecked' });
			continue;
		}
		const r = await resolveCelex(c.celex, kv);
		await db
			.update(citation)
			.set({
				verifyStatus: r.status,
				verified: r.status === 'verified',
				verifiedAt: r.checkedAt
			})
			.where(eq(citation.id, c.id));
		results.push({ id: c.id, celex: c.celex, status: r.status });
	}

	const summary = {
		verified: results.filter((r) => r.status === 'verified').length,
		unresolved: results.filter((r) => r.status === 'unresolved').length,
		unchecked: results.filter((r) => r.status === 'unchecked').length
	};
	return json({ workProductId, summary, results });
};
