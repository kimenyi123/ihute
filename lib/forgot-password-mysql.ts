/**
 * Optional fallback when Tomcat {@code UserAuthServlet} does not yet support {@code action=resetPassword}.
 * Mirrors Kaos {@code DbHandler#resetPasswordByPhoneAndStreet} (BCrypt, flexible tel, address hint).
 *
 * Enable with FORGOT_PASSWORD_MYSQL_* or reuse ONBOARDING_MYSQL_* from .env.local.
 */
import bcrypt from "bcryptjs"
import mysql from "mysql2/promise"
import {
  coerceTelRawForPasswordReset,
  normalizePhoneDigitsForAuth,
  rwSyntheticPlaceholderEmailsFromRaw,
} from "@/lib/rwanda-phone"

function normalizeAddressComparable(s: string): string {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\u00b7/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function addressHintMatches(haystackLower: string, needleLower: string): boolean {
  const h = normalizeAddressComparable(haystackLower)
  const n = normalizeAddressComparable(needleLower)
  return n.length > 0 && h.includes(n)
}

function isEffectivelyNoSavedAddress(blobOrHqLower: string): boolean {
  const s = normalizeAddressComparable(blobOrHqLower)
  if (s.length < 2) return true
  return s === "na" || s === "n/a" || s === "null"
}

function addressOkForReset(blobOrHqLower: string, needleLower: string): boolean {
  return addressHintMatches(blobOrHqLower, needleLower) || isEffectivelyNoSavedAddress(blobOrHqLower)
}

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
  telRaw = coerceTelRawForPasswordReset(telRaw)
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
  const digitsOnly = np.replace(/\D/g, "")
  const last9 = digitsOnly.length > 9 ? digitsOnly.slice(-9) : digitsOnly
  const telNorm = `REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(IFNULL(tel,'')),' ',''),'+',''),'-',''),'(',''),')','')`
  const telNormSignup = `REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(IFNULL(TEL,'')),' ',''),'+',''),'-',''),'(',''),')','')`

  let conn: mysql.Connection
  try {
    conn = await mysql.createConnection({
      host: cfg.host,
      user: cfg.user,
      password: cfg.password,
      database: cfg.database,
      connectTimeout: 10_000,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[forgot-password-mysql] connect failed", msg)
    return { ok: false, error: "Database connection failed" }
  }

  try {
    const synEmails = rwSyntheticPlaceholderEmailsFromRaw(telRaw)

    const [buyerRows] = await conn.query<mysql.RowDataPacket[]>(
      `SELECT id, tel, loc_province, loc_district, loc_cell FROM ${db}.account_buyer WHERE ${telNorm} = ? OR RIGHT(${telNorm}, 9) = ? ORDER BY CASE WHEN ${telNorm} = ? THEN 0 WHEN RIGHT(${telNorm}, 9) = ? THEN 1 ELSE 2 END, id DESC LIMIT 1`,
      [digitsOnly, last9, digitsOnly, last9]
    )
    if (buyerRows.length > 0) {
      const r = buyerRows[0]!
      const blob = `${String(r.loc_province ?? "")} ${String(r.loc_district ?? "")} ${String(r.loc_cell ?? "")}`.toLowerCase()
      if (!addressOkForReset(blob, needle)) {
        return { ok: false, error: "Street does not match our records for this phone" }
      }
      const [res] = await conn.query(`UPDATE ${db}.account_buyer SET pwd_hash=? WHERE id=?`, [hash, r.id])
      if ((res as mysql.ResultSetHeader).affectedRows > 0) {
        return { ok: true }
      }
    }

    for (const em of synEmails) {
      const [brE] = await conn.query<mysql.RowDataPacket[]>(
        `SELECT id, tel, loc_province, loc_district, loc_cell FROM ${db}.account_buyer WHERE LOWER(TRIM(IFNULL(email,''))) = LOWER(?) LIMIT 1`,
        [em]
      )
      if (brE.length > 0) {
        const r = brE[0]!
        const blob = `${String(r.loc_province ?? "")} ${String(r.loc_district ?? "")} ${String(r.loc_cell ?? "")}`.toLowerCase()
        if (!addressOkForReset(blob, needle)) {
          return { ok: false, error: "Street does not match our records for this phone" }
        }
        const [res] = await conn.query(`UPDATE ${db}.account_buyer SET pwd_hash=? WHERE id=?`, [hash, r.id])
        if ((res as mysql.ResultSetHeader).affectedRows > 0) {
          return { ok: true }
        }
      }
    }

    const [sellerRows] = await conn.query<mysql.RowDataPacket[]>(
      `SELECT id, tel, hq_location FROM ${db}.account_seller WHERE ${telNorm} = ? OR RIGHT(${telNorm}, 9) = ? ORDER BY CASE WHEN ${telNorm} = ? THEN 0 WHEN RIGHT(${telNorm}, 9) = ? THEN 1 ELSE 2 END, id DESC LIMIT 1`,
      [digitsOnly, last9, digitsOnly, last9]
    )
    if (sellerRows.length > 0) {
      const row = sellerRows[0]!
      const hq = String(row.hq_location ?? "").toLowerCase()
      if (!addressOkForReset(hq, needle)) {
        return { ok: false, error: "Street does not match our records for this phone" }
      }
      const [res] = await conn.query(`UPDATE ${db}.account_seller SET pwd_hash=? WHERE id=?`, [hash, row.id])
      if ((res as mysql.ResultSetHeader).affectedRows > 0) {
        const telStored = String(row.tel ?? "").trim() || np
        const syncDigits = telStored.replace(/\D/g, "")
        const syncLast9 = syncDigits.length > 9 ? syncDigits.slice(-9) : syncDigits
        await conn.query(
          `UPDATE ${db}.account_signup SET PWD=? WHERE ${telNormSignup} = ? OR RIGHT(${telNormSignup}, 9) = ?`,
          [hash, syncDigits, syncLast9]
        )
        return { ok: true }
      }
    }

    for (const em of synEmails) {
      const [srE] = await conn.query<mysql.RowDataPacket[]>(
        `SELECT id, tel, hq_location FROM ${db}.account_seller WHERE LOWER(TRIM(IFNULL(email,''))) = LOWER(?) LIMIT 1`,
        [em]
      )
      if (srE.length > 0) {
        const row = srE[0]!
        const hq = String(row.hq_location ?? "").toLowerCase()
        if (!addressOkForReset(hq, needle)) {
          return { ok: false, error: "Street does not match our records for this phone" }
        }
        const [res] = await conn.query(`UPDATE ${db}.account_seller SET pwd_hash=? WHERE id=?`, [hash, row.id])
        if ((res as mysql.ResultSetHeader).affectedRows > 0) {
          const telStored = String(row.tel ?? "").trim() || np
          const syncDigits = telStored.replace(/\D/g, "")
          const syncLast9 = syncDigits.length > 9 ? syncDigits.slice(-9) : syncDigits
          await conn.query(
            `UPDATE ${db}.account_signup SET PWD=? WHERE ${telNormSignup} = ? OR RIGHT(${telNormSignup}, 9) = ?`,
            [hash, syncDigits, syncLast9]
          )
          return { ok: true }
        }
      }
    }

    const likePat = `%${last9}%`
    const [looseSellers] = await conn.query<mysql.RowDataPacket[]>(
      `SELECT id, tel, hq_location, email FROM ${db}.account_seller WHERE TRIM(IFNULL(email,'')) LIKE '%@%' AND LOWER(TRIM(email)) LIKE LOWER(?) LIMIT 10`,
      [likePat]
    )
    for (const row of looseSellers) {
      const hq = String(row.hq_location ?? "").toLowerCase()
      if (!addressOkForReset(hq, needle)) continue
      const [res] = await conn.query(`UPDATE ${db}.account_seller SET pwd_hash=? WHERE id=?`, [hash, row.id])
      if ((res as mysql.ResultSetHeader).affectedRows > 0) {
        const telStored = String(row.tel ?? "").trim() || np
        const syncDigits = telStored.replace(/\D/g, "")
        const syncLast9 = syncDigits.length > 9 ? syncDigits.slice(-9) : syncDigits
        await conn.query(
          `UPDATE ${db}.account_signup SET PWD=? WHERE ${telNormSignup} = ? OR RIGHT(${telNormSignup}, 9) = ?`,
          [hash, syncDigits, syncLast9]
        )
        return { ok: true }
      }
    }

    const [signupRows] = await conn.query<mysql.RowDataPacket[]>(
      `SELECT EMAIL, HQ_LOCATION FROM ${db}.account_signup
       WHERE ${telNormSignup} = ? OR RIGHT(${telNormSignup}, 9) = ?
       ORDER BY \`ID\` DESC LIMIT 1`,
      [digitsOnly, last9]
    )
    if (signupRows.length > 0) {
      const r = signupRows[0]!
      const hq = String(r.HQ_LOCATION ?? "").toLowerCase()
      if (!addressOkForReset(hq, needle)) {
        return { ok: false, error: "Street does not match our records for this phone" }
      }
      const email = String(r.EMAIL ?? "")
      const [res] = await conn.query(`UPDATE ${db}.account_signup SET PWD=? WHERE EMAIL=?`, [hash, email])
      if ((res as mysql.ResultSetHeader).affectedRows > 0) {
        return { ok: true }
      }
    }

    for (const em of synEmails) {
      const [suE] = await conn.query<mysql.RowDataPacket[]>(
        `SELECT EMAIL, HQ_LOCATION FROM ${db}.account_signup WHERE LOWER(TRIM(IFNULL(email,''))) = LOWER(?) LIMIT 1`,
        [em]
      )
      if (suE.length > 0) {
        const r = suE[0]!
        const hq = String(r.HQ_LOCATION ?? "").toLowerCase()
        if (!addressOkForReset(hq, needle)) {
          return { ok: false, error: "Street does not match our records for this phone" }
        }
        const email = String(r.EMAIL ?? "")
        const [res] = await conn.query(`UPDATE ${db}.account_signup SET PWD=? WHERE EMAIL=?`, [hash, email])
        if ((res as mysql.ResultSetHeader).affectedRows > 0) {
          return { ok: true }
        }
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
