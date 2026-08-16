import type { NextRequest, NextResponse } from "next/server"
import { assertStockSyncLogsAccess } from "@/lib/verify-stock-sync-logs-access"

/**
 * Reuses the existing admin cookie / x-admin-email + Java AdminServlet gate.
 * Clients without an admin session receive 401.
 */
export async function assertAdminApiAccess(req: NextRequest): Promise<NextResponse | null> {
  return assertStockSyncLogsAccess(req)
}
