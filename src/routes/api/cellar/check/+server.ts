import { resolveCelex } from '$lib/server/cellar';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const MAX = 20;

/**
 * Stateless CELLAR check used during document intake — BEFORE a work product is
 * persisted. Resolves a list of CELEX ids and returns their verify status, with
 * no DB write (unlike /api/cellar/verify, which operates on a saved product).
 * KV-cached via resolveCelex; network failures resolve to `unchecked` (never
 * penalised), so it degrades cleanly offline.
 */
export const POST: RequestHandler = async ({ request, platform, locals }) => {
	if (!locals.user) return json({ error: 'Authentication required.' }, { status: 401 });

	const body = (await request.json().catch(() => ({}))) as { celexes?: unknown };
	const list = Array.isArray(body.celexes) ? body.celexes : [];
	const celexes = [...new Set(list.filter((c): c is string => typeof c === 'string' && c.trim().length > 0).map((c) => c.trim().toUpperCase()))].slice(0, MAX);

	const kv = platform?.env?.KV;
	// Resolve concurrently: bounds total latency to a single CELLAR timeout instead
	// of MAX × timeout (a cold cache + slow CELLAR would otherwise hang for minutes).
	const results = await Promise.all(
		celexes.map(async (celex) => {
			const r = await resolveCelex(celex, kv);
			return { celex, status: r.status, httpStatus: r.httpStatus };
		})
	);

	const summary = {
		verified: results.filter((r) => r.status === 'verified').length,
		unresolved: results.filter((r) => r.status === 'unresolved').length,
		unchecked: results.filter((r) => r.status === 'unchecked').length
	};
	return json({ summary, results });
};
