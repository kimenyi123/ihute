import { NextRequest, NextResponse } from "next/server"
import { getBackendBaseForProxy, warmJavaBackendBase } from "@/lib/backend-config"
import { assertActivityLogsAccess } from "@/lib/verify-activity-logs-access"

const SERVLET_PATH = "/Kaos/ActivityLogsServlet"

export type ActivityLogsServletAction =
  | "getActivityLogs"
  | "getActivitySummary"
  | "getIhuteCommercialStats"
  | "getSellersWithStock"

export async function proxyActivityLogsServlet(
  req: NextRequest,
  action: ActivityLogsServletAction,
): Promise<NextResponse> {
  const denied = await assertActivityLogsAccess(req)
  if (denied) return denied

  await warmJavaBackendBase()
  const params = new URLSearchParams(req.nextUrl.searchParams)
  params.set("action", action)

  const adminEmail = req.headers.get("x-admin-email")?.trim()
  const adminToken = req.headers.get("x-admin-token")?.trim()
  if (adminEmail) params.set("adminEmail", adminEmail)
  if (adminToken) params.set("adminToken", adminToken)

  const url = `${getBackendBaseForProxy()}${SERVLET_PATH}?${params.toString()}`
  // Redis list: MySQL accounts + pipelined GET; still allow headroom under load
  const timeoutMs = action === "getSellersWithStock" ? 120_000 : 30_000

  try {
    const resp = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    })

    const contentType = resp.headers.get("content-type") || ""
    if (contentType.includes("application/json")) {
      const data = await resp.json().catch(() => ({ ok: false, error: "Invalid JSON from backend" }))
      return NextResponse.json(data, { status: resp.ok ? 200 : resp.status })
    }

    const text = await resp.text().catch(() => "")
    return NextResponse.json(
      {
        ok: false,
        error: "Backend returned non-JSON response",
        upstreamStatus: resp.status,
        upstreamBodySnippet: text.slice(0, 200),
      },
      { status: 502 },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Backend request failed"
    return NextResponse.json(
      { ok: false, error: msg, hint: "Check BACKEND_URL and that Tomcat is running with ActivityLogsServlet deployed." },
      { status: 502 },
    )
  }
}
