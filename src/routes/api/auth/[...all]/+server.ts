import { getAuth } from '$lib/server/auth';
import type { RequestHandler } from './$types';

// Better Auth owns every /api/auth/* request. Reuse the hook-built instance, or
// build one from the per-request platform env.
const handler: RequestHandler = ({ request, platform, locals }) => {
	const auth = locals.auth ?? getAuth(platform!.env);
	return auth.handler(request);
};

export const GET = handler;
export const POST = handler;
