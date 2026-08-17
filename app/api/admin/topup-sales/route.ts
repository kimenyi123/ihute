/**
 * Platform-wide top-up line totals (same detection as buyer dashboard / lib/topup-catalog.ts).
 * Uses AdminServlet getAllOrders (capped) then loads line items via SellerOrdersServlet.
 *
 * GET ?days=30|90|all  — header: x-admin-email (admin identity)
 */

import { NextRequest, NextResponse } from "next/server"
import { getBackendBase, getSellerOrdersUrl } from "@/lib/backend-config"
import { isTopUpLineItem, lineTotalRwf } from "@/lib/topup-catalog"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function numOrderId(o: Record<string, unknown>): number {
  const v = Number(o.id ?? o.ID_ORDER ?? o.orderId ?? o.ID)
  return Number.isFinite(v) && v > 0 ? v : 0
}

function orderTs(o: Record<string, unknown>): number {
  const t = o.timestamp ?? o.CREATED_AT ?? o.createdAt ?? o.order_date ?? o.ORDER_DATE
  if (!t) return 0
  const ms = new Date(String(t)).getTime()
  return Number.isNaN(ms) ? 0 : ms
}

function sellerAcct(o: Record<string, unknown>): string {
  return String(
    o.sellerAccount ?? o.SELLER_ISHYIGA_ACCOUNT ?? o.SELLER_ACCOUNT ?? o.seller_ishyiga ?? ""
  ).trim()
}

function buyerAcct(o: Record<string, unknown>): string {
  return String(
    o.buyerAccount ?? o.BUYER_ISHYIGA_ACCOUNT ?? o.buyer_ishyiga ?? o.BUYER_ACCOUNT ?? ""
  ).trim()
}

function inlineItems(o: Record<string, unknown>): unknown[] | null {
  const items = o.items ?? o.orderItems
  return Array.isArray(items) && items.length ? (items as unknown[]) : null
}

async function postAdminServlet(form: URLSearchParams, forward?: Headers) {
  const url = `${getBackendBase()}/AdminServlet`
  const h: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "application/json",
  }
  const cookie = forward?.get("cookie")
  if (cookie) h.Cookie = cookie
  const tok = forward?.get("x-admin-token")
  if (tok) h["X-Admin-Token"] = tok
  const res = await fetch(url, {
    method: "POST",
    headers: h,
    body: form.toString(),
    cache: "no-store",
  })
  const text = await res.text()
  let json: Record<string, unknown> | null = null
  try {
    json = JSON.parse(text) as Record<string, unknown>
  } catch {
    json = null
  }
  return { res, json, rawText: text }
}

async function fetchSellerItems(sellerOrdersUrl: string, sellerAccount: string, orderId: number) {
  const itemsRes = await fetch(sellerOrdersUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      action: "listSellerOrderItems",
      sellerAccount,
      orderId: String(orderId),
    }).toString(),
    cache: "no-store",
  })
  const text = await itemsRes.text()
  if (!itemsRes.ok || !text.trim() || text.trim().startsWith("<")) return [] as Record<string, unknown>[]
  try {
    const data = JSON.parse(text) as { items?: unknown[] }
    return Array.isArray(data?.items) ? (data.items as Record<string, unknown>[]) : []
  } catch {
    return []
  }
}

async function fetchBuyerItems(sellerOrdersUrl: string, buyerAccount: string, orderId: number) {
  const itemsRes = await fetch(sellerOrdersUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      action: "listBuyerOrderItems",
      buyerAccount,
      orderId: String(orderId),
    }).toString(),
    cache: "no-store",
  })
  const text = await itemsRes.text()
  if (!itemsRes.ok || !text.trim() || text.trim().startsWith("<")) return [] as Record<string, unknown>[]
  try {
    const data = JSON.parse(text) as { items?: unknown[] }
    return Array.isArray(data?.items) ? (data.items as Record<string, unknown>[]) : []
  } catch {
    return []
  }
}

type Work = {
  orderId: number
  sellerAccount: string
  buyerAccount: string
  presetItems: Record<string, unknown>[] | null
}

