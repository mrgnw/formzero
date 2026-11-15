export type Submission = {
	id: string;
	form_id: string;
	data: Record<string, unknown>;
	created_at: number;
};

export type Row = Omit<Submission, 'data'> & { data: string };

export const OBJECT_DATA = "CASE WHEN json_valid(data) THEN CASE json_type(data) WHEN 'object' THEN data END END";

export function toSubmission(row: Row): Submission {
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
