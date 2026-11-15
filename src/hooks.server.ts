import type { RequestEvent } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function isCrossSiteWrite({ request, url }: RequestEvent) {
	if (SAFE_METHODS.has(request.method)) return false;
	if (url.pathname.startsWith('/api/forms/')) return false;
	return request.headers.get('origin') !== url.origin;
}

export const handle: Handle = async ({ event, resolve }) => {
	if (isCrossSiteWrite(event)) return new Response('Cross-site request forbidden', { status: 403 });
	return resolve(event);
};
