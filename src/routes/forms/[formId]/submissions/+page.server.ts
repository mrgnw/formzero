import { redirect } from '@sveltejs/kit';
import { env } from 'cloudflare:workers';
import { requireUser } from '#lib/server/auth.js';
import { CSV_MAX_ROWS } from '#lib/server/csv.js';
import { listSubmissions, MAX_QUERY_LENGTH, parsePage, parseSort } from '#lib/server/dashboard.js';
import { dailyCounts, submissionStats } from '#lib/server/stats.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url }) => {
	requireUser();
	const now = Date.now();
	const query = url.searchParams.get('q')?.trim().slice(0, MAX_QUERY_LENGTH) ?? '';
	const sort = parseSort(url.searchParams.get('sort'));
	const page = parsePage(url.searchParams.get('page'));
	const [table, stats, days] = await Promise.all([
		listSubmissions(params.formId, query, sort, page),
		submissionStats(env.DB, params.formId, now),
		dailyCounts(env.DB, params.formId, now)
	]);
	if (page > table.pageCount) {
		const target = new URL(url);
		target.searchParams.set('page', String(table.pageCount));
		redirect(303, target.pathname + target.search);
	}
	return { table, query, sort, now, stats, days, csvLimit: CSV_MAX_ROWS };
};
