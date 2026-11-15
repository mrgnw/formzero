import { building } from '$app/env';
import type { RequestEvent } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { getAuth, limitAuthAttempt, tooManyAttempts } from '#lib/server/auth.js';

const FRAMEABLE_PATHS = ['/api/forms/', '/success', '/error'];

function setSecurityHeaders({ headers }: Response, pathname: string) {
	headers.set('X-Content-Type-Options', 'nosniff');
	headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	if (FRAMEABLE_PATHS.some((path) => pathname.startsWith(path))) return;
	headers.set('X-Frame-Options', 'DENY');
	headers.append('Content-Security-Policy', "frame-ancestors 'none'");
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const AUTH_ENTRY_POINTS = new Set(['/api/auth/sign-in/email', '/api/auth/sign-up/email']);

function isCrossSiteWrite({ request, url }: RequestEvent) {
	if (SAFE_METHODS.has(request.method)) return false;
	if (url.pathname.startsWith('/api/forms/')) return false;
	return request.headers.get('origin') !== url.origin;
}

async function attemptedEmail(request: Request) {
	const contentType = request.headers.get('content-type') ?? '';
	try {
		if (contentType.includes('json')) {
			const body: { email?: unknown } | null = await request.clone().json();
			return typeof body?.email === 'string' ? body.email : null;
		}
		if (contentType.includes('form')) {
			const email = (await request.clone().formData()).get('email');
			return typeof email === 'string' ? email : null;
		}
	} catch {
		return null;
	}
	return null;
}

async function rejectLimitedAuthAttempt({ request, url }: RequestEvent) {
	if (request.method !== 'POST' || !AUTH_ENTRY_POINTS.has(url.pathname)) return null;
	const limit = await limitAuthAttempt(request, await attemptedEmail(request));
	if (limit.allowed) return null;
	return Response.json(
		{ code: 'TOO_MANY_REQUESTS', message: tooManyAttempts(limit.retryAfter) },
		{ status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
	);
}

export const handle: Handle = async ({ event, resolve }) => {
	if (isCrossSiteWrite(event)) return new Response('Cross-site request forbidden', { status: 403 });
	const limited = await rejectLimitedAuthAttempt(event);
	if (limited) return limited;
	if (!event.url.pathname.startsWith('/api/forms/')) {
		const session = await getAuth().api.getSession({ headers: event.request.headers });
		event.locals.user = session?.user ?? null;
	}
	const response = await svelteKitHandler({ auth: getAuth(), event, resolve, building });
	setSecurityHeaders(response, event.url.pathname);
	return response;
};
