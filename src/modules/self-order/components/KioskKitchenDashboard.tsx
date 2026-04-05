"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { KioskLiveOrder, KioskOrderStatus } from "@/src/modules/self-order/types"
import { Button } from "@/components/ui/button"

const COLUMNS: { id: KioskOrderStatus; title: string }[] = [
  { id: "waiting", title: "Pending" },
  { id: "in_kitchen", title: "Preparing" },
  { id: "ready", title: "Ready" },
  { id: "completed", title: "Completed" },
]

interface Props {
  sellerAccount?: string
  kioskCategory?: string
  locationId?: string
}

export function KioskKitchenDashboard({ sellerAccount, kioskCategory, locationId }: Props) {
  const [orders, setOrders] = useState<KioskLiveOrder[]>([])
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  // Keep local status overrides so polling doesn't snap cards back to DB state
  // while the backend update is still in-flight or kaos not yet redeployed.
  const localOverrides = useRef<Record<string, KioskOrderStatus>>({})

  const categoryLabel = useMemo(() => {
    if (!kioskCategory) return "All categories"
    if (kioskCategory === "BAR") return "Bar"
    if (kioskCategory === "RESTRO") return "Restaurant"
    if (kioskCategory === "COFFEE_SHOP") return "Coffee Shop"
    return kioskCategory
  }, [kioskCategory])

  const apiLane =
    sellerAccount && kioskCategory === "BAR"
      ? "bar"
      : sellerAccount && kioskCategory === "RESTRO"
        ? "kitchen"
        : null

  useEffect(() => {
    let cancelled = false
    const poll = async () => {
      try {
        const url = new URL("/api/kiosk/orders", window.location.origin)
        if (sellerAccount) url.searchParams.set("sellerAccount", sellerAccount)
        if (apiLane) url.searchParams.set("lane", apiLane)
        else if (kioskCategory) url.searchParams.set("kioskCategory", kioskCategory)
        if (locationId) url.searchParams.set("locationId", locationId)
        const res = await fetch(url.toString(), { cache: "no-store" })
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) {
          setWarning(data.error || "Failed to load orders")
          return
        }
        const incoming: KioskLiveOrder[] = Array.isArray(data.orders) ? data.orders : []
        // Apply local overrides: if we already moved an order, keep its local status
        // unless the DB has caught up with a status beyond what we set.
        const STATUS_RANK: Record<KioskOrderStatus, number> = {
          waiting: 0, in_kitchen: 1, ready: 2, completed: 3, cancelled: 4,
        }
        const merged = incoming.map((o) => {
          const override = localOverrides.current[o.order_id]
          if (!override) return o
          // If DB has progressed further, trust DB and clear override
          if (STATUS_RANK[o.status] >= STATUS_RANK[override]) {
            delete localOverrides.current[o.order_id]
            return o
          }
          return { ...o, status: override }
        })
        setOrders(merged)
        setLastUpdated(new Date().toLocaleTimeString())
        setWarning(null)
      } catch (e: any) {
        if (cancelled) return
        setWarning(e?.message || "Failed to load orders")
      }
    }
    poll()
    const interval = setInterval(poll, 5000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [sellerAccount, kioskCategory, locationId, apiLane])

  const grouped = useMemo(() => {
    const buckets: Record<KioskOrderStatus, KioskLiveOrder[]> = {
      waiting: [],
      in_kitchen: [],
      ready: [],
      completed: [],
      cancelled: [],
    }
    for (const o of orders) {
      buckets[o.status]?.push(o)
    }
    return buckets
  }, [orders])

  const updateStatus = async (order: KioskLiveOrder, status: KioskOrderStatus) => {
    // Optimistically move the card immediately
    localOverrides.current[order.order_id] = status
    setOrders((prev) =>
      prev.map((o) => (o.order_id === order.order_id ? { ...o, status } : o)),
    )
    try {
      const res = await fetch(
        `/api/kiosk/orders/${encodeURIComponent(order.order_id)}/status`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            apiLane ? { status, lane: apiLane } : { status },
          ),
        },
      )
      const data = await res.json()
      if (!res.ok) {
        setWarning(data.error || "Failed to update status")
        // Revert override on error
        delete localOverrides.current[order.order_id]
        setOrders((prev) =>
          prev.map((o) => (o.order_id === order.order_id ? { ...o, status: order.status } : o)),
        )
      }
    } catch (e: any) {
      setWarning(e?.message || "Failed to update status")
      delete localOverrides.current[order.order_id]
      setOrders((prev) =>
        prev.map((o) => (o.order_id === order.order_id ? { ...o, status: order.status } : o)),
      )
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col px-4 py-4">
      <header className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-semibold">Kitchen dashboard — {categoryLabel}</h1>
          <p className="text-xs text-slate-400">
            Live kiosk orders. Auto-refreshes every 5 s. Tap buttons to move orders through the workflow.
          </p>
        </div>
        <div className="text-xs text-slate-400 text-right space-y-1">
          {lastUpdated && <div>Last updated: {lastUpdated}</div>}
          {warning && (
            <div className="text-amber-300">
              {warning}
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 pt-4 grid gap-4 lg:grid-cols-4 md:grid-cols-2">
        {COLUMNS.map((col) => (
          <div
            key={col.id}
            className="rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col min-h-[200px]"
          >
            <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between">
              <span className="text-sm font-semibold">{col.title}</span>
              <span className="text-xs text-slate-400">
                {grouped[col.id]?.length ?? 0}
              </span>
            </div>
            <div className="flex-1 overflow-auto p-2 space-y-2">
              {(grouped[col.id] || []).map((o) => (
                <div
                  key={o.order_id}
                  className="rounded-xl bg-slate-950/80 border border-slate-700 px-3 py-2 space-y-1 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm">
                      #{o.order_number || o.order_id}
                    </span>
                    <span className="text-slate-400">
                      {o.table_number || o.customer_name || ""}
                    </span>
                  </div>
                  <div className="text-slate-400">
                    {(o.total_amount ?? 0).toLocaleString("en")} RWF
                  </div>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {col.id === "waiting" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-amber-400/60 text-amber-300"
                        onClick={() => updateStatus(o, "in_kitchen")}
                      >
                        Start preparing
                      </Button>
                    )}
                    {col.id === "in_kitchen" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-emerald-400/70 text-emerald-300"
                        onClick={() => updateStatus(o, "ready")}
                      >
                        Mark ready
                      </Button>
                    )}
                    {col.id === "ready" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-sky-400/70 text-sky-300"
                        onClick={() => updateStatus(o, "completed")}
                      >
                        Mark done
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </main>
    </div>
  )
}

