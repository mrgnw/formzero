import { redirect } from '@sveltejs/kit';
import { requireUser } from '#lib/server/auth.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	requireUser();
	redirect(302, `/forms/${params.formId}/submissions`);
};
