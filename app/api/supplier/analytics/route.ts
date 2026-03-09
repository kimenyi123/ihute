/**
 * Supplier analytics: daily sales total and best-selling items.
 * Fetches from backend seller-orders; aggregates by order date. No hardcoded data.
 */

import { NextRequest, NextResponse } from "next/server"
import { getSellerOrdersUrl } from "@/lib/backend-config"

function startOfTodayLocal(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export async function GET(req: NextRequest) {
  const account = req.nextUrl.searchParams.get("account")?.trim()
  if (!account) {
    return NextResponse.json({ ok: false, error: "account required" }, { status: 400 })
  }

  try {
    const res = await fetch(getSellerOrdersUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({
        action: "listSellerOrders",
        sellerAccount: account,
        page: "1",
        pageSize: "500",
      }).toString(),
      cache: "no-store",
    })

    const raw = await res.text()
    let orders: any[] = []
    if (res.ok && raw.trim() && !raw.trim().startsWith("<")) {
      try {
        const data = JSON.parse(raw)
        orders = Array.isArray(data?.orders) ? data.orders : []
      } catch {
        orders = []
      }
    }
    const todayStart = startOfTodayLocal().getTime()

    let dailySalesTotal = 0
    let dailyOrdersCount = 0
    const itemTotals: Record<string, { name: string; quantity: number; total: number }> = {}

    for (const order of orders) {
      const created = order.CREATED_AT ?? order.createdAt ?? order.order_date
      const orderTime = created ? new Date(created).getTime() : 0
      if (orderTime < todayStart) continue

      dailyOrdersCount += 1
      const amount = Number(order.AMOUNT ?? order.total ?? order.total_amount ?? 0)
      dailySalesTotal += amount

      const items = order.items ?? order.order_items ?? []
      for (const it of items) {
        const name = (it.ITEM_NAME ?? it.name ?? "Unknown").trim() || "Unknown"
        const qty = Number(it.QUANTITY ?? it.qty ?? it.quantity ?? 0)
        const unitPrice = Number(it.UNIT_PRICE ?? it.unitPrice ?? it.price ?? 0)
        const total = qty * unitPrice
        const key = `${name}|${unitPrice}`
        if (!itemTotals[key]) itemTotals[key] = { name, quantity: 0, total: 0 }
        itemTotals[key].quantity += qty
        itemTotals[key].total += total
      }
    }

    const bestSelling = Object.values(itemTotals)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10)

    return NextResponse.json({
      ok: true,
      dailySalesTotal,
      dailyOrdersCount,
      bestSelling,
    })
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
