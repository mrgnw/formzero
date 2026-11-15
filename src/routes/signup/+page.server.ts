import { redirect } from '@sveltejs/kit';
import { userCount } from '#lib/server/auth.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) redirect(302, '/forms');
	if ((await userCount()) > 0) redirect(302, '/login');
};
