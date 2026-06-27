import { building } from '$app/environment';
import { getAuth } from '$lib/server/auth';
import type { Handle } from '@sveltejs/kit';

// Paths reachable without a session.
const isPublic = (path: string) => path === '/login' || path.startsWith('/api/auth');

export const handle: Handle = async ({ event, resolve }) => {
	if (building) return resolve(event);

	// Per-request Better Auth instance, stashed for the catch-all route to reuse.
	const auth = getAuth(event.platform!.env);
	event.locals.auth = auth;

	const res = await auth.api.getSession({ headers: event.request.headers });
	event.locals.user = res?.user ?? null;
	event.locals.session = res?.session ?? null;
	event.locals.actorEmail = res?.user?.email ?? '';

	// Everything except /login and /api/auth requires a session.
	if (!event.locals.user && !isPublic(event.url.pathname)) {
		return new Response(null, { status: 302, headers: { location: '/login' } });
	}

	return resolve(event);
};
