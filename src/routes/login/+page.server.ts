import { DEMO_USERS, ensureDemoUsers } from '$lib/server/demo-users';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform, locals }) => {
	if (locals.user) throw redirect(302, '/');
	// Make sure the demo accounts exist (Better Auth hashes the passwords at runtime).
	await ensureDemoUsers(platform!.env);
	return {
		demoUsers: DEMO_USERS.map(({ email, name, role }) => ({ email, name, role })),
		demoPassword: 'demo1234'
	};
};
