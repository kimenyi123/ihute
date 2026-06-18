// app/api/seller-orders/details/route.ts
import { NextResponse } from "next/server"
import { getOrdersUrl, getSellerOrdersUrl } from "@/lib/backend-config"
import { normalizeTableCommandPerson } from "@/lib/table-command-whatsapp"

const PRIMARY_URL = getOrdersUrl()

const FALLBACK_URLS = [
  process.env.JAVA_ORDERS_ALT_URL,
].filter(Boolean) as string[]

function safeParse(raw: string) {
  if (!raw) throw new Error("empty body")
  const t = raw.trim()
  if (t.startsWith("<!doctype") || t.startsWith("<html")) throw new Error("html body")
  try { return JSON.parse(raw) } catch {}
  let s = raw.replace(/\uFEFF/g, "").trim()
  const i = s.search(/[{\[]/)
  if (i > 0) s = s.slice(i)
  try { return JSON.parse(s) } catch {}
  s = s.replace(/[\u0000-\u001F\u007F]+/g, " ")
  return JSON.parse(s)
}

function normalize(data: any) {
  const order0 = data?.order ?? null
  const items0 =
    (Array.isArray(data?.items) && data.items) ||
    (order0 && Array.isArray(order0.items) ? order0.items : []) || []
  const seller = data?.seller ?? null
  const buyer  = data?.buyer ?? null
  const order = order0
    ? {
        ...order0,
        // Pull buyer identity from account_signup-style payloads when available.
        BUYER_OWNER_NAME:
          order0.OWNER ??
          order0.owner ??
          order0.BUYER_OWNER_NAME ??
          order0.BUYER_OWNER ??
          buyer?.OWNER ??
          buyer?.NAMES ??
          order0.BUYER_NAME ??
          order0.BUYER_NAMES ??
          "",
        BUYER_OWNER:
          order0.OWNER ??
          order0.owner ??
          order0.BUYER_OWNER ??
          order0.BUYER_OWNER_NAME ??
          buyer?.OWNER ??
          buyer?.NAMES ??
          "",
        BUYER_PHONE:
          order0.BUYER_PHONE ??
          order0.BUYER_TEL ??
          buyer?.TEL ??
          buyer?.PHONE ??
          "",
      }
    : null

  const items = items0.map((it: any) => {
    const qty = Number(it.QUANTITY ?? it.qty ?? it.quantity ?? it.ITEM_QTY ?? 0)
    const requestPrice = Number(
      it.REQUEST_PRICE ?? it.request_price ?? it.REQUESTED_PRICE ?? it.UNIT_PRICE ?? it.unitPrice ?? 0
    )
    const servedPrice = Number(
      it.UNITY_PRICE ?? it.unity_price ?? it.SERVED_PRICE ?? it.served_price ?? it.UNIT_PRICE ?? it.unitPrice ?? 0
    )
    const servedQty = Number(
      it.CONFIRMED_RECEIVED_QTY ?? it.SERVED_QTY ?? it.served_qty ?? it.servedQty ?? it.received_quantity ?? 0
    )
    // Spread raw row first so computed fields win (avoid ...it overwriting SERVED_QTY with 0 from older APIs)
    return {
      ...it,
      ITEM_NAME: it.ITEM_NAME ?? it.name ?? "",
      QUANTITY: qty,
      REQUEST_PRICE: requestPrice,
      UNITY_PRICE: servedPrice,
      CONFIRMED_RECEIVED_QTY: Number(it.CONFIRMED_RECEIVED_QTY ?? servedQty),
      SERVED_QTY: servedQty,
      servedAmount: Number(it.SERVED_AMOUNT ?? it.servedAmount ?? it.served_amount ?? servedPrice),
      UNIT_PRICE: requestPrice,
      total: qty * requestPrice,
      UNIT: it.UNIT ?? it.unit ?? it.measurement ?? "",
      ITEM_CODE: it.ITEM_CODE ?? it.code ?? String(it.ID_ORDER ?? ""),
      ORDERED_BY: normalizeTableCommandPerson(it.ORDERED_BY ?? it.orderedBy),
      orderedBy: normalizeTableCommandPerson(it.ORDERED_BY ?? it.orderedBy),
      ID_LIST: Number(it.ID_LIST ?? it.lineId ?? it.id_list ?? 0) || undefined,
      lineId: Number(it.ID_LIST ?? it.lineId ?? it.id_list ?? 0) || undefined,
    }
  })

  return { order, items, seller, buyer }
}

/** Line-level served qty from any backend row shape. */
function servedQtyFromLine(it: any): number | null {
  const v =
    it?.CONFIRMED_RECEIVED_QTY ??
    it?.SERVED_QTY ??
    it?.served_qty ??
    it?.servedQty ??
    it?.received_quantity
  if (v == null || String(v).trim() === "") return null
  const n = Number(v)
  return Number.isNaN(n) ? null : n
}

function extractItemsArray(data: any): any[] {
  if (!data) return []
  if (Array.isArray(data.items)) return data.items
  if (data.order && Array.isArray(data.order.items)) return data.order.items
  return []
}

/**
 * When getOrderDetails omits CONFIRMED_RECEIVED_QTY but another OrdersServlet action
 * returns line items with DB-backed served qty, merge by ITEM_CODE (case-insensitive).
 */
function mergeServedQuantitiesIntoNormalized(
  normalized: ReturnType<typeof normalize>,
  sourceItems: any[]
): ReturnType<typeof normalize> {
  if (!Array.isArray(sourceItems) || sourceItems.length === 0) return normalized
  const byCode = new Map<string, number>()
  for (const it of sourceItems) {
    const code = String(it?.ITEM_CODE ?? it?.code ?? "").trim().toUpperCase()
    const sq = servedQtyFromLine(it)
    if (!code || sq == null) continue
    byCode.set(code, sq)
  }
  if (byCode.size === 0) return normalized
  const items = normalized.items.map((row: any) => {
    const code = String(row.ITEM_CODE ?? row.code ?? "").trim().toUpperCase()
    const sq = byCode.get(code)
    if (sq == null) return row
    return {
      ...row,
      CONFIRMED_RECEIVED_QTY: sq,
      SERVED_QTY: sq,
    }
  })
  return { ...normalized, items }
}

async function callOrdersServlet(url: string, orderId: string | number) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15000)

  try {
    // ✅ FIXED: Use GET request with query parameters
    const urlWithParams = `${url}?action=getOrderDetails&orderId=${orderId}`

    console.log(`[callOrdersServlet] Calling ${urlWithParams}`)

    const res = await fetch(urlWithParams, {
      method: "GET",  // ✅ Changed to GET
      headers: {
        Accept: "application/json"
      },
      cache: "no-store",
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    console.log(`[callOrdersServlet] Response status: ${res.status}`)

    const text = await res.text()
    console.log(`[callOrdersServlet] Response text length: ${text.length}, preview:`, text.slice(0, 200))

    let data: any
    try {
      data = safeParse(text)
      console.log(`[callOrdersServlet] Parsed data successfully`)
    }
    catch (e: any) {
      console.error(`[callOrdersServlet] Parse error:`, e?.message)
      return {
        ok: false as const,
        http: res.status,
        error: `Bad/HTML body (${e?.message})`,
        text,
        url
      }
    }

    if (!res.ok || data?.ok === false) {
      console.error(`[callOrdersServlet] Request failed:`, data?.error || `HTTP ${res.status}`)
      return {
        ok: false as const,
        http: res.status,
        error: data?.error || `HTTP ${res.status}`,
        text,
        url
      }
    }

    return { ok: true as const, http: res.status, data, url }

  } catch (e: any) {
    clearTimeout(timeoutId)

    if (e.name === 'AbortError') {
      console.error(`[callOrdersServlet] Request timeout for ${url}`)
      return {
        ok: false as const,
        http: 0,
        error: 'Request timeout (15s)',
        text: '',
        url
      }
    }

    console.error(`[callOrdersServlet] Network error:`, e?.message)
    return {
      ok: false as const,
      http: 0,
      error: `Network error: ${e?.message}`,
      text: '',
      url
    }
  }
}

/**
 * Same contract as /api/orders/track: OrdersServlet may expose richer line items here
 * (e.g. CONFIRMED_RECEIVED_QTY) than getOrderDetails.
 */
async function callBuyerOrderDetailsServlet(
  url: string,
  orderId: string | number,
  buyerAccount?: string
) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15000)
  const urlWithParams = `${url}?action=buyerOrderDetails&orderId=${encodeURIComponent(String(orderId))}`
  try {
    const bodyObj: Record<string, unknown> = { orderId: String(orderId) }
    if (buyerAccount?.trim()) bodyObj.buyerAccount = buyerAccount.trim()
    const res = await fetch(urlWithParams, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(bodyObj),
      cache: "no-store",
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    const text = await res.text()
    let data: any
    try {
      data = safeParse(text)
    } catch (e: any) {
      return {
        ok: false as const,
        http: res.status,
        error: `Bad/HTML body (${e?.message})`,
        text,
        url: urlWithParams,
      }
    }
    if (!res.ok || data?.ok === false) {
      return {
        ok: false as const,
        http: res.status,
        error: data?.error || `HTTP ${res.status}`,
        text,
        url: urlWithParams,
      }
    }
    return { ok: true as const, http: res.status, data, url: urlWithParams }
  } catch (e: any) {
    clearTimeout(timeoutId)
    if (e?.name === "AbortError") {
      return { ok: false as const, http: 0, error: "Request timeout (15s)", text: "", url: urlWithParams }
    }
    return {
      ok: false as const,
      http: 0,
      error: `Network error: ${e?.message}`,
      text: "",
      url: urlWithParams,
    }
  }
}

async function callSellerOrdersServlet(orderId: string | number, sellerAccount: string) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15000)
  try {
    const form = new URLSearchParams({
      action: "listSellerOrderItems",
      sellerAccount: sellerAccount.trim(),
      orderId: String(orderId),
    }).toString()
    const res = await fetch(getSellerOrdersUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: form,
      cache: "no-store",
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    const text = await res.text()
    let data: any
    try {
      data = safeParse(text)
    } catch (e: any) {
      return { ok: false as const, http: res.status, error: `Bad/HTML body (${e?.message})`, text, url: getSellerOrdersUrl() }
    }
    if (!res.ok || data?.ok === false) {
      return { ok: false as const, http: res.status, error: data?.error || `HTTP ${res.status}`, text, url: getSellerOrdersUrl() }
    }
    return { ok: true as const, http: res.status, data, url: getSellerOrdersUrl() }
  } catch (e: any) {
    clearTimeout(timeoutId)
    return { ok: false as const, http: 0, error: `Network error: ${e?.message}`, text: "", url: getSellerOrdersUrl() }
  }
}

