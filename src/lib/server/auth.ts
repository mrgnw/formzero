import { betterAuth } from 'better-auth';
import { APIError } from 'better-auth/api';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { redirect } from '@sveltejs/kit';
import { env } from 'cloudflare:workers';
import { D1Dialect } from 'kysely-d1';

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
