import { form } from '$app/server';
import { error } from '@sveltejs/kit';
import * as v from 'valibot';
import { requireUser } from '#lib/server/auth.js';
import { deleteSubmission as removeSubmission } from '#lib/server/dashboard.js';

const id = v.pipe(v.string(), v.nonEmpty());

export const deleteSubmission = form(v.object({ id, form_id: id }), async ({ id, form_id }) => {
	requireUser();
	if (!(await removeSubmission(form_id, id))) error(404, 'Submission not found');
});
