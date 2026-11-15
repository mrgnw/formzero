import { error } from '@sveltejs/kit';
import { requireUser } from '#lib/server/auth.js';
import { getForm } from '#lib/server/forms.js';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ params }) => {
	requireUser();
	const form = await getForm(params.formId);
	if (!form) error(404, 'Form not found');
	return { form };
};
