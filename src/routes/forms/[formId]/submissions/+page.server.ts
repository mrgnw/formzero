import { requireUser } from '#lib/server/auth.js';
import { dailyCounts, listSubmissions, submissionStats } from '#lib/server/dashboard.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	requireUser();
	const now = Date.now();
	const submissions = await listSubmissions(params.formId);
	return {
		submissions,
		now,
		stats: submissionStats(submissions, now),
		days: dailyCounts(submissions, now)
	};
};
