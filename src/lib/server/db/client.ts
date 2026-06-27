import type { D1Database } from '@cloudflare/workers-types';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

/** Build a Drizzle client over a D1 binding (platform.env.DB). */
export function getDb(d1: D1Database) {
	return drizzle(d1, { schema });
}

export type DB = ReturnType<typeof getDb>;
export { schema };

/** Resolve a Drizzle client from the request platform, with a clear error if the binding is missing. */
export function dbFrom(platform: App.Platform | undefined): DB {
	const d1 = platform?.env?.DB;
	if (!d1) {
		throw new Error(
			'D1 binding "DB" unavailable. Run `npm run dev` (the adapter emulates bindings) after `npm run db:migrate:local && npm run seed`.'
		);
	}
	return getDb(d1);
}
