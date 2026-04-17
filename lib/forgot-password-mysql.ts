/**
 * Optional fallback when Tomcat {@code UserAuthServlet} does not yet support {@code action=resetPassword}.
 * Uses the same rules as Kaos {@code DbHandler#resetPasswordByPhoneAndStreet} (BCrypt hashes).
 *
 * Enable with FORGOT_PASSWORD_MYSQL_* or reuse ONBOARDING_MYSQL_* from .env.local.
 */
import bcrypt from "bcryptjs"
import mysql from "mysql2/promise"
import { normalizePhoneDigitsForAuth } from "@/lib/rwanda-phone"

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

export async function resetPasswordViaMysql(
  telRaw: string,
  streetGuess: string,
  newPassword: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const cfg = mysqlConfig()
  if (!cfg) {
    return { ok: false, error: "no_db" }
  }

  const np = normalizePhoneDigitsForAuth(telRaw)
  if (!np) {
    return { ok: false, error: "Valid phone number required" }
  }
  const needle = streetGuess.trim().toLowerCase()
  if (!needle) {
    return { ok: false, error: "Street number or street name is required" }
  }
  if (newPassword.length < 6) {
    return { ok: false, error: "Password must be at least 6 characters" }
  }

  const hash = bcrypt.hashSync(newPassword, 10)
  const db = cfg.database

  let conn: mysql.Connection
  try {
    conn = await mysql.createConnection({
      host: cfg.host,
      user: cfg.user,
      password: cfg.password,
      database: cfg.database,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[forgot-password-mysql] connect failed", msg)
    return { ok: false, error: "Database connection failed" }
  }

  try {
    const [buyerRows] = await conn.query<mysql.RowDataPacket[]>(
      `SELECT id, loc_province, loc_district, loc_cell FROM ${db}.account_buyer WHERE tel = ? LIMIT 1`,
      [np]
    )
    if (buyerRows.length > 0) {
      const r = buyerRows[0]!
      const blob = `${String(r.loc_province ?? "")} ${String(r.loc_district ?? "")} ${String(r.loc_cell ?? "")}`.toLowerCase()
      if (!blob.includes(needle)) {
        return { ok: false, error: "Street does not match our records for this phone" }
      }
      const [res] = await conn.query(`UPDATE ${db}.account_buyer SET pwd_hash=? WHERE tel=?`, [hash, np])
      if ((res as mysql.ResultSetHeader).affectedRows > 0) {
        return { ok: true }
      }
    }

    const [sellerRows] = await conn.query<mysql.RowDataPacket[]>(
      `SELECT id, hq_location FROM ${db}.account_seller WHERE tel = ? LIMIT 1`,
      [np]
    )
    if (sellerRows.length > 0) {
      const hq = String(sellerRows[0]!.hq_location ?? "").toLowerCase()
      if (!hq.includes(needle)) {
        return { ok: false, error: "Street does not match our records for this phone" }
      }
      const [res] = await conn.query(`UPDATE ${db}.account_seller SET pwd_hash=? WHERE tel=?`, [hash, np])
      if ((res as mysql.ResultSetHeader).affectedRows > 0) {
        const digitsOnly = np.replace(/\D/g, "")
        await conn.query(
          `UPDATE ${db}.account_signup SET PWD=? WHERE REPLACE(REPLACE(REPLACE(REPLACE(TRIM(IFNULL(TEL,'')),' ',''),'+',''),'-',''),'(','') = ?`,
          [hash, digitsOnly]
        )
        return { ok: true }
      }
    }

    const digitsOnly = np.replace(/\D/g, "")
    const [signupRows] = await conn.query<mysql.RowDataPacket[]>(
      `SELECT EMAIL, HQ_LOCATION FROM ${db}.account_signup
       WHERE REPLACE(REPLACE(REPLACE(REPLACE(TRIM(IFNULL(TEL,'')),' ',''),'+',''),'-',''),'(','') = ?
       LIMIT 1`,
      [digitsOnly]
    )
    if (signupRows.length > 0) {
      const r = signupRows[0]!
      const hq = String(r.HQ_LOCATION ?? "").toLowerCase()
      if (!hq.includes(needle)) {
        return { ok: false, error: "Street does not match our records for this phone" }
      }
      const email = String(r.EMAIL ?? "")
      const [res] = await conn.query(`UPDATE ${db}.account_signup SET PWD=? WHERE EMAIL=?`, [hash, email])
      if ((res as mysql.ResultSetHeader).affectedRows > 0) {
        return { ok: true }
      }
    }

    return { ok: false, error: "No account found for this phone, or verification failed" }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[forgot-password-mysql]", msg)
    return { ok: false, error: "Password reset failed (database error)" }
  } finally {
    await conn.end()
  }
}
