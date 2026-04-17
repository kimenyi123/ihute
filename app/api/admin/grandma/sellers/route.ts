import { NextResponse } from "next/server"
import mysql from "mysql2/promise"
import { getOnboardingMysqlConfig } from "@/lib/onboarding-mysql"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function profileCompletion(row: Record<string, unknown>): number {
  const keys = [
    "email",
    "firstname",
    "lastname",
    "owner",
    "tel",
    "hq_location",
    "description",
    "momo",
    "preferedcategories",
    "photo",
    "tin",
    "department",
  ]
  let n = 0
  for (const k of keys) {
    const v = row[k]
    if (v != null && String(v).trim() !== "") n++
  }
  return Math.round((n / keys.length) * 100)
}

/**
 * Admin Grandma — seller list + profile completion %.
 * Uses ONBOARDING_MYSQL_* (same DB as Kaos `account_seller`).
 * UI is protected by AdminGuard; lock down this route in production if exposed publicly.
 */
export async function GET() {
  const cfg = getOnboardingMysqlConfig()
  if (!cfg) {
    return NextResponse.json({
      ok: true,
      sellers: [] as unknown[],
      message: "Set ONBOARDING_MYSQL_* in .env.local to load sellers.",
    })
  }

  let conn: mysql.Connection | null = null
  try {
    conn = await mysql.createConnection(cfg)
    const [rows] = await conn.query(
      `SELECT id, ishyiga_account, email, owner, tel, hq_location, firstname, lastname,
              status, description, momo, preferedcategories, photo, tin, department, created_at
       FROM account_seller
       ORDER BY id DESC
       LIMIT 500`
    )
    const list = Array.isArray(rows) ? rows : []
    const sellers = list.map((r) => {
      const row = r as Record<string, unknown>
      return {
        id: row.id,
        ishyiga_account: row.ishyiga_account,
        email: row.email,
        owner: row.owner,
        tel: row.tel,
        status: row.status,
        profileCompletion: profileCompletion(row),
        created_at: row.created_at,
      }
    })
    return NextResponse.json({ ok: true, sellers })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[admin/grandma/sellers]", msg)
    return NextResponse.json({ ok: false, error: msg, sellers: [] }, { status: 200 })
  } finally {
    if (conn) await conn.end()
  }
}
