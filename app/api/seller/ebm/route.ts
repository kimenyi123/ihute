import { NextRequest, NextResponse } from "next/server"
import { ebmBuyerRequestService } from "@/lib/ebm/ebm-buyer-request"
import { EbmRepository } from "@/lib/ebm/ebm-repository"
import { ebmSellerNotificationService } from "@/lib/ebm/ebm-seller-notification"
import { isMysqlUnreachableError } from "@/lib/onboarding-mysql"
import { getEbmSetupHint } from "@/lib/ebm/config"
import { isEbmConfiguredResolved } from "@/lib/ebm/ebm-platform-config"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const EBM_ROUTE_TIMEOUT_MS = 20_000

type SellerEbmPayload = {
  ok: true
  pending: Array<{
    notiId: number
    orderId: number
    buyerName: string
    sellerAccount: string
    action: string
    createdAt: string
    amount: number
  }>
  pendingOrderIds: number[]
  successOrderIds: number[]
  rejectedOrderIds: number[]
  count: number
  configured?: boolean
  degraded?: boolean
  warning?: string
}

function degradedPayload(configured = false): SellerEbmPayload {
  return {
    ok: true,
    pending: [],
    pendingOrderIds: [],
    successOrderIds: [],
    rejectedOrderIds: [],
    count: 0,
    configured,
    degraded: true,
    warning:
      "EBM database unreachable (ETIMEDOUT). On shop.ihute.rw set ONBOARDING_MYSQL_HOST=127.0.0.1 in server .env, or open firewall for port 3306.",
  }
}

async function loadSellerEbmState(sellerAccount: string): Promise<SellerEbmPayload> {
  const configured = await isEbmConfiguredResolved()
  const repo = new EbmRepository()
  await repo.backfillSellerAccountsFromNotifications().catch(() => {})

  const [notifsSettled, stateSettled] = await Promise.allSettled([
    ebmSellerNotificationService.listPendingForSeller(sellerAccount),
    repo.listEbmStateForSeller(sellerAccount),
  ])

  for (const [label, settled] of [
    ["notifications", notifsSettled],
    ["ebm_state", stateSettled],
  ] as const) {
    if (settled.status === "rejected") {
      console.error(`[seller/ebm] ${label} query failed:`, settled.reason)
    }
  }

  if (notifsSettled.status === "rejected" && stateSettled.status === "rejected") {
    const err =
      (notifsSettled as PromiseRejectedResult).reason ??
      (stateSettled as PromiseRejectedResult).reason
    if (isMysqlUnreachableError(err)) return degradedPayload(configured)
    throw err instanceof Error ? err : new Error(String(err))
  }

  const fromNotifs = notifsSettled.status === "fulfilled" ? notifsSettled.value : []
  const fromInvoices =
    stateSettled.status === "fulfilled" ? stateSettled.value.pending : []
  const successOrderIds =
    stateSettled.status === "fulfilled" ? stateSettled.value.success : []
  const rejectedOrderIds =
    stateSettled.status === "fulfilled" ? stateSettled.value.rejected : []
  const successSet = new Set(successOrderIds)
  const rejectedSet = new Set(rejectedOrderIds)
  const idSet = new Set<number>()
  for (const p of fromNotifs) {
    if (!successSet.has(p.orderId) && !rejectedSet.has(p.orderId)) idSet.add(p.orderId)
  }
  for (const id of fromInvoices) {
    if (!successSet.has(id) && !rejectedSet.has(id)) idSet.add(id)
  }
  const pendingOrderIds = [...idSet].sort((a, b) => b - a)
  const pending = fromNotifs.filter((p) => idSet.has(p.orderId))
  for (const orderId of pendingOrderIds) {
    if (!pending.some((p) => p.orderId === orderId)) {
      pending.push({
        notiId: 0,
        orderId,
        buyerName: "Customer",
        sellerAccount,
        action: "REQUEST_EBM",
        createdAt: "",
        amount: 0,
      })
    }
  }
  return {
    ok: true,
    pending,
    pendingOrderIds,
    successOrderIds,
    rejectedOrderIds,
    count: pendingOrderIds.length,
    configured,
  }
}

