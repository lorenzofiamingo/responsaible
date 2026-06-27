/**
 * Tamper-evident audit chain.
 *
 * Every supervisory action is hashed over the previous action's hash, forming a
 * chain: hash = sha256(prevHash | workProductId | actorEmail | action | reason |
 * createdAt). The genesis link uses GENESIS_HASH. `/api/audit/verify` recomputes
 * the whole chain to prove no row was altered or removed.
 *
 * The exact input format here MUST match scripts/load-seed.mjs so seeded history
 * and live actions form one continuous, verifiable chain.
 */

export const GENESIS_HASH = '0'.repeat(64);

export interface ChainFields {
	workProductId: string;
	actorEmail: string;
	action: string;
	reason: string;
	createdAt: string;
}

/** Canonical pre-image for one link. Field order and separator are load-bearing. */
export function auditInput(prevHash: string, r: ChainFields): string {
	return [prevHash, r.workProductId, r.actorEmail, r.action, r.reason, r.createdAt].join('|');
}

export async function sha256Hex(input: string): Promise<string> {
	const data = new TextEncoder().encode(input);
	const digest = await crypto.subtle.digest('SHA-256', data);
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function computeHash(prevHash: string, r: ChainFields): Promise<string> {
	return sha256Hex(auditInput(prevHash, r));
}

export interface VerifyResult {
	ok: boolean;
	length: number;
	/** Index of the first row that fails (chain break or altered content), else null. */
	brokenAt: number | null;
	reason: string | null;
}

/**
 * Recompute the chain over rows ordered oldest-first. Detects both a broken
 * `prevHash` link (a row removed/reordered) and altered row content (hash mismatch).
 */
export async function verifyChain(
	rows: Array<ChainFields & { prevHash: string; hash: string }>
): Promise<VerifyResult> {
	let prev = GENESIS_HASH;
	for (let i = 0; i < rows.length; i++) {
		const r = rows[i];
		if (r.prevHash !== prev) {
			return { ok: false, length: rows.length, brokenAt: i, reason: 'broken link (prevHash mismatch)' };
		}
		const expected = await computeHash(prev, r);
		if (expected !== r.hash) {
			return { ok: false, length: rows.length, brokenAt: i, reason: 'altered content (hash mismatch)' };
		}
		prev = r.hash;
	}
	return { ok: true, length: rows.length, brokenAt: null, reason: null };
}
