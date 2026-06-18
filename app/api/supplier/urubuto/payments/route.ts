import { NextRequest, NextResponse } from "next/server"
import { getServerProxyBackendBase } from "@/lib/backend-config"

const JAVA_BASE = getServerProxyBackendBase()

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const account = sp.get("account") || ""
    const limit = sp.get("limit") || "50"
    const offset = sp.get("offset") || "0"
    const method = sp.get("method") || ""
    const status = sp.get("status") || ""
    const dateFrom = sp.get("dateFrom") || ""
    const dateTo = sp.get("dateTo") || ""
    const search = sp.get("search") || ""
    const qs = new URLSearchParams()
    qs.set("account", account)
    qs.set("limit", limit)
    qs.set("offset", offset)
    if (method) qs.set("method", method)
    if (status) qs.set("status", status)
    if (dateFrom) qs.set("dateFrom", dateFrom)
    if (dateTo) qs.set("dateTo", dateTo)
    if (search) qs.set("search", search)
    const url = `${JAVA_BASE}/api/urubutopay/supplier/payments?${qs}`
    const resp = await fetch(url, { method: "GET", cache: "no-store" })
    const data = await resp.json().catch(() => ({}))
    return NextResponse.json(data, { status: resp.ok ? 200 : resp.status })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load Urubuto payments"
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
