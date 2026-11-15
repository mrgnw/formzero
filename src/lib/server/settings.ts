import { env } from 'cloudflare:workers';
import type { SavedNotificationSettings } from '#lib/smtp.js';

type SettingsRow = {
	notification_email: string;
	notification_email_password: string | null;
	smtp_host: string;
	smtp_port: number;
	updated_at: number;
};

export type NotificationSettings = {
	notification_email: string;
	notification_email_password: string;
	smtp_host: string;
	smtp_port: number;
};

export async function getSettingsRow() {
	return env.DB.prepare(
		"SELECT notification_email, notification_email_password, smtp_host, smtp_port, updated_at FROM settings WHERE id = 'global'"
	).first<SettingsRow>();
}

export function toPublicSettings(row: SettingsRow | null): SavedNotificationSettings | null {
	if (!row) return null;
	return {
		notification_email: row.notification_email,
		smtp_host: row.smtp_host,
		smtp_port: row.smtp_port,
		has_password: Boolean(row.notification_email_password),
		updated_at: row.updated_at
	};
}

export async function saveSettings(settings: NotificationSettings) {
	await env.DB.prepare(
		`INSERT INTO settings (id, notification_email, notification_email_password, smtp_host, smtp_port, smtp_secure, updated_at)
		VALUES ('global', ?, ?, ?, ?, 1, ?)
		ON CONFLICT (id) DO UPDATE SET
			notification_email = excluded.notification_email,
			notification_email_password = excluded.notification_email_password,
			smtp_host = excluded.smtp_host,
			smtp_port = excluded.smtp_port,
			smtp_secure = 1,
			updated_at = excluded.updated_at`
	)
		.bind(
			settings.notification_email,
			settings.notification_email_password,
			settings.smtp_host,
			settings.smtp_port,
			Date.now()
		)
		.run();
}

export async function clearSettings() {
	await env.DB.prepare("DELETE FROM settings WHERE id = 'global'").run();
}