async function callBuyerItemsServlet(orderId: string | number, buyerAccount: string) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15000)
  try {
    const form = new URLSearchParams({
      action: "listBuyerOrderItems",
      buyerAccount: buyerAccount.trim(),
      orderId: String(orderId),
    }).toString()
    const res = await fetch(getSellerOrdersUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: form,
      cache: "no-store",
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    const text = await res.text()
    let data: any
    try {
      data = safeParse(text)
    } catch (e: any) {
      return { ok: false as const, http: res.status, error: `Bad/HTML body (${e?.message})`, text, url: getSellerOrdersUrl() }
    }
    if (!res.ok || data?.ok === false) {
      return { ok: false as const, http: res.status, error: data?.error || `HTTP ${res.status}`, text, url: getSellerOrdersUrl() }
    }
    return { ok: true as const, http: res.status, data, url: getSellerOrdersUrl() }
  } catch (e: any) {
    clearTimeout(timeoutId)
    return { ok: false as const, http: 0, error: `Network error: ${e?.message}`, text: "", url: getSellerOrdersUrl() }
  }
}

async function readOrderId(req: Request): Promise<string | null> {
  // 1) query param
  const url = new URL(req.url)
  const fromQuery = url.searchParams.get("orderId")
  if (fromQuery) {
    console.log('[readOrderId] Found orderId in query:', fromQuery)
    return fromQuery
  }

  // 2) JSON body (if present)
  const ct = (req.headers.get("content-type") || "").toLowerCase()
  if (ct.includes("application/json")) {
    try {
      const j = await req.json()
      const orderId = j?.orderId ?? j?.id ?? j?.order_id ?? null
      console.log('[readOrderId] Found orderId in JSON body:', orderId)
      return orderId
    } catch (e) {
      console.log('[readOrderId] Failed to parse JSON body:', e)
    }
  }

  // 3) form body (if present)
  if (ct.includes("application/x-www-form-urlencoded")) {
    const raw = await req.text()
    const sp = new URLSearchParams(raw)
    const orderId = sp.get("orderId")
    console.log('[readOrderId] Found orderId in form body:', orderId)
    return orderId
  }

  console.log('[readOrderId] No orderId found')
  return null
}

