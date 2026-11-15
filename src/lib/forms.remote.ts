import { form } from '$app/server';
import { invalid, redirect } from '@sveltejs/kit';
import { requireUser } from '#lib/server/auth.js';
import { formExists, insertForm, slugify } from '#lib/server/forms.js';
import { createFormSchema } from '#lib/schemas.js';

export const createForm = form(createFormSchema, async ({ name }, issue) => {
	requireUser();
	const id = slugify(name);
	if (id === '') invalid(issue.name('Form name must contain a letter or number'));
	const duplicate = () => invalid(issue.name('A form with this name already exists'));
	if (await formExists(id)) duplicate();
	try {
		await insertForm(id, name);
	} catch (error) {
		if (String(error).includes('UNIQUE constraint failed')) duplicate();
		throw error;
	}
	redirect(303, `/forms/${id}/submissions`);
});
