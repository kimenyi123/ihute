import { NextResponse } from "next/server"
import { getOrdersUrl } from "@/lib/backend-config"
import { DEFAULT_GUEST_ISHYIGA_ACCOUNT } from "@/lib/guest-checkout"

function describeConnectFailure(raw?: string): string {
  if (!raw?.trim()) {
    return "Could not connect to order processing service"
  }
  const r = raw.toLowerCase()
  if (r.includes("econnrefused")) {
    return "Java backend refused the connection (nothing is listening on that host/port). Start Tomcat and confirm the port in .env.local matches (often 8080, not 8081)."
  }
  if (r.includes("enotfound") || r.includes("getaddrinfo")) {
    return `Could not reach order service: ${raw}`
  }
  if (r.includes("abort") || r.includes("timeout") || r.includes("aborted")) {
    return "Order request timed out — Java backend did not respond in time."
  }
  return `Could not connect to order processing service (${raw})`
}

function exceptionDetail(e: unknown): string {
  if (!e || typeof e !== "object") return String(e)
  const err = e as Error & { cause?: { message?: string; code?: string } }
  const cause = err.cause
  const parts = [cause?.code, cause?.message, err.message].filter(
    (x): x is string => typeof x === "string" && x.trim().length > 0,
  )
  return parts.length ? parts.join(" — ") : String(e)
}

function isProbablyHtmlResponse(text: string): boolean {
  const t = text.slice(0, 240).trim().toLowerCase()
  return t.startsWith("<!") || t.startsWith("<html") || t.includes("<!doctype")
}

/** User-facing message when Java returns 4xx/5xx (never dump HTML into alerts). */
function summarizeBackendHttpError(status: number, raw: string): string {
  if (isProbablyHtmlResponse(raw)) {
    return `Java order service returned HTTP ${status} (internal error). Tomcat answered with an HTML error page — check catalina.out / server logs for the stack trace.`
  }
  const oneLine = raw.replace(/\s+/g, " ").trim().slice(0, 200)
  return oneLine
    ? `Order service returned HTTP ${status}: ${oneLine}`
    : `Order service returned HTTP ${status}`
}

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

type LineIn = {
  name?: string
  item_name?: string
  itemCode?: string
  NIKI_CODE?: string
  nikiCode?: string
  item_code?: string
  ITEM_CODE?: string
  item_key_words?: string
  qty?: number | string
  quantity?: number | string
  unitPrice?: number | string
  price?: number | string
  unit?: string
  measurement?: string
}

function normalizeItemCode(it: LineIn): string | undefined {
  const raw =
    it.itemCode ??
    it.NIKI_CODE ??
    it.nikiCode ??
    it.item_code ??
    it.ITEM_CODE ??
    it.item_key_words ??
    ""
  const s = String(raw).trim()
  return s || undefined
}

/* =========================
   GET – health check
========================= */
export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "/api/orders/create",
    ordersUrl: getOrdersUrl(),
  })
}

