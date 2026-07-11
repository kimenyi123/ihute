import { createOnboardingMysqlConnection } from "@/lib/onboarding-mysql"
import type { AdminOrderHeader } from "@/lib/ebm/types"
import { getEbmConfig } from "@/lib/ebm/config"

/** Prefer env TIN, then order seller TIN, then account_signup.TIN for seller account. */
export async function resolveEbmCompanyTin(
  order: AdminOrderHeader,
): Promise<string> {
  const fromEnv = getEbmConfig()?.companyTin?.trim()
  if (fromEnv) return fromEnv

  const fromOrder = String((order as AdminOrderHeader & { sellerTin?: string }).sellerTin ?? "").trim()
  if (fromOrder) return fromOrder

  const sellerAccount = String(order.sellerAccount ?? "").trim()
  if (!sellerAccount) return ""

  try {
    const conn = await createOnboardingMysqlConnection()
    try {
      const [rows] = await conn.query(
        `SELECT TIN FROM account_signup
         WHERE UPPER(TRIM(ISHYIGA_ACCOUNT)) = UPPER(TRIM(?))
         LIMIT 1`,
        [sellerAccount],
      )
      const list = Array.isArray(rows) ? rows : []
      const tin = String((list[0] as { TIN?: string } | undefined)?.TIN ?? "").trim()
      return tin
    } finally {
      await conn.end()
    }
  } catch {
    return ""
  }
}
