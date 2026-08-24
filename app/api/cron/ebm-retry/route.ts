import { NextRequest, NextResponse } from "next/server"
import { ebmService } from "@/lib/ebm/ebm-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.EBM_CRON_SECRET?.trim() || process.env.CRON_SECRET?.trim()
  if (!secret) return false
  const auth = req.headers.get("authorization")?.trim()
  if (auth === `Bearer ${secret}`) return true
  return req.headers.get("x-cron-secret") === secret
}

/**
 * GET/POST /api/cron/ebm-retry
 * Re-sends failed EBM invoices marked with ebm_status=retry.
 * Protect with EBM_CRON_SECRET or CRON_SECRET header.
 */
export async function GET(req: NextRequest) {
  return handleRetry(req)
}

export async function POST(req: NextRequest) {
  return handleRetry(req)
}

async function handleRetry(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const limit = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get("limit")) || 20))
    const batch = await ebmService.retryPendingBatch(limit)
    return NextResponse.json({ ok: true, ...batch })
  } catch (e: unknown) {
    console.error("[cron/ebm-retry]", e)
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "EBM retry failed" },
      { status: 500 },
    )
  }
}
