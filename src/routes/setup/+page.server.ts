import { redirect } from '@sveltejs/kit';
import { requireUser } from '#lib/server/auth.js';
import { anyFormExists } from '#lib/server/forms.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	requireUser();
	if (await anyFormExists()) redirect(302, '/forms');
};
