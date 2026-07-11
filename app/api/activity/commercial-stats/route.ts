import { NextRequest, NextResponse } from "next/server"
import { fetchCommercialStatsFromMysql } from "@/lib/activity-commercial-stats"
import { proxyActivityLogsServlet } from "@/lib/activity-logs-java-proxy"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const java = await proxyActivityLogsServlet(req, "getIhuteCommercialStats")
  if (java.ok) {
    const data = await java.json().catch(() => null)
    if (data && typeof data === "object" && (data as { ok?: boolean }).ok) {
      return NextResponse.json(data)
    }
  }

  const from = req.nextUrl.searchParams.get("from")?.trim() || ""
  const to = req.nextUrl.searchParams.get("to")?.trim() || ""
  const environment = req.nextUrl.searchParams.get("environment")?.trim() || ""

  const sellerAccount = req.nextUrl.searchParams.get("sellerAccount")?.trim() || ""
  const compareSellers = req.nextUrl.searchParams.get("compareSellers")?.trim() || ""

  try {
    const fallback = await fetchCommercialStatsFromMysql(from, to, environment, sellerAccount, compareSellers)
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
