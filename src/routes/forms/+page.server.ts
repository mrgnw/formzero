import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { forms } = await parent();
	redirect(302, `/forms/${forms[0].id}/submissions`);
};
