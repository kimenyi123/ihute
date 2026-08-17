/**
 * Supplier analytics: daily sales total and best-selling items.
 *
 * Daily totals come from `listSellerOrders`.
 * Best-selling needs order line items -> we must call `listSellerOrderItems`.
 */

import { NextRequest, NextResponse } from "next/server"
import { getSellerOrdersUrl } from "@/lib/backend-config"

function startOfTodayLocal(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function getOrderTimeMs(order: Record<string, unknown>): number | null {
  const raw =
    order.heure ??
    order.HEURE ??
    order.CREATED_AT ??
    order.createdAt ??
    order.created_at ??
    order.ORDER_DATE ??
    order.order_date

  if (raw == null) return null
  const text = String(raw).trim()
  if (!text) return null

  const mysqlLike = /^(\d{4}-\d{2}-\d{2})[\sT](\d{2}:\d{2}:\d{2})/.exec(text)
  if (mysqlLike) {
    const parsed = new Date(`${mysqlLike[1]}T${mysqlLike[2]}`)
    return Number.isNaN(parsed.getTime()) ? null : parsed.getTime()
  }

  const parsed = new Date(text)
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime()
}

export async function GET(req: NextRequest) {
  const account = req.nextUrl.searchParams.get("account")?.trim()
  if (!account) {
    return NextResponse.json({ ok: false, error: "account required" }, { status: 400 })
  }

  try {
    const todayStart = startOfTodayLocal().getTime()
    const sellerOrdersUrl = getSellerOrdersUrl()

    // 1) Fetch today's orders (paginate until we hit previous days)
    const pageSize = 100 // SellerOrdersServlet caps it at 100 anyway
    let page = 1
    let stop = false
    const todaysOrders: any[] = []

    while (!stop) {
      const res = await fetch(sellerOrdersUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body: new URLSearchParams({
          action: "listSellerOrders",
          sellerAccount: account,
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
        const orderTime = getOrderTimeMs(order)
        if (orderTime == null) continue
        if (orderTime < todayStart) {
          stop = true
          continue
        }
        todaysOrders.push(order)
      }

      page += 1
      if (page > 20) break // safety: avoid endless loops
      if (todaysOrders.length > 500) break // safety: keep this endpoint fast
    }

    // 2) Compute totals
    let dailySalesTotal = 0
    for (const order of todaysOrders) {
      dailySalesTotal += Number(order.AMOUNT ?? order.total ?? order.total_amount ?? 0)
    }
    const dailyOrdersCount = todaysOrders.length

    // 3) Load items for each order, then aggregate quantities.
    const itemTotals: Record<string, { name: string; quantity: number; total: number }> = {}

    const fetchOrderItems = async (orderId: number) => {
      const itemsRes = await fetch(sellerOrdersUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body: new URLSearchParams({
          action: "listSellerOrderItems",
          sellerAccount: account,
          orderId: String(orderId),
        }).toString(),
        cache: "no-store",
      })

      const raw = await itemsRes.text()
      if (!itemsRes.ok || !raw.trim() || raw.trim().startsWith("<")) return []

      try {
        const data = JSON.parse(raw)
        return Array.isArray(data?.items) ? data.items : []
      } catch {
        return []
      }
    }

    const concurrency = 6
    let idx = 0
    const runWorker = async () => {
      while (true) {
        const current = idx++
        if (current >= todaysOrders.length) return
        const order = todaysOrders[current]
        const orderId = Number(order?.ID_ORDER ?? order?.id_order ?? order?.orderId)
        if (!orderId) continue

        const items = await fetchOrderItems(orderId)
        for (const it of items) {
          const code = String(
            it.ITEM_CODE ?? it.itemCode ?? it.niki_code ?? it.nikiCode ?? ""
          ).trim()
          const name = String(it.ITEM_NAME ?? it.itemName ?? it.name ?? "Unknown").trim() || "Unknown"
          const key = code || name

          const qty = Number(it.quantity ?? it.QUANTITY ?? it.qty ?? it.QTY ?? 0)
          const unitPrice = Number(it.UNITY_PRICE ?? it.unitPrice ?? it.UNIT_PRICE ?? it.price ?? 0)
          const totalFromPayload =
            Number(it.TOTAL_WITH_VAT ?? it.TOTAL ?? it.total ?? it.totalWithVat ?? NaN) || undefined
          const total = typeof totalFromPayload === "number" ? totalFromPayload : qty * unitPrice

          if (!itemTotals[key]) itemTotals[key] = { name, quantity: 0, total: 0 }
          itemTotals[key].quantity += qty
          itemTotals[key].total += total
        }
      }
    }

    const workerCount = Math.min(concurrency, todaysOrders.length)
    await Promise.all(Array.from({ length: workerCount }, () => runWorker()))

    const bestSelling = Object.values(itemTotals)
      .sort((a, b) => b.quantity - a.quantity || b.total - a.total)
      .slice(0, 10)

    return NextResponse.json({ ok: true, dailySalesTotal, dailyOrdersCount, bestSelling })
  } catch (e) {
    console.error("[supplier/analytics]", e)
    return NextResponse.json({
      ok: true,
      dailySalesTotal: 0,
      dailyOrdersCount: 0,
      bestSelling: [],
    })
  }
}
