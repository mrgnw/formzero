import { env } from 'cloudflare:workers';

export function slugify(name: string) {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

export async function anyFormExists() {
	return (await env.DB.prepare('SELECT id FROM forms LIMIT 1').first()) !== null;
}

export async function formExists(id: string) {
	return (await env.DB.prepare('SELECT id FROM forms WHERE id = ?').bind(id).first()) !== null;
}

export async function insertForm(id: string, name: string) {
	const now = Date.now();
	await env.DB.prepare('INSERT INTO forms (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)')
		.bind(id, name, now, now)
		.run();
}

export type FormSummary = { id: string; name: string };

export async function listForms() {
	const { results } = await env.DB.prepare('SELECT id, name FROM forms ORDER BY created_at ASC').all<FormSummary>();
	return results;
}

export async function getForm(id: string) {
	return env.DB.prepare('SELECT id, name FROM forms WHERE id = ?').bind(id).first<FormSummary>();
}