/**
 * GET /api/seller/ebm/pending?sellerAccount=...
 */
export async function GET(req: NextRequest) {
  const sellerAccount = req.nextUrl.searchParams.get("sellerAccount")?.trim()
  if (!sellerAccount) {
    return NextResponse.json({ ok: false, error: "sellerAccount is required" }, { status: 400 })
  }
  try {
    const configured = await isEbmConfiguredResolved()
    const payload = await Promise.race([
      loadSellerEbmState(sellerAccount),
      new Promise<SellerEbmPayload>((resolve) =>
        setTimeout(() => resolve(degradedPayload(configured)), EBM_ROUTE_TIMEOUT_MS),
      ),
    ])
    return NextResponse.json(payload)
  } catch (e: unknown) {
    console.error("[seller/ebm/pending]", e)
    if (isMysqlUnreachableError(e)) {
      const configured = await isEbmConfiguredResolved()
      return NextResponse.json(degradedPayload(configured))
    }
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Could not load EBM requests" },
      { status: 500 },
    )
  }
}

/**
 * POST /api/seller/ebm
 * Body: { orderId, sellerAccount, action?: "approve" | "reject", reason?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      orderId?: unknown
      sellerAccount?: string
      action?: string
      reason?: string
    }
    const orderId = Number(body.orderId)
    const sellerAccount = String(body.sellerAccount ?? "").trim()
    const action = String(body.action ?? "approve").trim().toLowerCase()

    if (!Number.isFinite(orderId) || orderId < 1) {
      return NextResponse.json({ ok: false, error: "orderId is required" }, { status: 400 })
    }
    if (!sellerAccount) {
      return NextResponse.json({ ok: false, error: "sellerAccount is required" }, { status: 400 })
    }

    if (action === "reject") {
      const result = await ebmBuyerRequestService.rejectFromSeller(
        orderId,
        sellerAccount,
        body.reason,
      )
      if (!result.ok) {
        return NextResponse.json(result, { status: 422 })
      }
      return NextResponse.json({
        ok: true,
        message: "EBM request rejected",
        orderId: result.orderId,
        ebmStatus: "rejected",
      })
    }

    if (!(await isEbmConfiguredResolved())) {
      return NextResponse.json(
        {
          ok: false,
          code: "EBM_NOT_CONFIGURED",
          error: getEbmSetupHint(),
        },
        { status: 503 },
      )
    }

    const result = await ebmBuyerRequestService.approveFromSeller(orderId, sellerAccount)
    if (!result.ok) {
      return NextResponse.json(
        {
          ...result,
          internalError: result.debug?.errorMessage || result.error,
          requestPayload: result.debug?.requestPayload,
          responsePayload: result.debug?.responsePayload,
          statusCode: result.debug?.statusCode,
          errorMessage: result.error ?? result.debug?.errorMessage,
          endpoint: result.debug?.endpoint,
          method: result.debug?.method,
        },
        { status: 422 },
      )
    }
    return NextResponse.json({
      ok: true,
      message: "EBM invoice fiscalized successfully",
      orderId: result.orderId,
      receiptNumber: result.receiptNumber,
      qrCode: result.qrCode,
      internalError: result.debug?.errorMessage,
      requestPayload: result.debug?.requestPayload,
      responsePayload: result.debug?.responsePayload,
      statusCode: result.debug?.statusCode,
      errorMessage: result.debug?.errorMessage,
      endpoint: result.debug?.endpoint,
      method: result.debug?.method,
    })
  } catch (e: unknown) {
    console.error("[seller/ebm/approve]", e)
    if (isMysqlUnreachableError(e)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Cannot reach EBM database (ETIMEDOUT). On production server use ONBOARDING_MYSQL_HOST=127.0.0.1 if MySQL is local.",
          code: "MYSQL_UNREACHABLE",
        },
        { status: 503 },
      )
    }
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "EBM approval failed" },
      { status: 500 },
    )
  }
}
