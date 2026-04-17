import { NextRequest, NextResponse } from "next/server"
import { getBackendBase } from "@/lib/backend-config"
import type { KioskLiveOrder, KaosOrderStatus } from "@/src/modules/self-order/types"
import { KAOS_TO_KIOSK_STATUS } from "@/src/modules/self-order/types"

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const sellerAccount = searchParams.get("sellerAccount") || undefined
  const kioskCategory = searchParams.get("kioskCategory") || undefined
  const locationId = searchParams.get("locationId") || undefined
  const lane = searchParams.get("lane") || undefined

  if (lane && !sellerAccount) {
    return NextResponse.json(
      { error: "lane (bar|kitchen) requires sellerAccount" },
      { status: 400 },
    )
  }

  // Require at least one meaningful filter so we don't dump all kiosk orders
  if (!sellerAccount && !kioskCategory && !locationId) {
    return NextResponse.json(
      { error: "At least one of sellerAccount, kioskCategory, or locationId is required" },
      { status: 400 },
    )
  }

  try {
    const base = getBackendBase()

    const url = new URL(`${base}/api/kiosk/orders`)
    if (sellerAccount) url.searchParams.set("sellerAccount", sellerAccount)
    if (lane) url.searchParams.set("lane", lane)
    if (kioskCategory) url.searchParams.set("kioskCategory", kioskCategory)
    if (locationId) url.searchParams.set("locationId", locationId)

    const resp = await fetch(url.toString(), {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    })

    const rawText = await resp.text().catch(() => "")
    let data: any = {}
    if (rawText) {
      try {
        data = JSON.parse(rawText)
      } catch {
        data = {}
      }
    }
    if (!resp.ok) {
      return NextResponse.json(
        {
          error: data?.error || "Failed to load kiosk orders",
          backendText: rawText ? rawText.slice(0, 2000) : "",
          backendStatus: resp.status,
          backendUrl: url.toString(),
        },
        { status: 502 },
      )
    }

    const rawOrders: any[] = Array.isArray(data.orders) ? data.orders : []

    const orders: KioskLiveOrder[] = rawOrders.map((o) => {
      const kaosStatus = String(
        o.status || o.ORDER_STATUS || "ORDER",
      ).toUpperCase() as KaosOrderStatus
      const kioskStatus = KAOS_TO_KIOSK_STATUS[kaosStatus] ?? "waiting"

      const fullTot = o.full_order_total
      return {
        order_id: String(o.order_id ?? o.ID_ORDER ?? ""),
        order_number: String(o.order_number ?? o.ORDER_NUMBER ?? ""),
        table_number: o.table_number ?? o.TABLE_NUMBER ?? o.TABLE_NAME,
        customer_name: o.customer_name ?? o.CUSTOMER_NAME ?? o.BUYER_NAMES,
        status: kioskStatus,
        kiosk_category: o.kiosk_category ?? o.KIOSK_CATEGORY ?? "BAR",
        lane: o.lane === "bar" || o.lane === "kitchen" ? o.lane : undefined,
        items: Array.isArray(o.items) ? o.items : [],
        total_amount: Number(o.total_amount ?? o.AMOUNT ?? 0),
        full_order_total:
          fullTot !== undefined && fullTot !== null && !Number.isNaN(Number(fullTot))
            ? Number(fullTot)
            : undefined,
        created_at: String(o.created_at ?? o.heure ?? ""),
        updated_at: String(o.updated_at ?? o.heure ?? ""),
      }
    })

    return NextResponse.json({ orders })
  } catch (e: any) {
    console.error("[kiosk/orders] error", e?.message || e)
    return NextResponse.json(
      { error: "Orders request failed" },
      { status: 500 },
    )
  }
}

