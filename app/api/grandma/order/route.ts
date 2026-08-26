import { NextRequest, NextResponse } from "next/server"
import { getOrdersUrl, getProxyTimeoutMs } from "@/lib/backend-config"
import {
  assertGrandmaOrderPayloadHasMomoPhone,
  attachPhoneRegisteredOnOrder,
  logGrandmaMomoPhoneGuardFailure,
} from "@/lib/grandma-checkout-order-guard"
import { getOrCreatePublicTokenForOrderId } from "@/lib/order-tracking-token"

export const runtime = "nodejs"

/**
 * Grandma buyer checkout — forwards to Kaos {@code OrdersServlet?action=createOrder}
 * (same JSON contract as kiosk / table-commands).
 */
export async function POST(req: NextRequest) {
  const rid = crypto.randomUUID()
  try {
    const body = await req.json()
    const sellerAccount = String(body.sellerAccount ?? "").trim()
    if (!sellerAccount) {
      return NextResponse.json({ ok: false, error: "sellerAccount required", rid }, { status: 400 })
    }
    const items = body.items
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ ok: false, error: "items required", rid }, { status: 400 })
    }

    const ordersUrl = new URL(getOrdersUrl())
    ordersUrl.searchParams.set("action", "createOrder")

    const timeout = Math.max(getProxyTimeoutMs(), 120_000)
    const subtotal =
      body.subtotal != null && String(body.subtotal).trim() !== ""
        ? Number(body.subtotal)
        : NaN
    const orderNotes = String(
      body.orderNotes ??
      body.orderNote ??
      body.notes ??
      body.ORDER_NOTE ??
      body.CONDITIONS ??
      ""
    ).trim()
    const deliveryName = String(body.deliveryName ?? body.DELIVERY_NAME ?? "").trim()
    const deliveryAmount = Number(body.deliveryAmount ?? body.DELIVERY_AMOUNT ?? 0)
    const paymentName = String(body.paymentName ?? "PAY_ON_DELIVERY")
    const phoneRegisteredOnOrder = String(
      body.phoneRegisteredOnOrder ?? body.PHONE_REGISTERED_ON_ORDER ?? "",
    ).trim()
    const momoPhoneOk = assertGrandmaOrderPayloadHasMomoPhone({
      paymentName,
      phoneRegisteredOnOrder,
    })
    if (!momoPhoneOk.ok) {
      logGrandmaMomoPhoneGuardFailure(momoPhoneOk.code, phoneRegisteredOnOrder)
      return NextResponse.json(
        {
          ok: false,
          error: "The phone number used for Mobile Money is required",
          code: momoPhoneOk.code,
          rid,
        },
        { status: 400 },
      )
    }
    const payload = attachPhoneRegisteredOnOrder(
      {
        buyerEmail: String(body.buyerEmail ?? "").trim(),
        buyerName: String(body.buyerName ?? "").trim(),
        buyerPhone: String(body.buyerPhone ?? "").trim(),
        buyerLocation: String(body.buyerLocation ?? "NA").trim() || "NA",
        sellerAccount,
        sellerName: String(body.sellerName ?? "").trim(),
        sellerPhone: String(body.sellerPhone ?? "").trim(),
        paymentName,
        paymentId: body.paymentId != null ? String(body.paymentId) : "",
        reference: body.reference != null ? String(body.reference) : "",
        currency: String(body.currency ?? "RWF"),
        isTableCommand: false,
        items,
        ...(orderNotes ? { orderNote: orderNotes, ORDER_NOTE: orderNotes, CONDITIONS: orderNotes } : {}),
        ...(deliveryName ? { deliveryName, DELIVERY_NAME: deliveryName } : {}),
        ...(Number.isFinite(deliveryAmount) ? { deliveryAmount, DELIVERY_AMOUNT: deliveryAmount } : {}),
        ...(Number.isFinite(subtotal) && subtotal > 0 ? { subtotal } : {}),
      },
      phoneRegisteredOnOrder,
    )

    const resp = await fetch(ordersUrl.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(timeout),
    })

    const text = await resp.text()
    let data: Record<string, unknown> = {}
    try {
      data = text ? (JSON.parse(text) as Record<string, unknown>) : {}
    } catch {
      return NextResponse.json(
        {
          ok: false,
          error: "OrdersServlet returned non-JSON",
          code: "GRANDMA_ORDER_NOT_JSON",
          rid,
          raw: text.slice(0, 500),
        },
        { status: 502 }
      )
    }

    if (!resp.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: (data.error as string) || `Backend HTTP ${resp.status}`,
          rid,
        },
        { status: resp.status >= 500 ? 502 : resp.status }
      )
    }

    if (data.ok === false) {
      return NextResponse.json(
        { ok: false, error: (data.error as string) || "Order rejected", rid, ...data },
        { status: 502 }
      )
    }

    let trackToken: string | undefined
    const oid = data.orderId ?? data.id_order ?? (data as { ID_ORDER?: unknown }).ID_ORDER
    if (oid != null && String(oid).trim() !== "") {
      try {
        trackToken = getOrCreatePublicTokenForOrderId(String(oid))
      } catch {
        /* ignore */
      }
    }

    return NextResponse.json({ ...data, rid, ...(trackToken ? { trackToken } : {}) })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg, rid }, { status: 500 })
  }
}
