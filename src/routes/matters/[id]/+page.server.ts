import { error } from '@sveltejs/kit';
import { dbFrom } from '$lib/server/db/client';
import { getMatter } from '$lib/server/db/queries';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, platform, locals }) => {
	const db = dbFrom(platform);
	const data = await getMatter(db, params.id);
	if (!data) throw error(404, 'Matter not found');
	return { matter: data.matter, queue: data.queue, user: locals.user };
};
