// app/api/seller-orders/route.ts
import { NextResponse } from "next/server"
import { getSellerOrdersUrl } from "@/lib/backend-config"
import { lookupOrderMetaFromStore, readAllOrderClientMeta } from "@/lib/order-client-meta-store"
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
    
    // ✅ Get buyer/owner info from account_signup using BUYER_ISHYIGA_ACCOUNT
    BUYER_OWNER: order.BUYER_ACCOUNT_OWNER ?? order.BUYER_OWNER_NAME ?? order.BUYER_OWNER ?? order.OWNER ?? order.owner ?? "",
    BUYER_OWNER_NAME: order.BUYER_ACCOUNT_OWNER ?? order.BUYER_OWNER_NAME ?? order.OWNER ?? order.owner ?? "",
    BUYER_EMAIL: order.BUYER_ACCOUNT_EMAIL ?? order.BUYER_EMAIL ?? order.EMAIL ?? order.email ?? "",
    
    // ✅ Remove ORDERED_BY field completely
    // ORDERED_BY: order.ORDERED_BY ?? order.ordered_by ?? "",  // REMOVED

    /** Seller dashboard: show buyer name / phone / address (Java field names vary). */
    BUYER_NAMES:
      order.BUYER_NAMES ??
      order.buyer_names ??
      order.BUYER_NAME ??
      order.BUYER_OWNER ??
      order.BUYER_OWNER_NAME ??
      order.buyerOwnerName ??
      "",
    BUYER_PHONE:
      order.BUYER_ACCOUNT_PHONE ??
      order.BUYER_PHONE ??
      order.buyer_phone ??
      order.BUYER_TEL ??
      order.BUYER_TEL1 ??
      order.PHONE ??
      order.phone ??
      "",
    DELIVERY_LOCATION:
      order.DELIVERY_LOCATION ??
      order.delivery_location ??
      order.BUYER_LOCATION ??
      order.buyer_location ??
      "",

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
        // ✅ Remove ORDERED_BY from items too
        // ORDERED_BY: item.ORDERED_BY ?? item.ordered_by ?? "",  // REMOVED
      }
    }),
  }))
}

export async function POST(req: Request) {
  const reqId = `seller-orders-${Date.now()}`
  try {
    const body = await req.json().catch(() => ({} as any))
    const sellerAccount = String(body?.sellerAccount ?? "").trim()
    const buyerAccount = String(body?.buyerAccount ?? "").trim()
    const client = String(body?.CLIENT ?? "").trim()
    const start = String(body?.START ?? "").trim()
    const end = String(body?.END ?? "").trim()
    const criteria = String(body?.criteria ?? "").trim()
    const page = Math.max(1, Number(body?.page ?? 1))
    const pageSize = Math.min(500, Math.max(1, Number(body?.pageSize ?? 100)))

    console.log(`[${reqId}] POST /api/seller-orders — sellerAccount=${sellerAccount || "(empty)"} page=${page} pageSize=${pageSize}`)

    if (!sellerAccount) {
      console.warn(`[${reqId}] 400 sellerAccount required`)
      return NextResponse.json({ ok: false, error: "sellerAccount required" }, { status: 400 })
    }

    const formParams = new URLSearchParams({
      action: "listSellerOrders",
      sellerAccount,
      page: String(page),
      pageSize: String(pageSize),
    })
    if (buyerAccount) formParams.set("buyerAccount", buyerAccount)
    if (client) formParams.set("CLIENT", client)
    if (start) formParams.set("START", start)
    if (end) formParams.set("END", end)
    if (criteria) formParams.set("criteria", criteria)
    const form = formParams.toString()

    const backendUrl = getSellerOrdersUrl()
    console.log(`[${reqId}] Calling backend: ${backendUrl}`)
    const res = await fetch(backendUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: form,
      cache: "no-store",
    })

    const raw = await res.text()
    if (!res.ok || raw.trim().startsWith("<")) {
      console.warn(`[${reqId}] Backend unavailable (HTTP ${res.status}), returning empty orders`)
      return NextResponse.json({ ok: true, orders: [], total: 0, page, pageSize }, { status: 200 })
    }
    let data: any
    try { data = tryParseJson(raw) }
    catch {
      console.warn(`[${reqId}] Backend returned invalid JSON, returning empty orders`)
      return NextResponse.json({ ok: true, orders: [], total: 0, page, pageSize }, { status: 200 })
    }

    if (data?.ok === false) {
      console.warn(`[${reqId}] Backend error:`, data?.error, "returning empty orders")
      return NextResponse.json({ ok: true, orders: [], total: 0, page, pageSize }, { status: 200 })
    }

    const metaStore = readAllOrderClientMeta()
    const orders = normalizeOrders(data).map((order: Record<string, unknown>) => {
      const id = String(order.ID_ORDER ?? order.id_order ?? "").trim()
      if (!id) return order
      const m = lookupOrderMetaFromStore(metaStore, id)
      if (!m) return order
      const next = { ...order }
      if (m.buyerDeliveryAddress) {
        const addr = String(m.buyerDeliveryAddress).trim()
        next.BUYER_LOCATION = addr
        next.DELIVERY_LOCATION = addr
        next._buyerAddressFromSync = true
      }
      if (m.sellerPaymentAck) {
        next._sellerPaymentAck = m.sellerPaymentAck
      }
      return next
    })
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
    const pageSize = Math.min(500, Math.max(1, Number(searchParams.get("pageSize") ?? 100)))

    if (!sellerAccount) {
      return NextResponse.json({ ok: false, error: "sellerAccount required" }, { status: 400 })
    }

    const qs = new URLSearchParams({
      action: "listSellerOrders",
      sellerAccount,
      page: String(page),
      pageSize: String(pageSize),
    })

    const res = await fetch(`${getSellerOrdersUrl()}?${qs}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    })

    const raw = await res.text()
    if (!res.ok || raw.trim().startsWith("<")) {
      console.warn("Seller-orders GET: backend unavailable (HTTP " + res.status + "), returning empty orders")
      return NextResponse.json({ ok: true, orders: [], total: 0, page, pageSize }, { status: 200 })
    }
    let data: any
    try { data = tryParseJson(raw) }
    catch {
      console.warn("Seller-orders GET: invalid JSON from backend, returning empty orders")
      return NextResponse.json({ ok: true, orders: [], total: 0, page, pageSize }, { status: 200 })
    }

    if (data?.ok === false) {
      console.warn("Seller-orders GET: backend error, returning empty orders")
      return NextResponse.json({ ok: true, orders: [], total: 0, page, pageSize }, { status: 200 })
    }

    const metaStore = readAllOrderClientMeta()
    const orders = normalizeOrders(data).map((order: Record<string, unknown>) => {
      const id = String(order.ID_ORDER ?? order.id_order ?? "").trim()
      if (!id) return order
      const m = lookupOrderMetaFromStore(metaStore, id)
      if (!m) return order
      const next = { ...order }
      if (m.buyerDeliveryAddress) {
        const addr = String(m.buyerDeliveryAddress).trim()
        next.BUYER_LOCATION = addr
        next.DELIVERY_LOCATION = addr
        next._buyerAddressFromSync = true
      }
      if (m.sellerPaymentAck) {
        next._sellerPaymentAck = m.sellerPaymentAck
      }
      return next
    })
    const total = Number(data?.total ?? 0)
    return NextResponse.json({ ok: true, orders, total, page, pageSize }, { status: 200 })
  } catch (e: any) {
    console.error("❌ list GET: unexpected error:", e?.message)
    return NextResponse.json({ ok: false, error: e?.message || "unknown error" }, { status: 500 })
  }
}
