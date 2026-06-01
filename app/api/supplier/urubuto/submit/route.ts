import { NextRequest, NextResponse } from "next/server"
import { getServerProxyBackendBase } from "@/lib/backend-config"

const JAVA_BASE = getServerProxyBackendBase()
const TARGET = `${JAVA_BASE}/api/urubutopay/supplier/submit`

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const resp = await fetch(TARGET, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    })
    const data = await resp.json().catch(() => ({}))
    return NextResponse.json(data, { status: resp.ok ? 200 : resp.status })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Submit failed"
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
