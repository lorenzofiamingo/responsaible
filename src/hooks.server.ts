import type { Handle } from '@sveltejs/kit';

/**
 * Demo identity. In a real deployment the supervising lawyer comes from auth (SSO);
 * here we fix a single supervisor so every supervisory action is attributable.
 */
export const handle: Handle = async ({ event, resolve }) => {
	event.locals.actorEmail = 'g.romano@romanopartners.it';
	return resolve(event);
};
