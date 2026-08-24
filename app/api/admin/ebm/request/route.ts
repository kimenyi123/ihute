import { NextRequest, NextResponse } from "next/server"
import { ebmService } from "@/lib/ebm/ebm-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * POST /api/admin/ebm/request
 * Body: { orderId: number, force?: boolean }
 * Header: x-admin-email (admin session)
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { orderId?: unknown; force?: boolean }
    const orderId = Number(body.orderId)
    if (!Number.isFinite(orderId) || orderId < 1) {
      return NextResponse.json({ ok: false, error: "orderId is required" }, { status: 400 })
    }

    const adminEmail = req.headers.get("x-admin-email")?.trim()
    if (!adminEmail) {
      return NextResponse.json({ ok: false, error: "Admin authentication required" }, { status: 401 })
    }

    const result = await ebmService.requestFiscalization(orderId, req.headers, {
      userName: adminEmail,
      force: body.force === true,
      sellerApproved: body.force === true,
    })

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: result.error,
          ebmStatus: result.ebmStatus,
          orderId: result.orderId,
          invoiceNumber: result.invoiceNumber,
          requestPayload: result.debug?.requestPayload,
          responsePayload: result.debug?.responsePayload,
          statusCode: result.debug?.statusCode,
          errorMessage: result.error ?? result.debug?.errorMessage,
        },
        { status: result.ebmStatus === "retry" ? 503 : 422 },
      )
    }

    const { ok: _ok, ...rest } = result
    return NextResponse.json({
      ok: true,
      message: result.duplicate ? "Invoice already fiscalized" : "EBM invoice sent successfully",
      requestPayload: result.debug?.requestPayload,
      responsePayload: result.debug?.responsePayload,
      statusCode: result.debug?.statusCode,
      errorMessage: result.debug?.errorMessage,
      ...rest,
    })
  } catch (e: unknown) {
    console.error("[admin/ebm/request]", e)
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "EBM request failed" },
      { status: 500 },
    )
  }
}
