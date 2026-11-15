import { env } from 'cloudflare:workers';
import { cellText, OBJECT_DATA, type Row, type Submission, toSubmission } from '#lib/server/submission-data.js';

export type { Submission };

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

const SORTS: Record<string, Sort> = {
	time: { key: 'created_at', direction: 'ascending' },
	'-time': { key: 'created_at', direction: 'descending' },
	email: { key: 'email', direction: 'ascending' },
	'-email': { key: 'email', direction: 'descending' }
};

const EMAIL = `json_extract(${OBJECT_DATA}, '$.email') COLLATE NOCASE`;

const ORDER_BY: Record<SortKey, Record<Direction, string>> = {
	created_at: { ascending: 'created_at ASC, id ASC', descending: 'created_at DESC, id DESC' },
	email: {
		ascending: `${EMAIL} ASC, created_at DESC, id DESC`,
		descending: `${EMAIL} DESC, created_at DESC, id DESC`
	}
};

export function parseSort(param: string | null): Sort {
	return param !== null && Object.hasOwn(SORTS, param) ? SORTS[param] : SORTS['-time'];
}

export function parsePage(param: string | null) {
	const page = Number(param);
	return Number.isSafeInteger(page) && page > 0 ? page : 1;
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
