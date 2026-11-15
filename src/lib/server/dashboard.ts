import { env } from 'cloudflare:workers';

export type Submission = {
	id: string;
	form_id: string;
	data: Record<string, unknown>;
	created_at: number;
};

export type SubmissionStats = {
	total: number;
	thisWeek: number;
	thisMonth: number;
	weekTrend: number;
	monthTrend: number;
};

export type DailyCount = { date: string; count: number };

const DAY = 24 * 60 * 60 * 1000;

export async function listSubmissions(formId: string): Promise<Submission[]> {
	const { results } = await env.DB.prepare(
		'SELECT id, form_id, data, created_at FROM submissions WHERE form_id = ? ORDER BY created_at DESC'
	)
		.bind(formId)
		.all<Omit<Submission, 'data'> & { data: string }>();
	return results.map((row) => ({ ...row, data: JSON.parse(row.data) }));
}

function countBetween(submissions: Submission[], from: number, to = Infinity) {
	return submissions.filter((s) => s.created_at >= from && s.created_at < to).length;
}

function trend(current: number, previous: number) {
	if (previous === 0) return current > 0 ? 100 : 0;
	return Math.round(((current - previous) / previous) * 100);
}

export function submissionStats(submissions: Submission[], now: number): SubmissionStats {
	const thisWeek = countBetween(submissions, now - 7 * DAY);
	const previousWeek = countBetween(submissions, now - 14 * DAY, now - 7 * DAY);
	const thisMonth = countBetween(submissions, now - 30 * DAY);
	const previousMonth = countBetween(submissions, now - 60 * DAY, now - 30 * DAY);
	return {
		total: submissions.length,
		thisWeek,
		thisMonth,
		weekTrend: trend(thisWeek, previousWeek),
		monthTrend: trend(thisMonth, previousMonth)
	};
}

export function dailyCounts(submissions: Submission[], now: number): DailyCount[] {
	return Array.from({ length: 30 }, (_, index) => {
		const date = new Date(now - (29 - index) * DAY);
		const startOfDay = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
		return {
			date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
			count: countBetween(submissions, startOfDay, startOfDay + DAY)
		};
	});
}
