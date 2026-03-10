/**
 * List all tables for a supplier (manual + QR): ACTIVE, SENT, CLOSED.
 * GET /api/supplier/tables?account=ALGGG0942009
 */

import { NextRequest, NextResponse } from "next/server"
import { getOrdersUrl } from "@/lib/backend-config"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(req: NextRequest) {
  const account = req.nextUrl.searchParams.get("account")?.trim()
  if (!account) {
    return NextResponse.json({ ok: false, error: "account required" }, { status: 400 })
  }

  try {
    const url = new URL(getOrdersUrl())
    url.searchParams.set("action", "getSupplierTables")
    url.searchParams.set("locationId", account)

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    })

    const raw = await res.text()
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: raw || "Failed to fetch tables" },
        { status: res.status }
      )
    }

    let data: { ok?: boolean; tables?: unknown[]; error?: string }
    try {
      data = JSON.parse(raw)
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid response from backend" },
        { status: 502 }
      )
    }

    if (!data.ok) {
      return NextResponse.json(
        { ok: false, error: data.error || "Failed to fetch tables" },
        { status: 400 }
      )
    }

    return NextResponse.json({
      ok: true,
      tables: data.tables ?? [],
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch tables"
    return NextResponse.json(
      { ok: false, error: message, tables: [] },
      { status: 200 }
    )
  }
}

/**
 * Soft-delete a completed table (CLOSED/SENT). POST body: { tableName }. Query: account=...
 */
export async function POST(req: NextRequest) {
  const account = req.nextUrl.searchParams.get("account")?.trim()
  if (!account) {
    return NextResponse.json({ ok: false, error: "account required" }, { status: 400 })
  }

  let body: { tableName?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "JSON body required" }, { status: 400 })
  }

  const tableName = (body?.tableName ?? "").trim()
  if (!tableName) {
    return NextResponse.json({ ok: false, error: "tableName required" }, { status: 400 })
  }

  try {
    const url = new URL(getOrdersUrl())
    url.searchParams.set("action", "softDeleteTable")
    url.searchParams.set("tableName", tableName)
    url.searchParams.set("locationId", account)

    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { Accept: "application/json" },
      cache: "no-store",
    })

    const raw = await res.text()
    let data: { ok?: boolean; message?: string; error?: string }
    try {
      data = JSON.parse(raw)
    } catch {
      return NextResponse.json(
        { ok: false, error: raw || "Invalid response from backend" },
        { status: 502 }
      )
    }

    if (!data.ok) {
      return NextResponse.json(
        { ok: false, error: data.error || data.message || "Failed to remove table" },
        { status: 400 }
      )
    }

    return NextResponse.json({ ok: true, message: data.message ?? "Table removed from list" })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to remove table"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
