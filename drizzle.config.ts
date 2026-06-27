import { defineConfig } from 'drizzle-kit';

/**
 * drizzle-kit only GENERATES migration SQL here (dialect: sqlite). Migrations are
 * APPLIED to Cloudflare D1 with `wrangler d1 migrations apply` (see package.json),
 * not `drizzle-kit push` — keep the two tools from fighting.
 */
export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	out: './drizzle',
	dialect: 'sqlite'
});
