import { form } from '$app/server';
import { error, invalid, redirect } from '@sveltejs/kit';
import { env } from 'cloudflare:workers';
import * as v from 'valibot';
import { requireUser } from '#lib/server/auth.js';
import { slugify } from '#lib/server/forms.js';
import { createFormSchema } from '#lib/schemas.js';

const renameSchema = v.object({
	id: v.string(),
	name: v.pipe(createFormSchema.entries.name, v.maxLength(100, 'Form name must be 100 characters or fewer'))
});

const deleteSchema = v.object({ id: v.string() });

export const renameForm = form(renameSchema, async ({ id, name }, issue) => {
	requireUser();
	if (slugify(name) === '') invalid(issue.name('Form name must contain a letter or number'));
	const result = await env.DB.prepare('UPDATE forms SET name = ?, updated_at = ? WHERE id = ?')
		.bind(name, Date.now(), id)
		.run();
	if (result.meta.changes === 0) error(404, 'Form not found');
	return { saved: true };
});

export const deleteForm = form(deleteSchema, async ({ id }) => {
	requireUser();
	const result = await env.DB.prepare('DELETE FROM forms WHERE id = ?').bind(id).run();
	if (result.meta.changes === 0) error(404, 'Form not found');
	redirect(303, '/forms');
});
