import { building } from '$app/env';
import type { RequestEvent } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { getAuth } from '#lib/server/auth.js';

const FRAMEABLE_PATHS = ['/api/forms/', '/success', '/error'];

function setSecurityHeaders({ headers }: Response, pathname: string) {
	headers.set('X-Content-Type-Options', 'nosniff');
	headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	if (FRAMEABLE_PATHS.some((path) => pathname.startsWith(path))) return;
	headers.set('X-Frame-Options', 'DENY');
	headers.append('Content-Security-Policy', "frame-ancestors 'none'");
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function isCrossSiteWrite({ request, url }: RequestEvent) {
	if (SAFE_METHODS.has(request.method)) return false;
	if (url.pathname.startsWith('/api/forms/')) return false;
	return request.headers.get('origin') !== url.origin;
}

export const handle: Handle = async ({ event, resolve }) => {
	if (isCrossSiteWrite(event)) return new Response('Cross-site request forbidden', { status: 403 });
	if (!event.url.pathname.startsWith('/api/forms/')) {
		const session = await getAuth().api.getSession({ headers: event.request.headers });
		event.locals.user = session?.user ?? null;
	}
	const response = await svelteKitHandler({ auth: getAuth(), event, resolve, building });
	setSecurityHeaders(response, event.url.pathname);
	return response;
};
