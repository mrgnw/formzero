import { error } from '@sveltejs/kit';
import { env } from 'cloudflare:workers';
import { requireUser } from '#lib/server/auth.js';
import { submissionsCsv } from '#lib/server/csv.js';
import { getForm } from '#lib/server/forms.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	requireUser();
	if (!(await getForm(params.formId))) error(404, 'Form not found');
	const { stream, truncated } = await submissionsCsv(env.DB, params.formId);
	const filename = `submissions-${new Date().toISOString().split('T')[0]}.csv`;
	return new Response(stream, {
		headers: {
			'Content-Type': 'text/csv; charset=utf-8',
			'Content-Disposition': `attachment; filename="${filename}"`,
			...(truncated ? { 'X-Export-Truncated': 'true' } : {})
		}
	});
};
