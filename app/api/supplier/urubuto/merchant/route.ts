import { NextRequest, NextResponse } from "next/server"
import { getServerProxyBackendBase } from "@/lib/backend-config"

const JAVA_BASE = getServerProxyBackendBase()
const TARGET = `${JAVA_BASE}/api/urubutopay/supplier/merchant`

export async function GET(req: NextRequest) {
  try {
    const account = req.nextUrl.searchParams.get("account") || ""
    const url = `${TARGET}?account=${encodeURIComponent(account)}`
    const resp = await fetch(url, { method: "GET", cache: "no-store" })
    const data = await resp.json().catch(() => ({}))
    return NextResponse.json(data, { status: resp.ok ? 200 : resp.status })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load Urubuto merchant"
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const resp = await fetch(TARGET, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      cache: "no-store",
    })
    const data = await resp.json().catch(() => ({}))
    return NextResponse.json(data, { status: resp.ok ? 200 : resp.status })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to register Urubuto merchant"
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
