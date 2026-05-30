import { NextRequest, NextResponse } from "next/server"
import { getServerProxyBackendBase } from "@/lib/backend-config"

const JAVA_BASE = getServerProxyBackendBase()

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const url = `${JAVA_BASE}/api/checkout/urubuto-pay`
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    })
    const data = await resp.json().catch(() => ({}))
    return NextResponse.json(data, { status: resp.ok ? 200 : resp.status })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "UrubutoPay initiation failed"
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
