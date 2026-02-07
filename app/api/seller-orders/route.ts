// app/api/seller-orders/route.ts
import { NextResponse } from "next/server"

// Use SellerOrdersServlet (listSellerOrders implemented there). Set JAVA_SELLER_ORDERS_URL if your context path differs.
const JAVA_BACKEND_URL =
  process.env.JAVA_SELLER_ORDERS_URL || "https://ihute.rw/Trading/SellerOrdersServlet"
function tryParseJson(raw: string) {
  try { return JSON.parse(raw) } catch {}
  let s = raw.replace(/\uFEFF/g, "").trim()
  const i = s.search(/[{\[]/)
  if (i > 0) s = s.slice(i)
  try { return JSON.parse(s) } catch {}
  s = s.replace(/[\u0000-\u001F\u007F]+/g, " ")
  return JSON.parse(s)
}

function normalizeOrders(input: any): any[] {
  const arr = Array.isArray(input?.orders) ? input.orders : []
  return arr.map((order: any) => ({
    ...order,  // This spreads all fields from the original order

    // ✅ Explicitly ensure TIN fields are included and mapped correctly
    SELLER_TIN: order.SELLER_TIN ?? order.sellerTin ?? "",
    BUYER_TIN: order.BUYER_TIN ?? order.buyerTin ?? "",
    BUYER_OWNER_NAME: order.BUYER_OWNER_NAME ?? order.buyerOwnerName ?? "",

    items: (Array.isArray(order?.items) ? order.items : []).map((item: any) => {
      const qty = Number(item.QUANTITY ?? item.qty ?? item.quantity ?? 0)
      const unitPrice = Number(
        item.UNIT_PRICE ?? item.UNITY_PRICE ?? item.REQUEST_PRICE ?? item.unitPrice ?? item.price ?? 0
      )
      return {
        ITEM_NAME: item.ITEM_NAME ?? item.name ?? "",
        QUANTITY: qty,
        UNIT_PRICE: unitPrice,
        total: qty * unitPrice,
        UNIT: item.UNIT ?? item.unit ?? item.measurement ?? "",
        ITEM_CODE: item.ITEM_CODE ?? item.code,
      }
    }),
  }))
}

export async function POST(req: Request) {
  const reqId = `seller-orders-${Date.now()}`
  try {
    const body = await req.json().catch(() => ({} as any))
    const sellerAccount = String(body?.sellerAccount ?? "").trim()
    const page = Math.max(1, Number(body?.page ?? 1))
    const pageSize = Math.min(100, Math.max(1, Number(body?.pageSize ?? 20)))

    console.log(`[${reqId}] POST /api/seller-orders — sellerAccount=${sellerAccount || "(empty)"} page=${page} pageSize=${pageSize}`)

    if (!sellerAccount) {
      console.warn(`[${reqId}] 400 sellerAccount required`)
      return NextResponse.json({ ok: false, error: "sellerAccount required" }, { status: 400 })
    }

    const form = new URLSearchParams({
      action: "listSellerOrders",
      sellerAccount,
      page: String(page),
      pageSize: String(pageSize),
    }).toString()

    console.log(`[${reqId}] Calling backend appiiii: ${JAVA_BACKEND_URL}`)
    const res = await fetch(JAVA_BACKEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: form,
      cache: "no-store",
    })

    const raw = await res.text()
    let data: any
    try { data = tryParseJson(raw) }
    catch {
      console.error(`[${reqId}] ❌ Backend returned invalid JSON, snippet:`, raw.slice(0, 400))
      return NextResponse.json({ ok: false, error: "Backend returned invalid JSON" }, { status: 502 })
    }

    if (!res.ok || data?.ok === false) {
      console.error(`[${reqId}] ❌ Backend error:`, data?.error, "HTTP:", res.status, "snippet:", raw.slice(0, 400))
      return NextResponse.json({ ok: false, error: data?.error || `HTTP ${res.status}` }, { status: 502 })
    }

    const orders = normalizeOrders(data)
    const total = Number(data?.total ?? 0)
    console.log(`[${reqId}] ✅ 200 OK — orders=${orders.length} total=${total}`)
    return NextResponse.json({ ok: true, orders, total, page, pageSize }, { status: 200 })
  } catch (e: any) {
    console.error(`[${reqId}] ❌ Unexpected error:`, e?.message)
    return NextResponse.json({ ok: false, error: e?.message || "unknown error" }, { status: 500 })
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const sellerAccount = String(searchParams.get("sellerAccount") ?? "").trim()
    const page = Math.max(1, Number(searchParams.get("page") ?? 1))
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? 20)))

    if (!sellerAccount) {
      return NextResponse.json({ ok: false, error: "sellerAccount required" }, { status: 400 })
    }

    const qs = new URLSearchParams({
      action: "listSellerOrders",
      sellerAccount,
      page: String(page),
      pageSize: String(pageSize),
    })

    const res = await fetch(`${JAVA_BACKEND_URL}?${qs}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    })

    const raw = await res.text()
    let data: any
    try { data = tryParseJson(raw) }
    catch {
      console.error("❌ list GET: bad JSON from servlet, snippet:", raw.slice(0, 400))
      return NextResponse.json({ ok: false, error: "Backend returned invalid JSON" }, { status: 502 })
    }

    if (!res.ok || data?.ok === false) {
      console.error("❌ list GET: servlet error:", data?.error, "HTTP:", res.status, "snippet:", raw.slice(0, 400))
      return NextResponse.json({ ok: false, error: data?.error || `HTTP ${res.status}` }, { status: 502 })
    }

    const orders = normalizeOrders(data)
    const total = Number(data?.total ?? 0)
    return NextResponse.json({ ok: true, orders, total, page, pageSize }, { status: 200 })
  } catch (e: any) {
    console.error("❌ list GET: unexpected error:", e?.message)
    return NextResponse.json({ ok: false, error: e?.message || "unknown error" }, { status: 500 })
  }
}
