import { NextRequest, NextResponse } from "next/server"
import { getServerProxyBackendBase } from "@/lib/backend-config"

const JAVA_BASE = getServerProxyBackendBase()

export async function GET(req: NextRequest) {
  try {
    const account = req.nextUrl.searchParams.get("account") || ""
    const limit = req.nextUrl.searchParams.get("limit") || "20"
    const unreadOnly = req.nextUrl.searchParams.get("unreadOnly") || ""
    const qs = new URLSearchParams()
    qs.set("account", account)
    qs.set("limit", limit)
    if (unreadOnly) qs.set("unreadOnly", unreadOnly)
    const url = `${JAVA_BASE}/api/urubutopay/supplier/notifications?${qs}`
    const resp = await fetch(url, { method: "GET", cache: "no-store" })
    const data = await resp.json().catch(() => ({}))
    return NextResponse.json(data, { status: resp.ok ? 200 : resp.status })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load Urubuto notifications"
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const url = `${JAVA_BASE}/api/urubutopay/supplier/notifications`
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    })
    const data = await resp.json().catch(() => ({}))
    return NextResponse.json(data, { status: resp.ok ? 200 : resp.status })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to mark notifications read"
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
