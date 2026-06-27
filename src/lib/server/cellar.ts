import type { KVNamespace } from '@cloudflare/workers-types';

/**
 * EU CELLAR citation verification.
 *
 * A citation is "verified" when its CELEX resolves to a real Work in the EU
 * Publications Office repository. We hit the public REST resolver and read the
 * HTTP status: 200 → the act exists; 4xx → it does not (a likely hallucination).
 * Results are cached in KV — CELLAR documents are immutable per CELEX, so we can
 * cache aggressively and keep live calls off the hot path. No auth/key required.
 */

const RESOURCE = 'http://publications.europa.eu/resource/celex/';
const UA = 'ItailyResponsable/0.1 (Hack the Law supervision console)';
const KV_PREFIX = 'cellar:celex:';
const TTL_SECONDS = 60 * 60 * 24; // 24h
const TIMEOUT_MS = 12_000;

export type VerifyStatus = 'verified' | 'unresolved' | 'unchecked';

export interface CelexResolution {
	celex: string;
	status: VerifyStatus;
	httpStatus: number | null;
	checkedAt: string;
}

/** Build a CELEX from a human regulation/directive citation, e.g. ("reg","2016","679") → 32016R0679. */
export function buildCelex(kind: 'reg' | 'dir' | 'dec', year: string, num: string): string {
	const letter = kind === 'reg' ? 'R' : kind === 'dir' ? 'L' : 'D';
	return `3${year}${letter}${num.padStart(4, '0')}`;
}

function nowIso(): string {
	return new Date().toISOString();
}

/** Resolve one CELEX against CELLAR, KV-cached. Network errors return `unchecked` (never penalise). */
export async function resolveCelex(celex: string, kv?: KVNamespace): Promise<CelexResolution> {
	const key = KV_PREFIX + celex;
	if (kv) {
		const cached = (await kv.get(key, 'json')) as CelexResolution | null;
		if (cached) return cached;
	}

	let result: CelexResolution;
	try {
		const res = await fetch(RESOURCE + encodeURIComponent(celex), {
			method: 'GET',
			headers: {
				Accept: 'application/xml; notice=identifiers',
				'Accept-Language': 'en',
				'User-Agent': UA
			},
			redirect: 'follow',
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
		// Drain the body so the connection can be reused/closed.
		await res.text().catch(() => undefined);

		if (res.status === 200) {
			result = { celex, status: 'verified', httpStatus: 200, checkedAt: nowIso() };
		} else if (res.status >= 400 && res.status < 500) {
			result = { celex, status: 'unresolved', httpStatus: res.status, checkedAt: nowIso() };
		} else {
			// 5xx / unexpected — treat as inconclusive, don't cache.
			return { celex, status: 'unchecked', httpStatus: res.status, checkedAt: nowIso() };
		}
	} catch {
		return { celex, status: 'unchecked', httpStatus: null, checkedAt: nowIso() };
	}

	if (kv) await kv.put(key, JSON.stringify(result), { expirationTtl: TTL_SECONDS });
	return result;
}
