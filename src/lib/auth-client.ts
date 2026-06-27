import type { Auth } from '$lib/server/auth';
import { inferAdditionalFields } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/svelte';

// Same-origin SvelteKit → no baseURL needed. inferAdditionalFields surfaces the
// custom `role` on the client session type.
export const authClient = createAuthClient({
	plugins: [inferAdditionalFields<Auth>()]
});

export const { signIn, signOut, signUp, useSession } = authClient;
