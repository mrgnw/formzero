import { redirect } from '@sveltejs/kit';
import { requireUser } from '#lib/server/auth.js';
import { listForms } from '#lib/server/forms.js';
import { SIDEBAR_COOKIE_NAME } from '#lib/components/ui/sidebar/constants.js';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ cookies }) => {
	const { name, email } = requireUser();
	const forms = await listForms();
	if (forms.length === 0) redirect(302, '/setup');
	return { forms, user: { name, email }, sidebarOpen: cookies.get(SIDEBAR_COOKIE_NAME) !== 'false' };
};
