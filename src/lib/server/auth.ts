import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import * as authSchema from './db/auth-schema';
import { getDb } from './db/client';

// Dev fallback so the app runs with zero config locally. In production set a real
// BETTER_AUTH_SECRET (e.g. `wrangler secret put BETTER_AUTH_SECRET`).
const DEV_SECRET = 'itaily-oversight-dev-secret-change-in-production';

/**
 * Per-request Better Auth factory. On Cloudflare Workers the D1 binding and the
 * secret only exist on `platform.env`, so we build the instance per request and
 * stash it on `event.locals` (see hooks.server.ts). Do NOT hoist to module scope.
 */
export function getAuth(env: App.Platform['env']) {
	const db = getDb(env.DB);
	const baseURL = env.BETTER_AUTH_URL ?? 'http://localhost:5173';
	const secret = env.BETTER_AUTH_SECRET ?? DEV_SECRET;

	return betterAuth({
		secret,
		baseURL,
		basePath: '/api/auth',
		// Prod stays strict (only baseURL is trusted). In local dev we also trust the
		// request's own localhost origin, so the app works on any port (5173, a
		// preview's auto-assigned port, etc.) without reconfiguring BETTER_AUTH_URL.
		trustedOrigins: (request) => {
			const origin = request?.headers?.get('origin');
			if (origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return [origin];
			return [];
		},
		database: drizzleAdapter(db, { provider: 'sqlite', schema: authSchema }),
		emailAndPassword: {
			enabled: true,
			requireEmailVerification: false,
			autoSignIn: false,
			minPasswordLength: 8
		},
		user: {
			additionalFields: {
				// operator | supervisor | admin. input:false → clients can't self-assign.
				role: { type: 'string', input: false, defaultValue: 'operator' }
			}
		},
		advanced: {
			defaultCookieAttributes: {
				sameSite: 'lax',
				// No `secure` on plain-HTTP localhost, or the session cookie won't stick.
				secure: !baseURL.startsWith('http://localhost')
			}
		}
	});
}

export type Auth = ReturnType<typeof getAuth>;
