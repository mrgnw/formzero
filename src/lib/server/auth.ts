import { betterAuth } from 'better-auth';
import { APIError } from 'better-auth/api';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { redirect } from '@sveltejs/kit';
import { env } from 'cloudflare:workers';
import { D1Dialect } from 'kysely-d1';
import { clientIp, hit } from './rate-limit';

export const AUTH_ATTEMPTS_PER_IP = 10;
export const AUTH_IP_WINDOW_SECONDS = 600;
export const AUTH_ATTEMPTS_PER_EMAIL = 100;
export const AUTH_EMAIL_WINDOW_SECONDS = 3600;
export const TOO_MANY_ATTEMPTS = 'Too many attempts. Please try again later.';

export async function userCount() {
	const row = await env.DB.prepare('SELECT COUNT(*) AS count FROM user').first<{ count: number }>();
	return row?.count ?? 0;
}

function createAuth() {
	if (!env.BETTER_AUTH_SECRET) throw new Error('BETTER_AUTH_SECRET is not set');
	return betterAuth({
		database: { type: 'sqlite', dialect: new D1Dialect({ database: env.DB }) },
		secret: env.BETTER_AUTH_SECRET,
		emailAndPassword: { enabled: true },
		databaseHooks: {
			user: {
				create: {
					before: async () => {
						if ((await userCount()) > 0) {
							throw new APIError('FORBIDDEN', {
								code: 'SIGNUP_DISABLED',
								message: 'An account already exists. Please login instead.'
							});
						}
					}
				}
			}
		},
		plugins: [sveltekitCookies(getRequestEvent)]
	});
}

let instance: ReturnType<typeof createAuth> | undefined;

export function getAuth() {
	return (instance ??= createAuth());
}

export function requireUser() {
	const { locals } = getRequestEvent();
	if (!locals.user) redirect(302, '/login');
	return locals.user;
}

export async function limitAuthAttempt(request: Request, email: string | null) {
	const limits = await Promise.all([
		hit(`auth:ip:${clientIp(request)}`, AUTH_ATTEMPTS_PER_IP, AUTH_IP_WINDOW_SECONDS),
		...(email ? [hit(`auth:email:${email.trim().toLowerCase()}`, AUTH_ATTEMPTS_PER_EMAIL, AUTH_EMAIL_WINDOW_SECONDS)] : [])
	]);
	const blocked = limits.filter((limit) => !limit.allowed);
	return { allowed: blocked.length === 0, retryAfter: Math.max(0, ...blocked.map((limit) => limit.retryAfter)) };
}