export async function POST(req: Request) {
  console.log('\n=== ORDER DETAILS REQUEST START ===')
  console.log('Backend URLs configured:', {
    primary: PRIMARY_URL,
    fallbacks: FALLBACK_URLS,
    total: 1 + FALLBACK_URLS.length
  })

  try {
    const reqClone = req.clone()
    const bodyJson = await reqClone.json().catch(() => ({} as any))
    const orderId = await readOrderId(req)
    const sellerAccount = String(bodyJson?.sellerAccount ?? "").trim()
    const buyerAccount = String(bodyJson?.buyerAccount ?? "").trim()

    if (!orderId) {
      console.error('[POST] Missing orderId')
      return NextResponse.json({
        ok: false,
        error: "orderId required"
      }, { status: 400 })
    }

    console.log(`[POST] Processing order details for orderId: ${orderId}`)

    const attempts: any[] = []

    // First attempt: align with SellerOrdersServlet listSellerOrderItems contract
    if (sellerAccount) {
      const r0 = await callSellerOrdersServlet(orderId, sellerAccount)
      attempts.push({
        attempt: "seller-orders-primary",
        url: r0.url,
        http: r0.http,
        error: r0.ok ? null : r0.error,
        success: r0.ok,
        textPreview: r0.ok ? null : (r0 as any).text?.slice?.(0, 300),
      })
      if (r0.ok) {
        const out = normalize(r0.data)
        return NextResponse.json({ ok: true, ...out })
      }
    }
    // Buyer-side details path (same servlet, buyer action)
    if (buyerAccount) {
      const rb = await callBuyerItemsServlet(orderId, buyerAccount)
      attempts.push({
        attempt: "buyer-items-primary",
        url: rb.url,
        http: rb.http,
        error: rb.ok ? null : rb.error,
        success: rb.ok,
        textPreview: rb.ok ? null : (rb as any).text?.slice?.(0, 300),
      })
      if (rb.ok) {
        const out = normalize(rb.data)
        return NextResponse.json({ ok: true, ...out })
      }
    }
    const allUrls = [PRIMARY_URL, ...FALLBACK_URLS]

    for (let i = 0; i < allUrls.length; i++) {
      const url = allUrls[i]
      console.log(`\n[POST] Attempt ${i + 1}/${allUrls.length}: ${url}`)

      const r = await callOrdersServlet(url, orderId)

      attempts.push({
        attempt: i + 1,
        url: r.url,
        http: r.http,
        error: r.ok ? null : r.error,
        success: r.ok,
        textPreview: r.ok ? null : (r as any).text?.slice?.(0, 300)
      })

      if (r.ok) {
        console.log(`✅ [POST] Success on attempt ${i + 1}`)
        const out = normalize(r.data)

        // If frontend didn't provide sellerAccount, try deriving it from order payload
        // and re-fetch item lines from SellerOrdersServlet to get served qty fields.
        const derivedSellerAccount = String(
          sellerAccount ||
          out?.order?.SELLER_ISHYIGA_ACCOUNT ||
          out?.order?.sellerAccount ||
          out?.seller?.ISHYIGA_ACCOUNT ||
          ""
        ).trim()

        if (derivedSellerAccount) {
          const sellerRetry = await callSellerOrdersServlet(orderId, derivedSellerAccount)
          attempts.push({
            attempt: "seller-orders-derived",
            url: sellerRetry.url,
            http: sellerRetry.http,
            error: sellerRetry.ok ? null : sellerRetry.error,
            success: sellerRetry.ok,
            textPreview: sellerRetry.ok ? null : (sellerRetry as any).text?.slice?.(0, 300),
          })
          if (sellerRetry.ok) {
            const enriched = normalize(sellerRetry.data)
            console.log('=== ORDER DETAILS REQUEST END (SUCCESS: seller-derived) ===\n')
            return NextResponse.json({ ok: true, ...enriched })
          }
        }

        const derivedBuyerAccount = String(
          buyerAccount ||
          out?.order?.BUYER_ISHYIGA_ACCOUNT ||
          out?.order?.buyerAccount ||
          out?.buyer?.ISHYIGA_ACCOUNT ||
          ""
        ).trim()
        if (derivedBuyerAccount) {
          const buyerRetry = await callBuyerItemsServlet(orderId, derivedBuyerAccount)
          attempts.push({
            attempt: "buyer-items-derived",
            url: buyerRetry.url,
            http: buyerRetry.http,
            error: buyerRetry.ok ? null : buyerRetry.error,
            success: buyerRetry.ok,
            textPreview: buyerRetry.ok ? null : (buyerRetry as any).text?.slice?.(0, 300),
          })
          if (buyerRetry.ok) {
            const enriched = normalize(buyerRetry.data)
            console.log('=== ORDER DETAILS REQUEST END (SUCCESS: buyer-derived) ===\n')
            return NextResponse.json({ ok: true, ...enriched })
          }
        }

        // SellerOrdersServlet often fails (e.g. SQL mismatch); try buyerOrderDetails on the same
        // OrdersServlet base URL — it may return line items including CONFIRMED_RECEIVED_QTY.
        let mergedOut = out
        const buyerAcc = String(
          out?.order?.BUYER_ISHYIGA_ACCOUNT ?? out?.buyer?.ISHYIGA_ACCOUNT ?? ""
        ).trim()
        for (const baseUrl of allUrls) {
          const bd = await callBuyerOrderDetailsServlet(baseUrl, orderId, buyerAcc)
          attempts.push({
            attempt: "orders-buyerOrderDetails",
            url: bd.url,
            http: bd.http,
            error: bd.ok ? null : bd.error,
            success: bd.ok,
            textPreview: bd.ok ? null : (bd as any).text?.slice?.(0, 300),
          })
          if (bd.ok) {
            const extra = extractItemsArray(bd.data)
            mergedOut = mergeServedQuantitiesIntoNormalized(out, extra)
            if (extra.length) break
          }
        }

        console.log('=== ORDER DETAILS REQUEST END (SUCCESS) ===\n')
        return NextResponse.json({ ok: true, ...mergedOut })
      }

      console.warn(`❌ [POST] Attempt ${i + 1} failed:`, {
        url,
        http: r.http,
        error: r.error,
        textPreview: (r as any).text?.slice?.(0, 300)
      })
    }

    console.error('❌ [POST] All attempts failed')
    console.log('=== ORDER DETAILS REQUEST END (FAILED) ===\n')

    return NextResponse.json({
      ok: false,
      error: "All backend URLs failed to return valid data",
      attempts,
      orderId,
      totalAttempts: allUrls.length
    }, { status: 502 })

  } catch (e: any) {
    console.error("[POST] Unexpected error:", e)
    console.error("Stack trace:", e?.stack)
    console.log('=== ORDER DETAILS REQUEST END (ERROR) ===\n')

    return NextResponse.json({
      ok: false,
      error: e?.message || "Unknown error occurred",
      type: e?.name || 'Error',
      ...(process.env.NODE_ENV === 'development' && {
        stack: e?.stack
      })
    }, { status: 500 })
  }
}

export async function GET(req: Request) {
  // Support GET requests as well
  return POST(req)
}