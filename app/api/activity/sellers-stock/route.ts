import { NextRequest } from "next/server"
import { proxyActivityLogsServlet } from "@/lib/activity-logs-java-proxy"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
/** Allow long Redis catalog aggregation behind the Java proxy. */
export const maxDuration = 120

/**
 * Admin: sellers with Redis catalog stock (supplier_<account>),
 * same payload shape as Redis_ai / SupplierStock dashboard.
 */
export async function GET(req: NextRequest) {
  return proxyActivityLogsServlet(req, "getSellersWithStock")
}
