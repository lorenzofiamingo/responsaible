// Manual per-claim verdict override.
//
// The supervisor can override the AI's verdict on a single atomic claim by hand.
// The override is persisted on the (mutable) claim row AND appended to the global,
// insert-only, sha256 hash-chained audit ledger as an `override` action — so the
// supervisory judgment is as defensible as the document-level sign-offs.
//
// Unlike the document-level `override` form action, this does NOT change the work
// product's status: a claim-level judgment is not a sign-off on the whole product.

import { CAN_SUPERVISE, VERDICT } from '$lib/format';
import { computeHash } from '$lib/server/audit';
import { dbFrom } from '$lib/server/db/client';
import { getClaim, getLastHash, recordClaimReview } from '$lib/server/db/queries';
import { supervisoryAction } from '$lib/server/db/schema';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const VERDICTS = new Set(['supported', 'weak', 'unsupported', 'flag']);

interface ReviewRequest {
	/** A verdict to set, or null to clear the override. */
	verdict?: 'supported' | 'weak' | 'unsupported' | 'flag' | null;
	note?: string;
}

export const POST: RequestHandler = async ({ request, params, platform, locals }) => {
	if (!locals.user || !CAN_SUPERVISE.has(locals.user.role)) {
		return json({ error: 'Only a supervising lawyer can override a claim verdict.' }, { status: 403 });
	}

	const db = dbFrom(platform);
	const body = (await request.json().catch(() => ({}))) as ReviewRequest;

	const verdict = body.verdict ?? null;
	if (verdict !== null && !VERDICTS.has(verdict)) {
		return json({ error: 'Invalid verdict.' }, { status: 400 });
	}
	const note = String(body.note ?? '').trim();

	// The claim must exist and belong to this work product.
	const claim = await getClaim(db, params.claimId);
	if (!claim || claim.workProductId !== params.id) {
		return json({ error: 'Claim not found for this work product.' }, { status: 404 });
	}

	const reviewedAt = new Date().toISOString();
	await recordClaimReview(db, params.claimId, {
		verdict,
		note,
		reviewedBy: locals.actorEmail,
		reviewedAt
	});

	// Append the override to the hash chain. The reason is always meaningful so the
	// ledger reads cleanly even when the supervisor left the note blank.
	const reason =
		verdict === null
			? `Cleared the manual verdict on claim ${claim.idx + 1}.${note ? ` ${note}` : ''}`
			: `Claim ${claim.idx + 1} verdict overridden to ${VERDICT[verdict]?.label ?? verdict}.${
					note ? ` ${note}` : ''
				}`;
	const fields = {
		workProductId: params.id,
		actorEmail: locals.actorEmail,
		action: 'override' as const,
		reason,
		createdAt: reviewedAt
	};
	const prevHash = await getLastHash(db);
	const hash = await computeHash(prevHash, fields);
	await db.insert(supervisoryAction).values({
		id: `sa_${crypto.randomUUID()}`,
		...fields,
		prevHash,
		hash
	});

	return json({
		ok: true,
		review:
			verdict === null
				? { verdict: null, note: '', reviewedBy: null, reviewedAt: null }
				: { verdict, note, reviewedBy: locals.actorEmail, reviewedAt }
	});
};
