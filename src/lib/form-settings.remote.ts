import { form } from '$app/server';
import { error, redirect } from '@sveltejs/kit';
import { env } from 'cloudflare:workers';
import * as v from 'valibot';
import { requireUser } from '#lib/server/auth.js';

const renameSchema = v.object({
	id: v.string(),
	name: v.pipe(v.string(), v.trim(), v.nonEmpty('Form name is required'))
});

const deleteSchema = v.object({ id: v.string() });

export const renameForm = form(renameSchema, async ({ id, name }) => {
	requireUser();
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
