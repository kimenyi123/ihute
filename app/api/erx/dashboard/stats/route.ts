import { NextResponse } from "next/server"

import { isMohDashboardAuthed } from "@/lib/erx/moh-dashboard-auth.server"
import { mergeWithDemoStats } from "@/lib/erx/moh-dashboard-demo"
import { fetchErxDashboardStats } from "@/lib/erx/erx-tracking"
import { pingErxMysql } from "@/lib/erx/erx-mysql"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  if (!(await isMohDashboardAuthed())) {
    return NextResponse.json({ ok: false, code: "UNAUTHORIZED" }, { status: 401 })
  }

  const db = await pingErxMysql()
  const live = await fetchErxDashboardStats()
  const { stats, demoMode } = mergeWithDemoStats(live)

  return NextResponse.json({
    ok: true,
    db,
    demoMode,
    stats,
    snapshotAt: new Date().toISOString(),
  })
}
