import { form, query } from '$app/server';
import { invalid } from '@sveltejs/kit';
import { requireUser } from '#lib/server/auth.js';
import { sendTestEmail } from '#lib/server/email.js';
import { clearSettings, getSettingsRow, saveSettings, toPublicSettings } from '#lib/server/settings.js';
import { canKeepPassword, notificationSettingsSchema } from '#lib/smtp.js';

export const getNotificationSettings = query(async () => {
	requireUser();
	return toPublicSettings(await getSettingsRow());
});

export const notificationSettings = form(notificationSettingsSchema, async (input, issue) => {
	requireUser();
	const { intent, _password, ...submitted } = input;
	const row = await getSettingsRow();
	let password = _password;
	if (password === '' && canKeepPassword(toPublicSettings(row), submitted)) {
		password = row?.notification_email_password ?? '';
	}
	if (password === '') invalid(issue._password('SMTP password is required'));
	const settings = { ...submitted, notification_email_password: password };

	if (intent === 'test') {
		const result = await sendTestEmail(settings);
		if (!result.success) invalid(result.error ?? 'Failed to send test email');
		return { tested: true };
	}
	await saveSettings(settings);
	return { saved: true };
});

export const clearNotificationSettings = form(async () => {
	requireUser();
	await clearSettings();
	return { cleared: true };
});