/* =========================
   POST – create order
   Backend contract: do NOT validate "item exists" (e.g. lookup by itemCode).
   Frontend only allows adding to cart items that exist (have quantity).
========================= */
export async function POST(req: Request) {
  try {
    const bodyIn = await req.json().catch(() => ({} as any))

    /* -------- normalize items -------- */
    const rawItems: LineIn[] = Array.isArray(bodyIn.items) ? bodyIn.items : []
    const items = rawItems.map((it, i) => ({
      name: String(it.name ?? it.item_name ?? `Item ${i + 1}`),
      itemCode: normalizeItemCode(it),
      qty: Number(it.qty ?? it.quantity ?? 1),
      unitPrice: Number(it.unitPrice ?? it.price ?? 0),
      unit: String(it.unit ?? it.measurement ?? ""),
    }))

    console.log("[orders/create] Request items (NIKI_CODE in logs only):", items.map((it) => ({ name: it.name, qty: it.qty, NIKI_CODE: it.itemCode, unitPrice: it.unitPrice })))

    const buyerEmail = String(bodyIn.buyerEmail ?? "")
    const sellerAccount = String(bodyIn.sellerAccount ?? "")

    if (!buyerEmail || !sellerAccount || items.length === 0) {
      return NextResponse.json(
        { ok: false, error: "buyerEmail, sellerAccount and items are required" },
        { status: 400 }
      )
    }

    /* -------- payment validation -------- */
    const paymentName = String(bodyIn.paymentName ?? "PAY_ON_DELIVERY").toUpperCase()
    const validPaymentMethods = [
      "PAY_ON_DELIVERY",
      "PAID_MTN_MOMO",
      "PAID_AIRTEL_MOMO",
      "PAID_CARD",
      "MTN_MOMO",
      "AIRTEL_MOMO",
      "MOMO",
      "CARD",
    ]

    if (!validPaymentMethods.includes(paymentName)) {
      return NextResponse.json(
        { ok: false, error: `Invalid payment method: ${paymentName}` },
        { status: 400 }
      )
    }

    let paymentId = String(bodyIn.paymentId ?? "")
    if (!paymentId) {
      if (paymentName.includes("MOMO") || paymentName.includes("AIRTEL")) paymentId = `MOMO_${Date.now()}`
      else if (paymentName.includes("CARD")) paymentId = `CARD_${Date.now()}`
      else paymentId = `COD_${Date.now()}`
    }
    const reference = String(bodyIn.reference ?? "").trim()
    const isDigitalPayment =
      paymentName.includes("MOMO") || paymentName.includes("AIRTEL") || paymentName.includes("CARD")
    const paymentStatus = isDigitalPayment || reference.length > 0 ? "PAID" : "PENDING"

    /** Browser guest checkout — Java OrdersServlet must null-check buyer or read this flag (see GUEST_CHECKOUT_BUYER_ACCOUNT). */
    const isGuestCheckout = Boolean(
      bodyIn.isGuestCheckout ?? bodyIn.guestCheckout ?? /^guest_/i.test(buyerEmail.trim()),
    )
    let buyerAccount = String(bodyIn.buyerAccount ?? "").trim()
    if (!buyerAccount) buyerAccount = String(process.env.GUEST_CHECKOUT_BUYER_ACCOUNT ?? "").trim()
    if (!buyerAccount && isGuestCheckout) {
      buyerAccount = String(
        process.env.DEFAULT_GUEST_ISHYIGA_ACCOUNT ?? DEFAULT_GUEST_ISHYIGA_ACCOUNT,
      ).trim()
    }

    /* -------- shared payload -------- */
    const shared = {
      buyerEmail,
      buyerName: String(bodyIn.buyerName ?? ""),
      buyerPhone: String(bodyIn.buyerPhone ?? ""),
      buyerLocation: String(bodyIn.buyerLocation ?? "NA"),
      sellerAccount,
      sellerName: String(bodyIn.sellerName ?? ""),
      sellerPhone: String(bodyIn.sellerPhone ?? ""),
      paymentName,
      paymentId,
      reference,
      currency: String(bodyIn.currency ?? "RWF"),
      paymentStatus,
      items,
      isTableCommand: Boolean(bodyIn.isTableCommand),
      tableName: String(bodyIn.tableName ?? ""),
      tableLocation: String(bodyIn.tableLocation ?? ""),
      isGuestCheckout,
      buyerAccount,
    }

    let lastErr:
      | { status?: number; raw?: string; url?: string }
      | undefined
    let lastBackendError: string | undefined
    const url = getOrdersUrl()

    try {
      let res: Response
      let text = ""
      let json: any = null

      // JSON backend (Next proxy)
      if (url.endsWith("/api/delivery/create")) {
        res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...shared,
            subtotal: items.reduce((s, it) => s + it.qty * it.unitPrice, 0),
          }),
          cache: "no-store",
        })
        text = await res.text()
        try {
          json = JSON.parse(text)
        } catch {}
      } else {
        // Java OrdersServlet: try form-urlencoded first (matches delivery/create proxy).
        const form = new URLSearchParams()
        form.set("action", "createOrder")
        form.set("buyerEmail", shared.buyerEmail)
        form.set("buyerPhone", shared.buyerPhone)
        form.set("buyerLocation", shared.buyerLocation)
        form.set("sellerAccount", shared.sellerAccount)
        form.set("paymentName", shared.paymentName)
        form.set("paymentId", shared.paymentId)
        form.set("reference", shared.reference)
        form.set("currency", shared.currency)
        form.set("paymentStatus", shared.paymentStatus)
        form.set("PAYMENT_STATUS", shared.paymentStatus)
        form.set("items", JSON.stringify(shared.items))

        if (shared.buyerName) form.set("buyerName", shared.buyerName)
        if (shared.sellerName) form.set("sellerName", shared.sellerName)
        if (shared.sellerPhone) form.set("sellerPhone", shared.sellerPhone)

        if (shared.isTableCommand) {
          form.set("isTableCommand", "true")
          form.set("tableName", shared.tableName)
          form.set("tableLocation", shared.tableLocation)
        }
        form.set("skipStockCheck", "true")
        if (shared.isGuestCheckout) form.set("isGuestCheckout", "true")
        if (shared.buyerAccount) form.set("buyerAccount", shared.buyerAccount)

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 15000)
        res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
          },
          body: form.toString(),
          signal: controller.signal,
          cache: "no-store",
        })
        clearTimeout(timeoutId)

        text = await res.text()
        try {
          json = JSON.parse(text)
        } catch {}

        const formFailedHard =
          !res.ok &&
          (res.status >= 500 || isProbablyHtmlResponse(text)) &&
          json?.ok !== false

        if (formFailedHard) {
          console.warn(
            "[orders/create] Form createOrder failed (HTTP",
            res.status,
            "); retrying JSON POST with ?action=createOrder (see lib/api/table-commands.ts)",
          )
          const jsonUrl = new URL(url)
          jsonUrl.searchParams.set("action", "createOrder")
          const c2 = new AbortController()
          const t2 = setTimeout(() => c2.abort(), 15000)
          try {
            res = await fetch(jsonUrl.toString(), {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
              },
              body: JSON.stringify({
                buyerEmail: shared.buyerEmail,
                buyerName: shared.buyerName,
                buyerPhone: shared.buyerPhone,
                buyerLocation: shared.buyerLocation,
                sellerAccount: shared.sellerAccount,
                sellerName: shared.sellerName,
                sellerPhone: shared.sellerPhone,
                paymentName: shared.paymentName,
                paymentId: shared.paymentId,
                reference: shared.reference,
                currency: shared.currency,
                paymentStatus: shared.paymentStatus,
                PAYMENT_STATUS: shared.paymentStatus,
                items: shared.items,
                isTableCommand: shared.isTableCommand,
                tableName: shared.tableName,
                tableLocation: shared.tableLocation,
                skipStockCheck: true,
                isGuestCheckout: shared.isGuestCheckout,
                ...(shared.buyerAccount ? { buyerAccount: shared.buyerAccount } : {}),
              }),
              signal: c2.signal,
              cache: "no-store",
            })
            text = await res.text()
            try {
              json = JSON.parse(text)
            } catch {
              json = null
            }
          } finally {
            clearTimeout(t2)
          }
        }
      }

      if (res.ok && json?.ok === true) {
        return NextResponse.json({
          ok: true,
          orderId: json.orderId ?? `ORD-${Date.now()}`,
          via: url,
          sellerTel: json?.sellerTel ?? "",
          paymentName: shared.paymentName,
          paymentStatus: shared.paymentStatus,
        })
      }

      if (json?.ok === false) {
        lastBackendError = json.error || "Backend error"
        return NextResponse.json(
          { ok: false, error: lastBackendError, details: json },
          { status: 400 },
        )
      }

      if (!isProbablyHtmlResponse(text) && text.length > 0) {
        console.error("[orders/create] Java non-OK body (preview):", text.slice(0, 1200))
      } else if (isProbablyHtmlResponse(text)) {
        console.error("[orders/create] Java returned HTML error page (HTTP", res.status, ") — see Tomcat logs")
      }

      lastErr = {
        status: res.status,
        raw: text.slice(0, 800),
        url,
      }
    } catch (e: unknown) {
      const detail = exceptionDetail(e)
      console.log("[orders/create] ❌ Exception:", detail)
      lastErr = { status: 0, raw: detail, url }
    }

    /* -------- backend failed -------- */
    const errorOut =
      lastBackendError ||
      (lastErr?.status === 0
        ? describeConnectFailure(lastErr.raw)
        : lastErr?.status
          ? summarizeBackendHttpError(lastErr.status, lastErr.raw || "")
          : "Could not connect to order processing service")

    return NextResponse.json(
      {
        ok: false,
        error: errorOut,
        last: lastErr,
        ordersUrl: url,
        hint:
          lastErr != null && (lastErr.status ?? 0) > 0
            ? "HTTP 500 means Tomcat reached OrdersServlet but Java threw an error — inspect catalina.out / IDE console. Connection issues are different (ECONNREFUSED / timeout)."
            : "Check Java/Tomcat is running. In .env.local set JAVA_BACKEND_BASE to your context root (e.g. http://localhost:8080/Trading). Port must match Tomcat (8080 vs 8081).",
      },
      { status: 502 }
    )
  } catch (e: any) {
    console.error("[orders/create] Fatal error:", e)
    return NextResponse.json(
      { ok: false, error: e?.message || "Unknown error" },
      { status: 500 }
    )
  }
}
