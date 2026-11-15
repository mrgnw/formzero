import { env } from 'cloudflare:workers';

export type Submission = {
	id: string;
	form_id: string;
	data: Record<string, unknown>;
	created_at: number;
};

export type SortKey = 'created_at' | 'email';
export type Direction = 'ascending' | 'descending';
export type Sort = { key: SortKey; direction: Direction };

export type SubmissionRow = Pick<Submission, 'id' | 'form_id' | 'created_at'> & { cells: string[] };

export type SubmissionPage = {
	fields: string[];
	rows: SubmissionRow[];
	matching: number;
	page: number;
	pageCount: number;
};

export const PAGE_SIZE = 50;
export const MAX_QUERY_LENGTH = 200;
export const CSV_BATCH_SIZE = 1000;
export const CSV_MAX_ROWS = 100_000;

const SORTS: Record<string, Sort> = {
	time: { key: 'created_at', direction: 'ascending' },
	'-time': { key: 'created_at', direction: 'descending' },
	email: { key: 'email', direction: 'ascending' },
	'-email': { key: 'email', direction: 'descending' }
};

const OBJECT_DATA = "CASE WHEN json_valid(data) THEN CASE json_type(data) WHEN 'object' THEN data END END";

const EMAIL = `json_extract(${OBJECT_DATA}, '$.email') COLLATE NOCASE`;

const ORDER_BY: Record<SortKey, Record<Direction, string>> = {
	created_at: { ascending: 'created_at ASC, id ASC', descending: 'created_at DESC, id DESC' },
	email: {
		ascending: `${EMAIL} ASC, created_at DESC, id DESC`,
		descending: `${EMAIL} DESC, created_at DESC, id DESC`
	}
};

type Row = Omit<Submission, 'data'> & { data: string };

export function parseSort(param: string | null): Sort {
	return param !== null && Object.hasOwn(SORTS, param) ? SORTS[param] : SORTS['-time'];
}

export function parsePage(param: string | null) {
	const page = Number(param);
	return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

function toSubmission(row: Row): Submission {
	return { ...row, data: parseData(row.data) };
}

export function parseData(text: string): Record<string, unknown> {
	try {
		const data: unknown = JSON.parse(text);
		return data !== null && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>) : {};
	} catch {
		return {};
	}
}

export function cellText(value: unknown): string {
	if (typeof value === 'string') return value;
	if (typeof value === 'number' || typeof value === 'boolean') return String(value);
	if (value === null || value === undefined) return '';
	try {
		return JSON.stringify(value) ?? '';
	} catch {
		return '';
	}
}

function tableFields(submissions: Submission[]) {
	return [...new Set(submissions.flatMap((submission) => Object.keys(submission.data)))].sort((a, b) => {
		if (a === 'email') return -1;
		if (b === 'email') return 1;
		return a.localeCompare(b);
	});
}

export async function listSubmissions(formId: string, query: string, sort: Sort, page: number): Promise<SubmissionPage> {
	const search = query ? ' AND (instr(lower(data), lower(?2)) > 0 OR instr(lower(id), lower(?2)) > 0)' : '';
	const params = query ? [formId, query] : [formId];
	const count = await env.DB.prepare(`SELECT COUNT(*) AS matching FROM submissions WHERE form_id = ?1${search}`)
		.bind(...params)
		.first<{ matching: number }>();
	const matching = count?.matching ?? 0;
	const pageCount = Math.max(1, Math.ceil(matching / PAGE_SIZE));
	const offset = (Math.min(page, pageCount) - 1) * PAGE_SIZE;
	const rows = await env.DB.prepare(
		`SELECT id, form_id, data, created_at FROM submissions WHERE form_id = ?1${search}
		ORDER BY ${ORDER_BY[sort.key][sort.direction]} LIMIT ${PAGE_SIZE} OFFSET ${offset}`
	)
		.bind(...params)
		.all<Row>();
	const submissions = rows.results.map(toSubmission);
	const fields = tableFields(submissions);
	return {
		fields,
		rows: submissions.map(({ id, form_id, created_at, data }) => ({
			id,
			form_id,
			created_at,
			cells: fields.map((field) => cellText(data[field]))
		})),
		matching,
		page,
		pageCount
	};
}

export async function deleteSubmission(formId: string, id: string) {
	const result = await env.DB.prepare('DELETE FROM submissions WHERE id = ? AND form_id = ?').bind(id, formId).run();
	return result.meta.changes > 0;
}

function escapeCsv(text: string) {
	if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
	return text;
}

function userCell(value: unknown) {
	const text = cellText(value);
	return escapeCsv(/^[=+\-@\t\r]/.test(text) ? `'${text}` : text);
}

async function csvKeys(formId: string) {
	const { results } = await env.DB.prepare(
		`SELECT DISTINCT key FROM (
			SELECT data FROM submissions WHERE form_id = ? ORDER BY created_at DESC, id DESC LIMIT ?
		), json_each(${OBJECT_DATA})`
	)
		.bind(formId, CSV_MAX_ROWS)
		.all<{ key: string }>();
	return results.map((row) => row.key).sort();
}

async function csvBatch(formId: string, after: { created_at: number; id: string }, limit: number) {
	const { results } = await env.DB.prepare(
		`SELECT id, form_id, data, created_at FROM submissions
		WHERE form_id = ? AND (created_at < ? OR (created_at = ? AND id < ?))
		ORDER BY created_at DESC, id DESC LIMIT ?`
	)
		.bind(formId, after.created_at, after.created_at, after.id, limit)
		.all<Row>();
	return results;
}

export async function submissionsCsv(formId: string): Promise<ReadableStream<Uint8Array>> {
	const keys = await csvKeys(formId);
	const encoder = new TextEncoder();
	let cursor = { created_at: Number.MAX_SAFE_INTEGER, id: '' };
	let remaining = CSV_MAX_ROWS;
	return new ReadableStream({
		start(controller) {
			controller.enqueue(encoder.encode(['ID', 'Created At', ...keys.map(userCell)].join(',')));
		},
		async pull(controller) {
			const rows = await csvBatch(formId, cursor, Math.min(CSV_BATCH_SIZE, remaining));
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
		}
	});
}
