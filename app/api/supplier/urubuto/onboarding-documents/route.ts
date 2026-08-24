import { NextRequest, NextResponse } from "next/server"
import { getServerProxyBackendBase } from "@/lib/backend-config"

const JAVA_BASE = getServerProxyBackendBase()
const TARGET = `${JAVA_BASE}/api/urubutopay/supplier/onboarding-documents`

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const resp = await fetch(TARGET, {
      method: "POST",
      body: formData,
      cache: "no-store",
    })
    const text = await resp.text()
    let data: unknown = {}
    try {
      data = text ? JSON.parse(text) : {}
    } catch {
      data = { raw: text }
    }
    return NextResponse.json(data as object, { status: resp.ok ? 200 : resp.status })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Upload failed"
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
