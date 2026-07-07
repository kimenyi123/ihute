import { NextRequest } from "next/server"
import { proxyActivityLogsServlet } from "@/lib/activity-logs-java-proxy"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  return proxyActivityLogsServlet(req, "getActivityLogs")
}
