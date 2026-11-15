import { form } from '$app/server';
import { invalid, redirect } from '@sveltejs/kit';
import { requireUser } from '#lib/server/auth.js';
import { formExists, insertForm, slugify } from '#lib/server/forms.js';
import { createFormSchema } from '#lib/schemas.js';

export const createForm = form(createFormSchema, async ({ name }) => {
	requireUser();
	const id = slugify(name);
	if (id === '') invalid('Form name must contain a letter or number');
	if (await formExists(id)) invalid('A form with this name already exists');
	await insertForm(id, name);
	redirect(303, `/forms/${id}/submissions`);
});
