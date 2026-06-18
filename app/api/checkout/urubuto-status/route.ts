import { NextRequest, NextResponse } from "next/server"
import { getServerProxyBackendBase } from "@/lib/backend-config"

const JAVA_BASE = getServerProxyBackendBase()

export async function GET(req: NextRequest) {
  try {
    const transactionId = req.nextUrl.searchParams.get("transactionId")?.trim()
    if (!transactionId) {
      return NextResponse.json({ ok: false, error: "transactionId is required" }, { status: 400 })
    }
    const url = `${JAVA_BASE}/api/checkout/urubuto-status?transactionId=${encodeURIComponent(transactionId)}`
    const resp = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    })
    const data = await resp.json().catch(() => ({}))
    return NextResponse.json(data, { status: resp.ok ? 200 : resp.status })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "UrubutoPay status check failed"
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
