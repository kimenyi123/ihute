import { isMysqlUnreachableError } from "./onboarding-mysql"

export type OnboardingDbErrorCode =
  | "db_table_missing"
  | "db_invalid"
  | "db_unreachable"
  | "db_not_configured"
  | "db_error"

export function classifyOnboardingDbError(e: unknown): OnboardingDbErrorCode {
  const raw = e instanceof Error ? e.message : String(e)
  if (/ER_NO_SUCH_TABLE|doesn't exist/i.test(raw)) return "db_table_missing"
  if (/Invalid JSON|ER_INVALID_JSON_TEXT/i.test(raw)) return "db_invalid"
  if (
    isMysqlUnreachableError(e) ||
    /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|EHOSTUNREACH/i.test(raw) ||
    /connect (e)?timedout|database unreachable/i.test(raw)
  ) {
    return "db_unreachable"
  }
  if (/ONBOARDING_MYSQL/i.test(raw)) return "db_not_configured"
  return "db_error"
}

export function friendlyOnboardingDbError(e: unknown, shopName: string): string {
  const shop = shopName.trim() || "order"
  switch (classifyOnboardingDbError(e)) {
    case "db_table_missing":
      return `Quick Shop: could not save "${shop}" — database table missing (contact admin).`
    case "db_invalid":
      return `Quick Shop: could not save "${shop}" — invalid order data.`
    case "db_unreachable":
      return `Quick Shop: could not save "${shop}" — database unreachable.`
    case "db_not_configured":
      return `Quick Shop: database not configured on server.`
    default:
      return `Quick Shop: could not save "${shop}". Try again or contact support.`
  }
}
