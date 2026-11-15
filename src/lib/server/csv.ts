import { cellText, OBJECT_DATA, type Row, toSubmission } from './submission-data.js';

export const CSV_BATCH_SIZE = 1000;
export const CSV_MAX_ROWS = 100_000;
export const CSV_MAX_COLUMNS = 500;
export const CSV_MAX_CELL_LENGTH = 32 * 1024;

function escapeCsv(text: string) {
	if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
	return text;
}

function userCell(value: unknown) {
	const text = cellText(value).slice(0, CSV_MAX_CELL_LENGTH);
	return escapeCsv(/^[=+\-@\t\r]/.test(text) ? `'${text}` : text);
}

type Cursor = { created_at: number; id: string };

const UP_TO = '(created_at < ? OR (created_at = ? AND id <= ?))';
const AFTER = '(created_at < ? OR (created_at = ? AND id < ?))';

async function newestRow(db: D1Database, formId: string) {
	return db
		.prepare('SELECT created_at, id FROM submissions WHERE form_id = ? ORDER BY created_at DESC, id DESC LIMIT 1')
		.bind(formId)
		.first<Cursor>();
}

async function csvKeys(db: D1Database, formId: string, snapshot: Cursor) {
	const { results } = await db
		.prepare(
			`SELECT DISTINCT key FROM (
				SELECT data FROM submissions WHERE form_id = ? AND ${UP_TO} ORDER BY created_at DESC, id DESC LIMIT ?
			), json_each(${OBJECT_DATA})
			ORDER BY key LIMIT ?`
		)
		.bind(formId, snapshot.created_at, snapshot.created_at, snapshot.id, CSV_MAX_ROWS, CSV_MAX_COLUMNS)
		.all<{ key: string }>();
	return results.map((row) => row.key).sort();
}

async function csvBatch(db: D1Database, formId: string, bound: string, cursor: Cursor, limit: number) {
	const { results } = await db
		.prepare(
			`SELECT id, form_id, data, created_at FROM submissions
			WHERE form_id = ? AND ${bound}
			ORDER BY created_at DESC, id DESC LIMIT ?`
		)
		.bind(formId, cursor.created_at, cursor.created_at, cursor.id, limit)
		.all<Row>();
	return results;
}

async function exceedsCap(db: D1Database, formId: string, snapshot: Cursor) {
	const row = await db
		.prepare(`SELECT COUNT(*) AS rows FROM (SELECT 1 FROM submissions WHERE form_id = ? AND ${UP_TO} LIMIT ?)`)
		.bind(formId, snapshot.created_at, snapshot.created_at, snapshot.id, CSV_MAX_ROWS + 1)
		.first<{ rows: number }>();
	return (row?.rows ?? 0) > CSV_MAX_ROWS;
}

export async function submissionsCsv(db: D1Database, formId: string) {
	const snapshot = await newestRow(db, formId);
	const keys = snapshot ? await csvKeys(db, formId, snapshot) : [];
	const truncated = snapshot ? await exceedsCap(db, formId, snapshot) : false;
	const encoder = new TextEncoder();
	let cursor = snapshot;
	let bound = UP_TO;
	let remaining = CSV_MAX_ROWS;
	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			controller.enqueue(encoder.encode(['ID', 'Created At', ...keys.map(userCell)].join(',')));
		},
		async pull(controller) {
			if (!cursor) return controller.close();
			const rows = await csvBatch(db, formId, bound, cursor, Math.min(CSV_BATCH_SIZE, remaining));
			const lines = rows.map(toSubmission).map(
				(s) =>
					'\n' +
					[escapeCsv(s.id), escapeCsv(new Date(s.created_at).toISOString()), ...keys.map((key) => userCell(s.data[key]))].join(',')
			);
			if (lines.length > 0) controller.enqueue(encoder.encode(lines.join('')));
			remaining -= rows.length;
			const last = rows.at(-1);
			if (!last || rows.length < CSV_BATCH_SIZE || remaining === 0) return controller.close();
			cursor = last;
			bound = AFTER;
		}
	});
	return { stream, truncated };
}
