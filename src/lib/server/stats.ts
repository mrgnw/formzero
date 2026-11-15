export type SubmissionStats = {
	total: number;
	thisWeek: number;
	thisMonth: number;
	weekTrend: number;
	monthTrend: number;
};

export type DailyCount = { date: string; count: number };

const DAY = 24 * 60 * 60 * 1000;

const DAYS = 30;

function trend(current: number, previous: number) {
	if (previous === 0) return current > 0 ? 100 : 0;
	return Math.round(((current - previous) / previous) * 100);
}

export async function submissionStats(db: D1Database, formId: string, now: number): Promise<SubmissionStats> {
	const counts = await db
		.prepare(
			`SELECT
				COUNT(*) AS total,
				COALESCE(SUM(created_at >= ?), 0) AS thisWeek,
				COALESCE(SUM(created_at >= ? AND created_at < ?), 0) AS previousWeek,
				COALESCE(SUM(created_at >= ?), 0) AS thisMonth,
				COALESCE(SUM(created_at >= ? AND created_at < ?), 0) AS previousMonth
			FROM submissions WHERE form_id = ?`
		)
		.bind(now - 7 * DAY, now - 14 * DAY, now - 7 * DAY, now - 30 * DAY, now - 60 * DAY, now - 30 * DAY, formId)
		.first<Record<'total' | 'thisWeek' | 'previousWeek' | 'thisMonth' | 'previousMonth', number>>();
	if (!counts) throw new Error('COUNT query returned no row');
	return {
		total: counts.total,
		thisWeek: counts.thisWeek,
		thisMonth: counts.thisMonth,
		weekTrend: trend(counts.thisWeek, counts.previousWeek),
		monthTrend: trend(counts.thisMonth, counts.previousMonth)
	};
}

export async function dailyCounts(db: D1Database, formId: string, now: number): Promise<DailyCount[]> {
	const today = new Date(now);
	const start = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) - (DAYS - 1) * DAY;
	const { results } = await db
		.prepare(
			`SELECT CAST((created_at - ?) / ? AS INTEGER) AS day, COUNT(*) AS count
			FROM submissions WHERE form_id = ? AND created_at >= ? AND created_at < ?
			GROUP BY day`
		)
		.bind(start, DAY, formId, start, start + DAYS * DAY)
		.all<{ day: number; count: number }>();
	const counts = new Map(results.map((row) => [row.day, row.count]));
	return Array.from({ length: DAYS }, (_, day) => ({
		date: new Date(start + day * DAY).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
		count: counts.get(day) ?? 0
	}));
}
