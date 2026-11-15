export async function resolveSmtpPassword(
  database: D1Database,
  submittedPassword: string,
  smtp_host: string,
  smtp_port: string
): Promise<string | null> {
  if (submittedPassword) {
    return submittedPassword
  }

  const stored = await database
    .prepare("SELECT notification_email_password, smtp_host, smtp_port FROM settings WHERE id = 'global'")
    .first<{ notification_email_password: string | null; smtp_host: string | null; smtp_port: number | null }>()

  if (stored?.smtp_host === smtp_host && stored.smtp_port === parseInt(smtp_port, 10)) {
    return stored.notification_email_password
  }

  return null
}