export async function GET(req: NextRequest) {
  const adminEmail = req.headers.get("x-admin-email")?.trim()
  if (!adminEmail) {
    return NextResponse.json({ ok: false, error: "x-admin-email header required" }, { status: 401 })
  }

  const daysRaw = (req.nextUrl.searchParams.get("days") ?? "all").trim().toLowerCase()
  const allTime = daysRaw === "all" || daysRaw === "0"
  const rangeDays = allTime ? null : Math.min(365, Math.max(1, Number(daysRaw) || 30))
  const cutoff = allTime ? 0 : Date.now() - (rangeDays as number) * 86_400_000

  const listLimit = allTime ? 500 : 250
  const maxItemFetches = allTime ? 250 : 100

  const form = new URLSearchParams()
  form.set("action", "getAllOrders")
  form.set("adminEmail", adminEmail)
  form.set("limit", String(listLimit))
  form.set("sector", "")
  form.set("sellerAccount", "")
  form.set("status", "")

  const adminTok = req.headers.get("x-admin-token")?.trim()
  if (adminTok) {
    form.set("adminToken", adminTok)
  }

  const { res: adminHttp, json: adminJson, rawText } = await postAdminServlet(form, req.headers)

  if (adminJson && adminJson.ok === false) {
    const msg = String((adminJson as { error?: unknown }).error || "getAllOrders failed")
    const st =
      adminHttp.status === 401 || adminHttp.status === 403
        ? adminHttp.status
        : /unauthorized|admin access required/i.test(msg)
          ? 401
          : 400
    return NextResponse.json({ ok: false, error: msg }, { status: st })
  }

  if (!adminHttp.ok || !adminJson) {
    const looksUnauthorized =
      adminHttp.status === 401 ||
      adminHttp.status === 403 ||
      /unauthorized|admin access required/i.test(rawText.slice(0, 2000))
    return NextResponse.json(
      {
        ok: false,
        error: looksUnauthorized
          ? "Unauthorized: Admin access required (getAllOrders)"
          : "getAllOrders failed: invalid or non-JSON response from AdminServlet",
      },
      { status: looksUnauthorized ? 401 : 502 },
    )
  }

  const ordersRaw = Array.isArray(adminJson.orders) ? (adminJson.orders as Record<string, unknown>[]) : []
  const sellerOrdersUrl = getSellerOrdersUrl()
  const seenOrderIds = new Set<number>()
  const queue: Work[] = []

  for (const row of ordersRaw) {
    const orderId = numOrderId(row)
    if (!orderId || seenOrderIds.has(orderId)) continue
    const ts = orderTs(row)
    if (cutoff > 0 && ts > 0 && ts < cutoff) continue
    seenOrderIds.add(orderId)

    const inline = inlineItems(row)
    const seller = sellerAcct(row)
    const buyer = buyerAcct(row)
    if (inline) {
      queue.push({ orderId, sellerAccount: seller, buyerAccount: buyer, presetItems: inline as Record<string, unknown>[] })
    } else if (seller) {
      queue.push({ orderId, sellerAccount: seller, buyerAccount: buyer, presetItems: null })
    } else if (buyer) {
      queue.push({ orderId, sellerAccount: "", buyerAccount: buyer, presetItems: null })
    }
  }

  const toProcess = queue.slice(0, maxItemFetches)
  let topupSalesTotal = 0
  let topupLineCount = 0
  const ordersWithTopup = new Set<number>()

  const processOne = async (w: Work) => {
    let items: Record<string, unknown>[] = []
    if (w.presetItems?.length) items = w.presetItems
    else if (w.sellerAccount)
      items = await fetchSellerItems(sellerOrdersUrl, w.sellerAccount, w.orderId)
    else if (w.buyerAccount) items = await fetchBuyerItems(sellerOrdersUrl, w.buyerAccount, w.orderId)

    for (const it of items) {
      if (!isTopUpLineItem(it)) continue
      topupSalesTotal += lineTotalRwf(it)
      topupLineCount += 1
      ordersWithTopup.add(w.orderId)
    }
  }

  const concurrency = 5
  let idx = 0
  const worker = async () => {
    while (true) {
      const i = idx++
      if (i >= toProcess.length) return
      await processOne(toProcess[i]!)
    }
  }
  const n = Math.min(concurrency, Math.max(1, toProcess.length))
  await Promise.all(Array.from({ length: n }, () => worker()))

  return NextResponse.json({
    ok: true,
    period: allTime ? "all" : "range",
    rangeDays,
    topupSalesTotal,
    topupLineCount,
    topupOrdersCount: ordersWithTopup.size,
    ordersScanned: toProcess.length,
    ordersAvailable: queue.length,
  })
}
