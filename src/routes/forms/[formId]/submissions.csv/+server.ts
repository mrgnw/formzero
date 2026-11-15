import { error } from '@sveltejs/kit';
import { requireUser } from '#lib/server/auth.js';
import { listSubmissions, submissionsCsv } from '#lib/server/dashboard.js';
import { getForm } from '#lib/server/forms.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	requireUser();
	if (!(await getForm(params.formId))) error(404, 'Form not found');
	const csv = submissionsCsv(await listSubmissions(params.formId));
	const filename = `submissions-${new Date().toISOString().split('T')[0]}.csv`;
	return new Response(csv, {
		headers: {
			'Content-Type': 'text/csv; charset=utf-8',
			'Content-Disposition': `attachment; filename="${filename}"`
		}
	});
};
