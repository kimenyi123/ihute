import { NextRequest, NextResponse } from "next/server"
import { getBackendBaseForProxy, warmJavaBackendBase } from "@/lib/backend-config"
import { assertActivityLogsAccess } from "@/lib/verify-activity-logs-access"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const SERVLET_PATH = "/Kaos/ActivityLogsServlet"

export async function GET(req: NextRequest) {
  const denied = await assertActivityLogsAccess(req)
  if (denied) return denied

  await warmJavaBackendBase()
  const params = new URLSearchParams(req.nextUrl.searchParams)
  params.set("action", params.get("action") || "getShopReportSchedule")

  const adminEmail = req.headers.get("x-admin-email")?.trim()
  const adminToken = req.headers.get("x-admin-token")?.trim()
  if (adminEmail) params.set("adminEmail", adminEmail)
  if (adminToken) params.set("adminToken", adminToken)

  const url = `${getBackendBaseForProxy()}${SERVLET_PATH}?${params.toString()}`
  try {
    const resp = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(20_000) })
    const data = await resp.json().catch(() => ({ ok: false }))
    return NextResponse.json(data, { status: resp.ok ? 200 : resp.status })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Backend error" }, { status: 502 })
  }
}

export async function POST(req: NextRequest) {
  const denied = await assertActivityLogsAccess(req)
  if (denied) return denied

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const action = String(body.action || "sendShopAnalyticsReport")

  await warmJavaBackendBase()
  const params = new URLSearchParams()
  params.set("action", action)

  const adminEmail = req.headers.get("x-admin-email")?.trim()
  const adminToken = req.headers.get("x-admin-token")?.trim()
  if (adminEmail) params.set("adminEmail", adminEmail)
  if (adminToken) params.set("adminToken", adminToken)

  for (const key of [
    "recipientEmail",
    "from",
    "to",
    "sellerAccount",
    "compareSellers",
    "enabled",
    "frequency",
  ]) {
    const v = body[key]
    if (v != null && String(v).trim() !== "") params.set(key, String(v).trim())
  }

  const url = `${getBackendBaseForProxy()}${SERVLET_PATH}?${params.toString()}`
  try {
    const resp = await fetch(url, { method: "POST", cache: "no-store", signal: AbortSignal.timeout(30_000) })
    const data = await resp.json().catch(() => ({ ok: false }))
    return NextResponse.json(data, { status: resp.ok ? 200 : resp.status })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Backend error" }, { status: 502 })
  }
}
