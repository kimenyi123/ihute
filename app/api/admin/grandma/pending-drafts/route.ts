import { NextResponse } from "next/server"
import mysql from "mysql2/promise"
import { getOnboardingMysqlConfig } from "@/lib/onboarding-mysql"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export type DraftRow = {
  id: number
  created_at: string
  kind: string | null
  shopName: string | null
  itemName: string | null
  totalRwf: number | null
  rid: string | null
  momo: string | null
}

function nz(v: unknown): string {
  return v == null ? "" : String(v).trim()
}

function num(v: unknown): number | null {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function asIso(v: unknown): string {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString()
  return nz(v)
}

function quoteIdent(name: string): string {
  return `\`${name.replace(/`/g, "")}\``
}

function parsePayload(raw: unknown): Record<string, unknown> | null {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, unknown>
    } catch {
      return null
    }
  }
  if (raw && typeof raw === "object") return raw as Record<string, unknown>
  return null
}

function mapDraft(row: { id: unknown; created_at: unknown; payload_json: unknown }): DraftRow {
  const j = parsePayload(row.payload_json)
  const shop = j?.shop && typeof j.shop === "object" ? (j.shop as Record<string, unknown>) : null
  const line = j?.line && typeof j.line === "object" ? (j.line as Record<string, unknown>) : null
  const lines = Array.isArray(j?.lines) ? (j?.lines as Record<string, unknown>[]) : []
  const itemFromLines = lines
    .map((l) => nz(l.itemName || l.item_name))
    .filter(Boolean)
    .join(", ")
  const totalFromLines = lines.reduce((sum, l) => sum + (num(l.lineTotalRwf ?? l.totalRwf) ?? 0), 0)
  return {
    id: Number(row.id) || 0,
    created_at: asIso(row.created_at),
    kind: typeof j?.kind === "string" ? j.kind : null,
    shopName:
      (shop && (nz(shop.companyName) || nz(shop.name))) ||
      nz(j?.sellerName) ||
      nz(j?.shopName) ||
      null,
    itemName: (line && nz(line.itemName)) || itemFromLines || null,
    totalRwf: (line && num(line.totalRwf)) || (totalFromLines > 0 ? totalFromLines : null),
    rid: nz(j?.rid) || null,
    momo: (shop && (nz(shop.momoCode) || nz(shop.momoDigits))) || nz(j?.momo) || null,
  }
}

async function resolveDraftSchema(conn: mysql.Connection, preferred: string): Promise<string | null> {
  const [rows] = await conn.query(
    `SELECT TABLE_SCHEMA AS schemaName
     FROM information_schema.TABLES
     WHERE TABLE_NAME = 'shop_onboarding_draft' AND TABLE_TYPE = 'BASE TABLE'
     ORDER BY CASE WHEN TABLE_SCHEMA = ? THEN 0 ELSE 1 END, TABLE_ROWS DESC
     LIMIT 8`,
    [preferred],
  )
  const list = Array.isArray(rows) ? rows : []
  const first = list[0] as { schemaName?: unknown } | undefined
  const name = first?.schemaName != null ? String(first.schemaName).trim() : ""
  return name || null
}

/**
 * All rows from shop_onboarding_draft (Umuriro + other onboarding JSON).
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
    const schema = await resolveDraftSchema(conn, cfg.database)
    if (!schema) {
      return NextResponse.json({
        ok: false,
        pending: [] as DraftRow[],
        error: "shop_onboarding_draft was not found on this MySQL server.",
      })
    }
    const qSchema = quoteIdent(schema)
    const [rows] = await conn.query(
      `SELECT id, created_at, payload_json
       FROM ${qSchema}.shop_onboarding_draft
       ORDER BY id DESC
       LIMIT 400`,
    )
    const pending = (Array.isArray(rows) ? rows : []).map((raw) =>
      mapDraft(raw as { id: unknown; created_at: unknown; payload_json: unknown }),
    )
    return NextResponse.json({ ok: true, pending, totalDrafts: pending.length })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[admin/grandma/pending-drafts]", msg)
    return NextResponse.json({ ok: false, error: msg, pending: [] as DraftRow[] }, { status: 200 })
  } finally {
    if (conn) await conn.end()
  }
}
