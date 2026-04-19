/**
 * Shared MySQL config for onboarding drafts + admin_grandma reads.
 * Same four keys as `.env.example` (ONBOARDING_MYSQL_*).
 */
export function getOnboardingMysqlConfig(): {
  host: string
  user: string
  password: string
  database: string
} | null {
  const host = process.env.ONBOARDING_MYSQL_HOST
  const user = process.env.ONBOARDING_MYSQL_USER
  const password = process.env.ONBOARDING_MYSQL_PASSWORD
  const database = process.env.ONBOARDING_MYSQL_DATABASE
  if (!host || !user || password === undefined || !database) return null
  return { host, user, password, database }
}
