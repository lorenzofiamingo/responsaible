import { CAN_SUBMIT } from '$lib/format';
import { dbFrom } from '$lib/server/db/client';
import { createMatter } from '$lib/server/db/queries';
import { matter } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

type Raw = Record<string, unknown>;
const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback);

/**
 * Create a matter. Gated to the supervising lawyer. A `ref` is unique — a clash
 * returns 409 (not 500) so the New-matter form can show a clean message.
 */
export const POST: RequestHandler = async ({ request, platform, locals }) => {
	if (!locals.user || !CAN_SUBMIT.has(locals.user.role)) {
		return json({ error: 'Only a supervising lawyer can create matters.' }, { status: 403 });
	}

	let raw: Raw;
	try {
		raw = (await request.json()) as Raw;
	} catch {
		return json({ error: 'Invalid JSON.' }, { status: 400 });
	}

	const name = str(raw.name).trim();
	const ref = str(raw.ref).trim();
	if (!name) return json({ error: 'A matter name is required.' }, { status: 400 });
	if (!ref) return json({ error: 'A matter reference is required.' }, { status: 400 });

	const db = dbFrom(platform);
	const existing = await db.select({ id: matter.id }).from(matter).where(eq(matter.ref, ref)).get();
	if (existing) {
		return json({ error: `A matter with reference ${ref} already exists.` }, { status: 409 });
	}

	try {
		const id = await createMatter(db, {
			ref,
			name,
			client: str(raw.client).trim(),
			description: str(raw.description).trim(),
			status: str(raw.status) === 'closed' ? 'closed' : 'open'
		});
		return json({ id }, { status: 201 });
	} catch {
		// Unique-ref collision that raced past the pre-check → 409, not 500.
		return json({ error: `A matter with reference ${ref} already exists.` }, { status: 409 });
	}
};
