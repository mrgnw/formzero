import { form, query } from '$app/server';
import { invalid } from '@sveltejs/kit';
import { requireUser } from '#lib/server/auth.js';
import { sendTestEmail, type SmtpFailure } from '#lib/server/email.js';
import { clearSettings, getSettingsRow, saveSettings, toPublicSettings } from '#lib/server/settings.js';
import { canKeepPassword, notificationSettingsSchema } from '#lib/smtp.js';

const TEST_EMAIL_ERRORS = {
	port: 'Use SMTP port 465, 587 or 2525.',
	connect: 'Could not connect to the SMTP server. Check the host and port.',
	auth: 'The SMTP server rejected the email or password.',
	tls: 'Could not set up a secure (TLS) connection with the SMTP server.',
	timeout: 'The SMTP server did not respond in time.',
	other: 'Could not send the test email.'
};

function testEmailError({ code, command, responseCode }: SmtpFailure = {}) {
	if (code === 'EPORT') return TEST_EMAIL_ERRORS.port;
	if (code === 'EAUTH' || responseCode === 535) return TEST_EMAIL_ERRORS.auth;
	if (code === 'ETLS' || command === 'STARTTLS') return TEST_EMAIL_ERRORS.tls;
	if (code === 'ETIMEDOUT' || code === 'ETIMEOUT') return TEST_EMAIL_ERRORS.timeout;
	if (code === 'ECONNECTION' || code === 'EDNS' || command === 'CONN') return TEST_EMAIL_ERRORS.connect;
	return TEST_EMAIL_ERRORS.other;
}

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
		if (!result.success) invalid(testEmailError(result.failure));
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
