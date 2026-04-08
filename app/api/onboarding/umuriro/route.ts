import { NextResponse } from "next/server"
import mysql from "mysql2/promise"

/**
 * Umuriro: minimal “shop contact + purchase line + MoMo USSD” payload.
 * Persists to `shop_onboarding_draft` when ONBOARDING_MYSQL_* is set (same as crazy-shopping).
 */

async function persistPayload(body: unknown): Promise<boolean> {
  const host = process.env.ONBOARDING_MYSQL_HOST
  const user = process.env.ONBOARDING_MYSQL_USER
  const password = process.env.ONBOARDING_MYSQL_PASSWORD
  const database = process.env.ONBOARDING_MYSQL_DATABASE
  if (!host || !user || password === undefined || !database) return false

  const conn = await mysql.createConnection({ host, user, password, database })
  try {
    await conn.query("INSERT INTO shop_onboarding_draft (payload_json) VALUES (?)", [
      JSON.stringify(body),
    ])
    return true
  } finally {
    await conn.end()
  }
}

export type UmuriroPayload = {
  kind: "umuriro"
  incompleteSeller: true
  savedBy: { email: string; name: string; phone: string }
  shop: { companyName: string; momoCode: string; momoDigits: string }
  line: {
    itemName: string
    unitPriceRwf: number
    quantity: number
    totalRwf: number
  }
  ussd: string
  submittedAt: string
}

export async function POST(req: Request) {
  const rid = crypto.randomUUID()
  try {
    const body = await req.json()
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "Invalid JSON", rid }, { status: 400 })
    }

    const record = body as Record<string, unknown>
    if (record.kind !== "umuriro") {
      return NextResponse.json({ ok: false, error: "Expected kind: umuriro", rid }, { status: 400 })
    }

    let persisted = false
    try {
      persisted = await persistPayload(body)
    } catch (e: unknown) {
      console.warn(`[umuriro ${rid}] draft insert:`, (e as Error)?.message || e)
    }

    if (!process.env.ONBOARDING_MYSQL_HOST) {
      console.log(`[umuriro ${rid}] No ONBOARDING_MYSQL_* — echo only`)
    }

    return NextResponse.json({
      ok: true,
      rid,
      persisted,
      message: persisted
        ? "Stored draft (if table exists)."
        : "Received. Add ONBOARDING_MYSQL_* + shop_onboarding_draft to persist.",
    })
  } catch (e: unknown) {
    console.error(`[umuriro ${rid}]`, e)
    return NextResponse.json({ ok: false, error: (e as Error)?.message || "error", rid }, { status: 500 })
  }
}
