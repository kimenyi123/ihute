import { NextRequest, NextResponse } from "next/server"
import { getServerProxyBackendBase } from "@/lib/backend-config"

const JAVA_BASE = getServerProxyBackendBase()

export async function GET(req: NextRequest) {
  try {
    const account =
      req.nextUrl.searchParams.get("account") ||
      req.nextUrl.searchParams.get("sellerAccount") ||
      ""
    const q = account ? `?account=${encodeURIComponent(account)}` : ""
    const url = `${JAVA_BASE}/api/checkout/azampay-eligibility${q}`
    const resp = await fetch(url, { method: "GET", cache: "no-store" })
    const data = await resp.json().catch(() => ({}))
    return NextResponse.json(data, { status: resp.ok ? 200 : resp.status })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to check AzamPay"
    return NextResponse.json({ ok: false, eligible: false, error: msg }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const account =
      (typeof body.account === "string" && body.account) ||
      (typeof body.sellerAccount === "string" && body.sellerAccount) ||
      ""
    const q = account ? `?account=${encodeURIComponent(account)}` : ""
    const url = `${JAVA_BASE}/api/checkout/azampay-eligibility${q}`
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    })
    const data = await resp.json().catch(() => ({}))
    return NextResponse.json(data, { status: resp.ok ? 200 : resp.status })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to check AzamPay"
    return NextResponse.json({ ok: false, eligible: false, error: msg }, { status: 500 })
  }
}
