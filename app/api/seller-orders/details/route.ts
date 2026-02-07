// app/api/seller-orders/details/route.ts
import { NextResponse } from "next/server"
import { getOrdersUrl } from "@/lib/backend-config"

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
  const order  = data?.order ?? null
  const items0 =
    (Array.isArray(data?.items) && data.items) ||
    (order && Array.isArray(order.items) ? order.items : []) || []
  const seller = data?.seller ?? null
  const buyer  = data?.buyer ?? null

  const items = items0.map((it: any) => {
    const qty = Number(it.QUANTITY ?? it.qty ?? it.quantity ?? it.ITEM_QTY ?? 0)
    const unitPrice = Number(
      it.UNIT_PRICE ?? it.UNITY_PRICE ?? it.REQUEST_PRICE ?? it.unitPrice ?? it.price ?? 0
    )
    return {
      ITEM_NAME: it.ITEM_NAME ?? it.name ?? "",
      QUANTITY: qty,
      UNIT_PRICE: unitPrice,
      total: qty * unitPrice,
      UNIT: it.UNIT ?? it.unit ?? it.measurement ?? "",
      ITEM_CODE: it.ITEM_CODE ?? it.code ?? String(it.ID_ORDER ?? ""),
      ...it,
    }
  })

  return { order, items, seller, buyer }
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
    const orderId = await readOrderId(req)

    if (!orderId) {
      console.error('[POST] Missing orderId')
      return NextResponse.json({
        ok: false,
        error: "orderId required"
      }, { status: 400 })
    }

    console.log(`[POST] Processing order details for orderId: ${orderId}`)

    const attempts: any[] = []
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
        console.log('=== ORDER DETAILS REQUEST END (SUCCESS) ===\n')
        return NextResponse.json({ ok: true, ...out })
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