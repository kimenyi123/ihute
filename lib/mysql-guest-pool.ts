import mysql, { type RowDataPacket } from "mysql2/promise"
import { GUEST_POOL_EMAIL } from "@/lib/guest-checkout"

/**
 * Same database as app/api/supplier/add-product — edit if your MySQL differs.
 */
const GUEST_POOL_MYSQL = {
  host: "localhost",
  user: "root",
  password: "Algo@12345",
  database: "chaos_test",
} as const

let pool: mysql.Pool | null = null

function getPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      ...GUEST_POOL_MYSQL,
      waitForConnections: true,
      connectionLimit: 4,
      queueLimit: 0,
    })
  }
  return pool
}

const ISHYIGA_PREFIX = "IHUTE_GUEST"

/**
 * If guest_pool@ihute.rw exists in account_signup, return its ISHYIGA_ACCOUNT.
 * Otherwise INSERT — STATUS omitted (DB default: LIVE).
 */
export async function ensureGuestPoolRowInDb(): Promise<{
  ok: boolean
  ishyigaAccount?: string
  inserted: boolean
  error?: string
}> {
  const email = GUEST_POOL_EMAIL

  try {
    const p = getPool()

    const [existing] = await p.execute<RowDataPacket[]>(
      `SELECT ISHYIGA_ACCOUNT FROM account_signup WHERE EMAIL = ? LIMIT 1`,
      [email],
    )
    if (existing.length > 0) {
      const ish = String(existing[0]?.ISHYIGA_ACCOUNT ?? "").trim()
      if (ish) {
        return { ok: true, ishyigaAccount: ish, inserted: false }
      }
    }

    const candidates: string[] = [
      ISHYIGA_PREFIX,
      `${ISHYIGA_PREFIX}_${Date.now()}`,
      `${ISHYIGA_PREFIX}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    ]
    for (let attempt = 0; attempt < 10; attempt++) {
      const account =
        attempt < candidates.length
          ? candidates[attempt]!
          : `${ISHYIGA_PREFIX}_${Date.now()}_${attempt}_${Math.random().toString(36).slice(2, 12)}`

      try {
        await p.execute(
          `INSERT INTO account_signup (EMAIL, ISHYIGA_ACCOUNT, TEL, TYPE, FIRSTNAME, LASTNAME, OWNER, PWD)
           VALUES (?, ?, 'NA', 'BUYER', 'Guest', 'Checkout', 'Guest pool', '')`,
          [email, account],
        )
        return { ok: true, ishyigaAccount: account, inserted: true }
      } catch (e: unknown) {
        const err = e as { code?: string; errno?: number; message?: string }
        if (err.code === "ER_DUP_ENTRY" || err.errno === 1062) {
          const [again] = await p.execute<RowDataPacket[]>(
            `SELECT ISHYIGA_ACCOUNT FROM account_signup WHERE EMAIL = ? LIMIT 1`,
            [email],
          )
          if (again.length > 0) {
            const ish = String(again[0]?.ISHYIGA_ACCOUNT ?? "").trim()
            if (ish) return { ok: true, ishyigaAccount: ish, inserted: false }
          }
          continue
        }
        return { ok: false, inserted: false, error: err.message || String(e) }
      }
    }

    return { ok: false, inserted: false, error: "Could not insert guest pool row after retries" }
  } catch (e: unknown) {
    return {
      ok: false,
      inserted: false,
      error: e instanceof Error ? e.message : String(e),
    }
  }
}
