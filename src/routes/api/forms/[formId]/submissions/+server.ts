import { corsHeaders, handleSubmission } from '#lib/server/submissions.js';
import type { RequestHandler } from './$types';

export const OPTIONS: RequestHandler = () => new Response(null, { status: 204, headers: corsHeaders });

export const POST: RequestHandler = ({ request, params }) => handleSubmission(request, params.formId);

export const fallback: RequestHandler = () =>
	Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders });
