/**
 * Aggregates buyer spend on top-up style lines (see `lib/topup-catalog.ts`)
 * via SellerOrdersServlet (listBuyerOrders + listBuyerOrderItems).
 *
 * Query: `days=30` | `days=90` | `days=all` — "all" scans more pages/orders (capped for safety).
 */

import { NextRequest, NextResponse } from "next/server"
import { getSellerOrdersUrl } from "@/lib/backend-config"
import { isTopUpLineItem, lineTotalRwf } from "@/lib/topup-catalog"

export async function GET(req: NextRequest) {
  const buyerAccount = req.nextUrl.searchParams.get("account")?.trim()
  if (!buyerAccount) {
    return NextResponse.json({ ok: false, error: "account required" }, { status: 400 })
  }

  const daysRaw = (req.nextUrl.searchParams.get("days") ?? "").trim().toLowerCase()
  const allTime = daysRaw === "all" || daysRaw === "0"
  const rangeDays = allTime ? null : Math.min(365, Math.max(1, Number(daysRaw) || 30))
  const cutoff = allTime ? 0 : Date.now() - (rangeDays as number) * 86_400_000

  const maxPages = allTime ? 60 : 25
  const maxCollect = allTime ? 500 : 150
  const maxItemFetches = allTime ? 250 : 100

  const sellerOrdersUrl = getSellerOrdersUrl()
  const pageSize = 50
  let page = 1
  const inWindow: { id: number }[] = []
  const seenOrderIds = new Set<number>()

  try {
    while (page <= maxPages && inWindow.length < maxCollect) {
      const res = await fetch(sellerOrdersUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body: new URLSearchParams({
          action: "listBuyerOrders",
          buyerAccount,
          page: String(page),
          pageSize: String(pageSize),
        }).toString(),
        cache: "no-store",
      })

      const raw = await res.text()
      if (!res.ok || !raw.trim() || raw.trim().startsWith("<")) break

      let orders: any[] = []
      try {
        const data = JSON.parse(raw)
        orders = Array.isArray(data?.orders) ? data.orders : []
      } catch {
        orders = []
      }

      if (!orders.length) break

      for (const order of orders) {
        const created = order.CREATED_AT ?? order.createdAt ?? order.order_date
        const orderTime = created ? new Date(created).getTime() : 0
        if (cutoff > 0 && orderTime < cutoff) continue
        const orderId = Number(order?.ID_ORDER ?? order?.id_order ?? order?.orderId)
        if (orderId && !seenOrderIds.has(orderId)) {
          seenOrderIds.add(orderId)
          inWindow.push({ id: orderId })
        }
      }

      page += 1
      if (orders.length < pageSize) break
    }

    const toFetch = inWindow.slice(0, maxItemFetches)
    let topupSalesTotal = 0
    let topupLineCount = 0
    const ordersWithTopup = new Set<number>()

    const fetchItems = async (orderId: number) => {
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
      if (!itemsRes.ok || !text.trim() || text.trim().startsWith("<")) return

      let items: any[] = []
      try {
        const data = JSON.parse(text)
        items = Array.isArray(data?.items) ? data.items : []
      } catch {
        return
      }

      for (const it of items) {
        const row = it as Record<string, unknown>
        if (!isTopUpLineItem(row)) continue
        topupSalesTotal += lineTotalRwf(row)
        topupLineCount += 1
        ordersWithTopup.add(orderId)
      }
    }

    const concurrency = 5
    let idx = 0
    const worker = async () => {
      while (true) {
        const i = idx++
        if (i >= toFetch.length) return
        await fetchItems(toFetch[i]!.id)
      }
    }

    const n = Math.min(concurrency, toFetch.length)
    await Promise.all(Array.from({ length: n }, () => worker()))

    return NextResponse.json({
      ok: true,
      period: allTime ? "all" : "range",
      rangeDays,
      topupSalesTotal,
      topupLineCount,
      topupOrdersCount: ordersWithTopup.size,
      ordersScanned: toFetch.length,
    })
  } catch (e) {
    console.error("[buyer/topup-sales]", e)
    return NextResponse.json({
      ok: true,
      period: allTime ? "all" : "range",
      rangeDays,
      topupSalesTotal: 0,
      topupLineCount: 0,
      topupOrdersCount: 0,
      ordersScanned: 0,
    })
  }
}
