import * as v from 'valibot';

export type SmtpProvider = { host: string; port: number; hint: string };

export const SMTP_PROVIDERS: Record<string, SmtpProvider> = {
	'gmail.com': {
		host: 'smtp.gmail.com',
		port: 587,
		hint: 'For Gmail, use an App Password instead of your regular password. Go to Google Account → Security → 2-Step Verification → App passwords.'
	},
	'outlook.com': {
		host: 'smtp-mail.outlook.com',
		port: 587,
		hint: 'For Outlook, use your regular Microsoft account password or an App Password if you have 2FA enabled.'
	},
	'hotmail.com': {
		host: 'smtp-mail.outlook.com',
		port: 587,
		hint: 'For Hotmail, use your regular Microsoft account password or an App Password if you have 2FA enabled.'
	},
	'yahoo.com': {
		host: 'smtp.mail.yahoo.com',
		port: 587,
		hint: 'For Yahoo, generate an App Password at: Account Info → Account Security → Generate app password.'
	},
	'icloud.com': {
		host: 'smtp.mail.me.com',
		port: 587,
		hint: 'For iCloud, use an App-Specific Password. Go to appleid.apple.com → Sign-In and Security → App-Specific Passwords.'
	}
};

export function emailDomain(email: string) {
	return email.match(/@(.+)$/)?.[1].toLowerCase() ?? null;
}

export type SavedNotificationSettings = {
	notification_email: string;
	smtp_host: string;
	smtp_port: number;
	has_password: boolean;
	updated_at: number;
};

export function canKeepPassword(
	saved: SavedNotificationSettings | null,
	submitted: { notification_email: string; smtp_host: string; smtp_port: number }
) {
	return (
		saved !== null &&
		saved.has_password &&
		saved.notification_email === submitted.notification_email &&
		saved.smtp_host === submitted.smtp_host &&
		saved.smtp_port === submitted.smtp_port
	);
}

export const notificationSettingsSchema = v.object({
	intent: v.picklist(['test', 'save']),
	notification_email: v.pipe(
		v.string(),
		v.trim(),
		v.nonEmpty('Email is required'),
		v.email('Enter a valid email address')
	),
	_password: v.optional(v.string(), ''),
	smtp_host: v.pipe(v.string(), v.trim(), v.nonEmpty('SMTP host is required')),
	smtp_port: v.pipe(
		v.number('SMTP port is required'),
		v.integer('Enter a whole number'),
		v.minValue(1, 'Enter a port between 1 and 65535'),
		v.maxValue(65535, 'Enter a port between 1 and 65535')
	)
});
