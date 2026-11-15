import { form, getRequestEvent } from '$app/server';
import { invalid, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { getAuth, limitAuthAttempt, requireUser, TOO_MANY_ATTEMPTS } from '#lib/server/auth.js';
import { signInSchema, signUpSchema } from '#lib/schemas.js';

function authFailure(error: unknown, fallback: string, unexpected: string): never {
	if (error instanceof APIError) invalid(error.message || fallback);
	console.error('Unexpected authentication error:', error instanceof Error ? error.name : typeof error);
	invalid(unexpected);
}

export const signIn = form(signInSchema, async ({ email, _password }) => {
	const { request } = getRequestEvent();
	if (!(await limitAuthAttempt(request, email)).allowed) invalid(TOO_MANY_ATTEMPTS);
	try {
		await getAuth().api.signInEmail({ body: { email, password: _password }, headers: request.headers });
	} catch (error) {
		authFailure(error, 'Invalid email or password', 'Failed to login. Please try again.');
	}
	redirect(303, '/forms');
});

export const signUp = form(signUpSchema, async ({ name, email, _password }) => {
	const { request } = getRequestEvent();
	if (!(await limitAuthAttempt(request, email)).allowed) invalid(TOO_MANY_ATTEMPTS);
	try {
		await getAuth().api.signUpEmail({ body: { name, email, password: _password }, headers: request.headers });
	} catch (error) {
		authFailure(error, 'Failed to create account', 'Failed to create account. Please try again.');
	}
	redirect(303, '/forms');
});

export const signOut = form(async () => {
	requireUser();
	await getAuth().api.signOut({ headers: getRequestEvent().request.headers });
	redirect(303, '/login');
});
