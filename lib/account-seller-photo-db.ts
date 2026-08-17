/**
 * Persist shop logo URL on chaos_beta.account_seller.photo (varchar 255).
 * Uses ONBOARDING_MYSQL_* / FORGOT_PASSWORD_MYSQL_* from .env.local.
 */
import mysql from "mysql2/promise"

function mysqlConfig(): {
  host: string
  user: string
  password: string
  database: string
} | null {
  const host = process.env.FORGOT_PASSWORD_MYSQL_HOST || process.env.ONBOARDING_MYSQL_HOST
  const user = process.env.FORGOT_PASSWORD_MYSQL_USER || process.env.ONBOARDING_MYSQL_USER
  const password = process.env.FORGOT_PASSWORD_MYSQL_PASSWORD ?? process.env.ONBOARDING_MYSQL_PASSWORD
  const database = process.env.FORGOT_PASSWORD_MYSQL_DATABASE || process.env.ONBOARDING_MYSQL_DATABASE
  if (!host || !user || password === undefined || !database) return null
  return { host, user, password, database }
}

/** Relative or absolute URL saved in account_seller.photo */
export function normalizePhotoColumnValue(url: string): string {
  return String(url || "").trim().slice(0, 255)
}

export async function updateAccountSellerPhoto(
  account: string,
  photoUrl: string,
): Promise<{ ok: boolean; error?: string; owner?: string }> {
  const cfg = mysqlConfig()
  const acc = String(account || "").trim()
  const photo = normalizePhotoColumnValue(photoUrl)
  if (!acc || !photo) {
    return { ok: false, error: "account and photo URL required" }
  }
  if (!cfg) {
    return { ok: false, error: "MySQL not configured (ONBOARDING_MYSQL_* in .env.local)" }
  }

  let conn: mysql.Connection | null = null
  try {
    conn = await mysql.createConnection({
      host: cfg.host,
      user: cfg.user,
      password: cfg.password,
      database: cfg.database,
    })

    const [ownerRows] = await conn.execute(
      `SELECT owner FROM \`${cfg.database}\`.account_seller WHERE ISHYIGA_ACCOUNT = ? LIMIT 1`,
      [acc],
    )
    const ownerRow = (ownerRows as { owner?: string | null }[])[0]
    const owner = ownerRow?.owner != null ? String(ownerRow.owner).trim() : ""

    const [result] = await conn.execute(
      `UPDATE \`${cfg.database}\`.account_seller SET photo = ? WHERE ISHYIGA_ACCOUNT = ? LIMIT 1`,
      [photo, acc],
    )
    const affected = (result as mysql.ResultSetHeader).affectedRows ?? 0
    if (affected === 0) {
      return { ok: false, error: "Seller account not found in account_seller" }
    }

    const sellerLabel = owner || acc
    console.log(
      `[account/photo] Image saved successfully for seller ${sellerLabel} (${acc}) → photo=${photo}`,
    )

    return { ok: true, owner: owner || undefined }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Database update failed"
    console.error(`[account/photo] Failed to save image for ${acc}:`, msg)
    return { ok: false, error: msg }
  } finally {
    await conn?.end()
  }
}

export async function getAccountSellerPhoto(account: string): Promise<string | null> {
  const cfg = mysqlConfig()
  const acc = String(account || "").trim()
  if (!acc || !cfg) return null

  let conn: mysql.Connection | null = null
  try {
    conn = await mysql.createConnection({
      host: cfg.host,
      user: cfg.user,
      password: cfg.password,
      database: cfg.database,
    })
    const [rows] = await conn.execute(
      `SELECT photo FROM \`${cfg.database}\`.account_seller WHERE ISHYIGA_ACCOUNT = ? LIMIT 1`,
      [acc],
    )
    const row = (rows as { photo?: string | null }[])[0]
    const photo = row?.photo != null ? String(row.photo).trim() : ""
    return photo || null
  } catch {
    return null
  } finally {
    await conn?.end()
  }
}
