import { NextResponse } from "next/server"
import mysql from "mysql2/promise"
import { getOnboardingMysqlConfig } from "@/lib/onboarding-mysql"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type DraftRow = {
  id: number
  created_at: string
  kind: string | null
  shopName: string | null
  itemName: string | null
  totalRwf: number | null
}

/**
 * Umuriro / onboarding drafts pending admin validation (JSON in shop_onboarding_draft).
 */
export async function GET() {
  const cfg = getOnboardingMysqlConfig()
  if (!cfg) {
    return NextResponse.json({
      ok: true,
      pending: [] as DraftRow[],
      message: "Set ONBOARDING_MYSQL_* and run sql/shop_onboarding_draft.sql.",
    })
  }

  let conn: mysql.Connection | null = null
  try {
    conn = await mysql.createConnection(cfg)
    const [rows] = await conn.query(
      `SELECT id, created_at, payload_json
       FROM shop_onboarding_draft
       ORDER BY id DESC
       LIMIT 200`
    )
    const list = Array.isArray(rows) ? rows : []
    const all: DraftRow[] = []
    for (const raw of list) {
      const row = raw as { id: number; created_at: Date | string; payload_json: unknown }
      let j: Record<string, unknown> | null = null
      if (typeof row.payload_json === "string") {
        try {
          j = JSON.parse(row.payload_json) as Record<string, unknown>
        } catch {
          j = null
        }
      } else if (row.payload_json && typeof row.payload_json === "object") {
        j = row.payload_json as Record<string, unknown>
      }
      const kind = j && typeof j.kind === "string" ? j.kind : null
      const shop = j?.shop && typeof j.shop === "object" ? (j.shop as Record<string, unknown>) : null
      const line = j?.line && typeof j.line === "object" ? (j.line as Record<string, unknown>) : null
      const shopName = shop && typeof shop.companyName === "string" ? shop.companyName : null
      const itemName = line && typeof line.itemName === "string" ? line.itemName : null
      const totalRwf =
        line && typeof line.totalRwf === "number" && Number.isFinite(line.totalRwf)
          ? line.totalRwf
          : null
      all.push({
        id: row.id,
        created_at:
          row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
        kind,
        shopName,
        itemName,
        totalRwf,
      })
    }
    const umuriroOnly = all.filter((p) => p.kind === "umuriro")
    return NextResponse.json({
      ok: true,
      pending: umuriroOnly,
      totalDrafts: all.length,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[admin/grandma/pending-drafts]", msg)
    return NextResponse.json({ ok: false, error: msg, pending: [] }, { status: 200 })
  } finally {
    if (conn) await conn.end()
  }
}
