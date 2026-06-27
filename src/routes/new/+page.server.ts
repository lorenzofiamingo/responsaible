import { CAN_SUBMIT } from '$lib/format';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	// Only roles that may submit AI work can reach the form.
	if (!locals.user || !CAN_SUBMIT.has(locals.user.role)) throw redirect(302, '/');
	return { user: locals.user };
};
