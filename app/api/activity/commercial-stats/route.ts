import { NextRequest, NextResponse } from "next/server"
import { decodeOrderMonitorDb } from "@/lib/admin-order-db"
import { fetchCommercialStatsFromMysql } from "@/lib/activity-commercial-stats"
import { proxyActivityLogsServlet } from "@/lib/activity-logs-java-proxy"
import { assertActivityLogsAccess } from "@/lib/verify-activity-logs-access"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const denied = await assertActivityLogsAccess(req)
  if (denied) return denied

  const from = req.nextUrl.searchParams.get("from")?.trim() || ""
  const to = req.nextUrl.searchParams.get("to")?.trim() || ""
  const environment = req.nextUrl.searchParams.get("environment")?.trim() || ""
  const sellerAccount = req.nextUrl.searchParams.get("sellerAccount")?.trim() || ""
  const compareSellers = req.nextUrl.searchParams.get("compareSellers")?.trim() || ""
  const dbRaw = req.nextUrl.searchParams.get("db")?.trim() || ""
  const db = decodeOrderMonitorDb(dbRaw) || ""

  // When admin picks a schema (same picker as Order Monitor), prefer MySQL for that DB —
  // ActivityLogsServlet / ActivityMysqlStore still use Tomcat's fixed MySQLConnector.dbName.
  if (db) {
    try {
      const selected = await fetchCommercialStatsFromMysql(
        from,
        to,
        environment,
        sellerAccount,
        compareSellers,
        db,
      )
      if (selected) {
        return NextResponse.json(selected)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "MySQL stats failed"
      return NextResponse.json(
        {
          ok: false,
          error: msg,
          hint: "Configure ONBOARDING_MYSQL_* / GQ_MYSQL_* so commercial-stats can open chaos_beta|chaos_test|chaos_dev.",
        },
        { status: 502 },
      )
    }
  }

  const java = await proxyActivityLogsServlet(req, "getIhuteCommercialStats")
  if (java.ok) {
    const data = await java.json().catch(() => null)
    if (data && typeof data === "object" && (data as { ok?: boolean }).ok) {
      return NextResponse.json(data)
    }
  }

  try {
    const fallback = await fetchCommercialStatsFromMysql(
      from,
      to,
      environment,
      sellerAccount,
      compareSellers,
      db,
    )
    if (fallback) {
      return NextResponse.json(fallback)
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "MySQL fallback failed"
    return NextResponse.json(
      {
        ok: false,
        error: msg,
        hint: "Deploy ActivityLogsServlet on Tomcat or configure ONBOARDING_MYSQL_* for direct MySQL stats.",
      },
      { status: 502 },
    )
  }

  const javaBody = await java.json().catch(() => ({ ok: false, error: "Backend unavailable" }))
  return NextResponse.json(javaBody, { status: java.status || 502 })
}
