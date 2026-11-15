export type Settings = {
  id: string
  notification_email: string | null
  notification_email_password: string | null
  smtp_host: string | null
  smtp_port: number | null
  smtp_secure: number
  updated_at: number
}
