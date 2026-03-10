/**
 * Soft-delete all completed tables (CLOSED, SENT, EXPIRED) for a supplier.
 * ACTIVE tables are not changed.
 * POST /api/supplier/tables/clear-completed?account=...
 */

import { NextRequest, NextResponse } from "next/server"
import { getOrdersUrl } from "@/lib/backend-config"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function POST(req: NextRequest) {
  const account = req.nextUrl.searchParams.get("account")?.trim()
  if (!account) {
    return NextResponse.json({ ok: false, error: "account required" }, { status: 400 })
  }

  try {
    const url = new URL(getOrdersUrl())
    url.searchParams.set("action", "softDeleteAllCompletedTables")
    url.searchParams.set("locationId", account)

    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { Accept: "application/json" },
      cache: "no-store",
    })

    const raw = await res.text()
    let data: { ok?: boolean; removedCount?: number; message?: string; error?: string }
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
        { ok: false, error: data.error || data.message || "Failed to clear tables" },
        { status: 400 }
      )
    }

    return NextResponse.json({
      ok: true,
      removedCount: data.removedCount ?? 0,
      message: data.message ?? "Completed tables cleared",
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to clear completed tables"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
