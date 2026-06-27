// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { D1Database, KVNamespace } from '@cloudflare/workers-types';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			actorEmail: string;
		}
		// interface PageData {}
		// interface PageState {}
		interface Platform {
			env: {
				DB: D1Database;
				KV: KVNamespace;
			};
		}
	}
}

export {};
