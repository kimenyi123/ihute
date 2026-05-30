import { NextRequest, NextResponse } from "next/server"
import { getServerProxyBackendBase } from "@/lib/backend-config"

const JAVA_BASE = getServerProxyBackendBase()

export async function GET(req: NextRequest) {
  try {
    const account =
      req.nextUrl.searchParams.get("account") ||
      req.nextUrl.searchParams.get("sellerAccount") ||
      ""
    const url = `${JAVA_BASE}/api/checkout/urubuto-eligibility?account=${encodeURIComponent(account)}`
    const resp = await fetch(url, { method: "GET", cache: "no-store" })
    const data = await resp.json().catch(() => ({}))
    return NextResponse.json(data, { status: resp.ok ? 200 : resp.status })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to check UrubutoPay"
    return NextResponse.json({ ok: false, eligible: false, error: msg }, { status: 500 })
  }
}
