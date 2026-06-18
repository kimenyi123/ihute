import type { NextRequest, NextResponse } from "next/server"
import { assertStockSyncLogsAccess } from "@/lib/verify-stock-sync-logs-access"

/** Activity logs use the same admin / API-secret gate as stock-sync logs. */
export async function assertActivityLogsAccess(req: NextRequest): Promise<NextResponse | null> {
  return assertStockSyncLogsAccess(req)
}
