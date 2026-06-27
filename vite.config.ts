import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

// Node's `process` at config-eval time, declared locally so the SvelteKit
// typecheck (which doesn't pull in @types/node) stays clean.
declare const process: { env: Record<string, string | undefined> };

export default defineConfig({
	// Honour PORT when set (e.g. a preview/launcher assigning a free port);
	// otherwise Vite falls back to its default (5173) for normal `npm run dev`.
	server: process.env.PORT ? { port: Number(process.env.PORT) } : undefined,
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			// Deploy as a Cloudflare Worker with static assets. Bindings (DB, KV) are
			// emulated in `vite dev` via the adapter's platformProxy, reading wrangler.jsonc.
			adapter: adapter()
		})
	]
});
