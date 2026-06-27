import { CAN_SUPERVISE, REASON_REQUIRED } from '$lib/format';
import { computeHash } from '$lib/server/audit';
import { dbFrom } from '$lib/server/db/client';
import { getClaims, getLastHash, getWorkProduct } from '$lib/server/db/queries';
import { supervisoryAction, workProduct } from '$lib/server/db/schema';
import { error, fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

const ALLOWED = ['approve', 'amend', 'reject', 'request_rework', 'escalate', 'override'];

const STATUS_FOR_ACTION: Record<
	string,
	'approved' | 'amended' | 'rejected' | 'rework' | 'escalated'
> = {
	approve: 'approved',
	amend: 'amended',
	reject: 'rejected',
	request_rework: 'rework',
	escalate: 'escalated',
	override: 'amended'
};

export const load: PageServerLoad = async ({ params, platform, locals }) => {
	const db = dbFrom(platform);
	const data = await getWorkProduct(db, params.id);
	if (!data) throw error(404, 'Work product not found');
	const claims = await getClaims(db, params.id);
	// `wp` + `user` come from the shared +layout.server.ts.
	return {
		actions: data.actions,
		citations: data.citations,
		risks: data.risks,
		audit: data.audit,
		claims,
		user: locals.user
	};
};

export const actions: Actions = {
	act: async ({ request, params, platform, locals }) => {
		if (!locals.user || !CAN_SUPERVISE.has(locals.user.role)) {
			return fail(403, {
				error: 'Only a supervising lawyer can record supervisory actions.',
				action: ''
			});
		}
		const db = dbFrom(platform);
		const fd = await request.formData();
		const action = String(fd.get('action') ?? '');
		const reason = String(fd.get('reason') ?? '').trim();

		if (!ALLOWED.includes(action)) {
			return fail(400, { error: 'Choose a supervisory action.', action });
		}
		if (REASON_REQUIRED.has(action) && reason.length === 0) {
			return fail(400, {
				error: `A written reason is required to ${action.replace('_', ' ')}.`,
				action
			});
		}

		const exists = await db
			.select({ id: workProduct.id })
			.from(workProduct)
			.where(eq(workProduct.id, params.id))
			.get();
		if (!exists) return fail(404, { error: 'Work product not found.', action });

		// Append to the global, insert-only, hash-chained audit ledger.
		const createdAt = new Date().toISOString();
		const fields = {
			workProductId: params.id,
			actorEmail: locals.actorEmail,
			action,
			reason,
			createdAt
		};
		const prevHash = await getLastHash(db);
		const hash = await computeHash(prevHash, fields);

		await db.insert(supervisoryAction).values({
			id: `sa_${crypto.randomUUID()}`,
			...fields,
			// `action` is validated against ALLOWED above, so this narrowing is safe.
			action: action as 'approve' | 'amend' | 'reject' | 'request_rework' | 'escalate' | 'override',
			prevHash,
			hash
		});

		await db
			.update(workProduct)
			.set({ status: STATUS_FOR_ACTION[action] })
			.where(eq(workProduct.id, params.id));

		return { success: true, action };
	}
};
