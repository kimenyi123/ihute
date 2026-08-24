import { NextRequest, NextResponse } from "next/server"
import { ebmBuyerRequestService } from "@/lib/ebm/ebm-buyer-request"
import { getOnboardingMysqlConfig, onboardingMysqlConfigHint } from "@/lib/onboarding-mysql"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function mysqlConfigResponse() {
  return NextResponse.json(
    { ok: false, error: onboardingMysqlConfigHint(), code: "MYSQL_NOT_CONFIGURED" },
    { status: 503 },
  )
}

function mapEbmError(e: unknown) {
  const msg = e instanceof Error ? e.message : "EBM request failed"
  if (msg.includes("ONBOARDING_MYSQL") || msg.includes("MySQL not configured") || msg.includes("EBM_MYSQL")) {
    return mysqlConfigResponse()
  }
  if (/access denied|ECONNREFUSED|ENOTFOUND|connect/i.test(msg)) {
    const hint =
      msg.includes("Access denied") && msg.includes("@")
        ? " Wrong password (quote values with # in .env.local) OR MySQL must allow your IP — run: GRANT ... TO 'algodev'@'YOUR_IP' or 'algodev'@'%'."
        : ""
    return NextResponse.json(
      {
        ok: false,
        error: `MySQL connection failed: ${msg}.${hint}`,
        code: "MYSQL_CONNECTION_FAILED",
      },
      { status: 503 },
    )
  }
  return NextResponse.json({ ok: false, error: msg }, { status: 500 })
}

/**
 * POST /api/orders/ebm-request
 * Body: { orderId: number }
 * Buyer requests RRA EBM fiscal invoice — notifies seller for approval.
 */
export async function POST(req: NextRequest) {
  try {
    if (!getOnboardingMysqlConfig()) return mysqlConfigResponse()

    const body = (await req.json()) as { orderId?: unknown }
    const orderId = Number(body.orderId)
    if (!Number.isFinite(orderId) || orderId < 1) {
      return NextResponse.json({ ok: false, error: "orderId is required" }, { status: 400 })
    }

    const result = await ebmBuyerRequestService.requestFromBuyer(orderId)
    if (!result.ok) {
      return NextResponse.json(result, { status: 422 })
    }
    return NextResponse.json(result)
  } catch (e: unknown) {
    console.error("[orders/ebm-request]", e)
    return mapEbmError(e)
  }
}

/**
 * GET /api/orders/ebm-request?orderId=123
 */
export async function GET(req: NextRequest) {
  const orderId = Number(req.nextUrl.searchParams.get("orderId"))
  if (!Number.isFinite(orderId) || orderId < 1) {
    return NextResponse.json({ ok: false, error: "orderId is required" }, { status: 400 })
  }
  try {
    if (!getOnboardingMysqlConfig()) return mysqlConfigResponse()
    const result = await ebmBuyerRequestService.getStatus(orderId)
    return NextResponse.json(result)
  } catch (e: unknown) {
    return mapEbmError(e)
  }
}
