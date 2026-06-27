// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { Auth } from '$lib/server/auth';
import type { D1Database, KVNamespace } from '@cloudflare/workers-types';

type AuthSession = Auth['$Infer']['Session'];

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			/** Per-request Better Auth instance (built in hooks). */
			auth: Auth;
			/** Email attributed to supervisory actions / audit — the signed-in user. */
			actorEmail: string;
			/** The authenticated user (includes the custom `role`), or null when signed out. */
			user: AuthSession['user'] | null;
			session: AuthSession['session'] | null;
		}
		// interface PageData {}
		// interface PageState {}
		interface Platform {
			env: {
				DB: D1Database;
				KV: KVNamespace;
				BETTER_AUTH_SECRET?: string;
				BETTER_AUTH_URL?: string;
				/** Optional: enables the live Gemini intake path. Absent ⇒ rules engine. */
				GEMINI_API_KEY?: string;
				/** Live per-claim analysis (optional). Absent ⇒ seeded fallback. */
				ANTHROPIC_API_KEY?: string;
				GOOGLE_API_KEY?: string;
				/** Web researcher's open-web tool (Perplexity). Absent ⇒ web step skipped. */
				PERPLEXITY_API_KEY?: string;
				/** Override the Perplexity model id (default 'sonar'). */
				PERPLEXITY_MODEL?: string;
				/** Knowledge researcher's open model via NVIDIA NIM. Absent ⇒ seeded fallback. */
				NVIDIA_NIM_API_KEY?: string;
				/** NIM endpoint — point at a self-hosted NIM to keep firm data on-perimeter. */
				NVIDIA_NIM_BASE_URL?: string;
				/** Override the Nemotron model id served by NIM. */
				ITAILY_NEMOTRON_MODEL?: string;
				/**
				 * CELLAR MCP endpoint the EU Law Researcher drives as a real MCP client.
				 * Absent ⇒ same-origin /api/mcp/cellar (derived from the request).
				 */
				CELLAR_MCP_URL?: string;
				/** Enable the bounded critic escalation loop (truthy ⇒ on). Absent ⇒ off. */
				ITAILY_ESCALATION?: string;
			};
		}
	}
}

export {};
