import { eq } from 'drizzle-orm';
import { getAuth } from './auth';
import { user as userTable } from './db/auth-schema';
import { getDb } from './db/client';

/**
 * Demo account for the supervising lawyer — the only role. Passwords are
 * intentionally trivial — this is a demo of a fictitious firm, not a production
 * system.
 */
export const DEMO_USERS = [
	{
		email: 'g.romano@romanopartners.it',
		name: 'Giulia Romano',
		password: 'demo1234',
		role: 'supervisor'
	}
];

let seededInIsolate = false;

/**
 * Idempotently create the demo users (Better Auth generates the password hashes,
 * so this can't be precomputed in seed.sql) and set their custom role. Safe to
 * call repeatedly; subsequent calls are no-ops.
 */
export async function ensureDemoUsers(env: App.Platform['env']): Promise<void> {
	if (seededInIsolate) return;
	const auth = getAuth(env);
	const db = getDb(env.DB);

	for (const u of DEMO_USERS) {
		try {
			await auth.api.signUpEmail({
				body: { email: u.email, password: u.password, name: u.name }
			});
		} catch (err) {
			const msg = String((err as Error)?.message ?? err).toLowerCase();
			if (!msg.includes('exist') && !msg.includes('already')) {
				console.warn('ensureDemoUsers signup:', msg);
			}
		}
		// `role` has input:false, so set it server-side after creation.
		try {
			await db.update(userTable).set({ role: u.role }).where(eq(userTable.email, u.email));
		} catch (err) {
			console.warn('ensureDemoUsers role:', String((err as Error)?.message ?? err));
		}
	}
	seededInIsolate = true;
}
