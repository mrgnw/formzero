export type EmailConfig = {
	notification_email: string;
	notification_email_password: string;
	smtp_host: string;
	smtp_port: number;
};

export type SubmissionEmailData = {
	id: string;
	formId: string;
	formName: string;
	data: Record<string, any>;
	createdAt: number;
};
