import { env, waitUntil } from 'cloudflare:workers';
import type { EmailConfig } from '#lib/types.js';
import { sendSubmissionNotification } from './email';

export const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type, Accept',
	'Access-Control-Max-Age': '86400'
};

const MAX_BODY_BYTES = 64 * 1024;
const MAX_FIELDS = 100;
const MAX_NAME_LENGTH = 100;
const MAX_VALUE_LENGTH = 10_000;

type Submission = { id: string; formId: string; data: Record<string, unknown>; createdAt: number };

function json(body: unknown, status: number) {
	return Response.json(body, { status, headers: corsHeaders });
}

function redirect(location: string, status: 302 | 303) {
	return new Response(null, { status, headers: { Location: location } });
}

function isSafeRedirect(target: string) {
	if (/[\s\\\x00-\x1f\x7f]/.test(target)) return false;
	if (target.startsWith('/') && !target.startsWith('//')) return true;
	return URL.canParse(target) && ['http:', 'https:'].includes(new URL(target).protocol);
}

function redirectTarget(request: Request) {
	const target = new URL(request.url).searchParams.get('redirect') || request.headers.get('referer');
	return target && isSafeRedirect(target) ? target : '/success';
}

class Rejection extends Error {
	constructor(
		readonly status: 400 | 413,
		message: string
	) {
		super(message);
	}
}

function mediaType(contentType: string) {
	return contentType.split(';')[0].trim().toLowerCase();
}

function isFormEncoded(type: string) {
	return type === 'application/x-www-form-urlencoded' || type === 'multipart/form-data';
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function tooLarge() {
	return new Rejection(413, `Submission is larger than ${MAX_BODY_BYTES} bytes`);
}

async function readBody(request: Request) {
	if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) throw tooLarge();
	const chunks: Uint8Array<ArrayBuffer>[] = [];
	let size = 0;
	for await (const chunk of request.body ?? []) {
		size += chunk.byteLength;
		if (size > MAX_BODY_BYTES) throw tooLarge();
		chunks.push(chunk);
	}
	return new Blob(chunks);
}

function isPrimitive(value: unknown) {
	return value === null || ['string', 'number', 'boolean'].includes(typeof value);
}

function checkFields(data: Record<string, unknown>) {
	const fields = Object.entries(data);
	if (fields.length > MAX_FIELDS) throw new Rejection(400, `Submission has more than ${MAX_FIELDS} fields`);
	for (const [name, value] of fields) {
		if (name.length > MAX_NAME_LENGTH) {
			throw new Rejection(400, `Field names must be at most ${MAX_NAME_LENGTH} characters`);
		}
		const values = Array.isArray(value) ? value : [value];
		if (!values.every(isPrimitive)) {
			throw new Rejection(400, 'Field values must be strings, numbers, booleans, null or arrays of those');
		}
		if (values.some((item) => typeof item === 'string' && item.length > MAX_VALUE_LENGTH)) {
			throw new Rejection(400, `Field values must be at most ${MAX_VALUE_LENGTH} characters`);
		}
	}
	return data;
}

async function readJson(body: Blob) {
	let data: unknown;
	try {
		data = JSON.parse(await body.text());
	} catch {
		throw new Rejection(400, 'Malformed JSON');
	}
	if (!isPlainObject(data)) throw new Rejection(400, 'Submission must be a JSON object');
	return data;
}

async function readForm(body: Blob, contentType: string) {
	let entries: [string, FormDataEntryValue][];
	try {
		entries = [...(await new Response(body, { headers: { 'content-type': contentType } }).formData())];
	} catch {
		throw new Rejection(400, 'Malformed form data');
	}
	if (entries.some(([, value]) => typeof value !== 'string')) {
		throw new Rejection(400, 'File uploads are not supported');
	}
	return Object.fromEntries(entries);
}

async function notify(submission: Submission) {
	const settings = await env.DB.prepare(
		"SELECT notification_email, notification_email_password, smtp_host, smtp_port FROM settings WHERE id = 'global'"
	).first<{
		notification_email: string | null;
		notification_email_password: string | null;
		smtp_host: string | null;
		smtp_port: number | null;
	}>();
	if (
		!settings?.notification_email ||
		!settings.notification_email_password ||
		!settings.smtp_host ||
		!settings.smtp_port
	) {
		return;
	}
	const form = await env.DB.prepare('SELECT name FROM forms WHERE id = ?').bind(submission.formId).first<{ name: string }>();
	if (!form) return;
	const config: EmailConfig = {
		notification_email: settings.notification_email,
		notification_email_password: settings.notification_email_password,
		smtp_host: settings.smtp_host,
		smtp_port: settings.smtp_port
	};
	await sendSubmissionNotification(config, { ...submission, formName: form.name });
}

export async function handleSubmission(request: Request, formId: string) {
	const contentType = request.headers.get('content-type') || '';
	const accept = request.headers.get('accept') || '';
	const type = mediaType(contentType);
	const isJson = type === 'application/json';
	const wantsJson = isJson || accept.includes('application/json');

	try {
		const form = await env.DB.prepare('SELECT id FROM forms WHERE id = ?').bind(formId).first();
		if (!form) {
			if (wantsJson) return json({ success: false, error: 'Form not found' }, 404);
			return redirect('/error?error=form_not_found', 302);
		}

		if (!isJson && !isFormEncoded(type)) {
			if (wantsJson) return json({ success: false, error: 'Unsupported content type' }, 415);
			return redirect('/error?error=unsupported_content_type', 302);
		}
		const body = await readBody(request);
		const data = checkFields(isJson ? await readJson(body) : await readForm(body, contentType));

		const submission: Submission = { id: crypto.randomUUID(), formId, data, createdAt: Date.now() };
		await env.DB.prepare('INSERT INTO submissions (id, form_id, data, created_at) VALUES (?, ?, ?, ?)')
			.bind(submission.id, formId, JSON.stringify(data), submission.createdAt)
			.run();

		waitUntil(
			notify(submission).catch((error) => console.error('Failed to send email notification:', error))
		);

		if (wantsJson) return json({ success: true, id: submission.id }, 201);
		return redirect(redirectTarget(request), 303);
	} catch (error) {
		if (error instanceof Rejection) {
			if (wantsJson) return json({ success: false, error: error.message }, error.status);
			return redirect('/error?error=invalid_submission', 302);
		}
		console.error('Error processing form submission:', error);
		if (wantsJson) return json({ success: false, error: 'Failed to process submission' }, 500);
		return redirect('/error?error=internal_error', 302);
	}
}
