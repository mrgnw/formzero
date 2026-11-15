import { building } from '$app/env';
import type { RequestEvent } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { getAuth } from '#lib/server/auth.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function isCrossSiteWrite({ request, url }: RequestEvent) {
	if (SAFE_METHODS.has(request.method)) return false;
	if (url.pathname.startsWith('/api/forms/')) return false;
	const origin = request.headers.get('origin');
	if (origin === null) return false;
	return origin !== url.origin;
}

export const handle: Handle = async ({ event, resolve }) => {
	if (isCrossSiteWrite(event)) return new Response('Cross-site request forbidden', { status: 403 });
	if (!event.url.pathname.startsWith('/api/forms/')) {
		const session = await getAuth().api.getSession({ headers: event.request.headers });
		event.locals.user = session?.user ?? null;
	}
	return svelteKitHandler({ auth: getAuth(), event, resolve, building });
};
