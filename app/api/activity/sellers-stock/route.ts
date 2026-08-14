import { NextRequest } from "next/server"
import { decodeOrderMonitorDb } from "@/lib/admin-order-db"
import { proxyActivityLogsServlet } from "@/lib/activity-logs-java-proxy"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
/** Allow long Redis catalog aggregation behind the Java proxy. */
export const maxDuration = 120

/**
 * Admin: sellers with Redis catalog stock (supplier_<account>),
 * same payload shape as Redis_ai / SupplierStock dashboard.
 * Optional ?db= opaque token (b|p|d) or legacy schema — seller directory from that MySQL.
 */
export async function GET(req: NextRequest) {
  const decoded = decodeOrderMonitorDb(req.nextUrl.searchParams.get("db"))
  if (decoded) {
    const url = req.nextUrl.clone()
    url.searchParams.set("db", decoded)
    return proxyActivityLogsServlet(new NextRequest(url, req), "getSellersWithStock")
  }
  return proxyActivityLogsServlet(req, "getSellersWithStock")
}
