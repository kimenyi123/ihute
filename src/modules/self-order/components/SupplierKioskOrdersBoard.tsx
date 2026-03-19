"use client"

import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react"
import type { KioskCategory, KioskLiveOrder, KioskOrderStatus } from "@/src/modules/self-order/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type Props = {
  sellerAccount: string
  kioskCategory: KioskCategory
}

const STATUS_META: Array<{ status: KioskOrderStatus; label: string }> = [
  { status: "waiting", label: "Pending" },
  { status: "in_kitchen", label: "Preparing" },
  { status: "ready", label: "Ready" },
  { status: "completed", label: "Completed" },
]

// Enforce one-way progression: Pending → Preparing → Ready → Completed
const STATUS_ORDER: KioskOrderStatus[] = ["waiting", "in_kitchen", "ready", "completed", "cancelled"]
const STATUS_RANK: Record<KioskOrderStatus, number> = STATUS_ORDER.reduce(
  (acc, s, idx) => {
    acc[s] = idx
    return acc
  },
  {} as Record<KioskOrderStatus, number>,
)

function formatGuestLabel(name?: string) {
  const n = (name ?? "").trim()
  if (!n || n === "NA") return ""
  if (n.toLowerCase() === "kiosk guest") return "Guest"
  return n
}

function formatTableLabel(table?: string) {
  const t = (table ?? "").trim()
  if (!t || t === "NA" || t.toUpperCase() === "NA") return ""
  return t
}

function laneForCategory(cat: KioskCategory): "bar" | "kitchen" | null {
  if (cat === "BAR") return "bar"
  if (cat === "RESTRO") return "kitchen"
  return null
}

function mergeOrdersWithLocalOverrides(
  incoming: KioskLiveOrder[],
  overrides: MutableRefObject<Record<string, KioskOrderStatus>>,
): KioskLiveOrder[] {
  return incoming.map((o) => {
    const override = overrides.current[o.order_id]
    if (!override) return o
    const serverRank = STATUS_RANK[o.status] ?? -1
    const localRank = STATUS_RANK[override] ?? -1
    // Server caught up or passed us — trust DB
    if (serverRank >= localRank) {
      delete overrides.current[o.order_id]
      return o
    }
    // Poll returned an older state (replication lag, aggregate ORDER_STATUS vs lane JSON, etc.)
    return { ...o, status: override }
  })
}

export function SupplierKioskOrdersBoard({ sellerAccount, kioskCategory }: Props) {
  const [orders, setOrders] = useState<KioskLiveOrder[]>([])
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  /** Keeps UI stable: polling won't snap status backward right after a successful update */
  const localStatusOverrides = useRef<Record<string, KioskOrderStatus>>({})

  const apiLane = laneForCategory(kioskCategory)
  const SPEAK_AFTER_MINUTES = 15
  const speakAfterMs = SPEAK_AFTER_MINUTES * 60 * 1000

  useEffect(() => {
    let cancelled = false

    const poll = async () => {
      try {
        const url = new URL("/api/kiosk/orders", window.location.origin)
        url.searchParams.set("sellerAccount", sellerAccount)
        if (apiLane) {
          url.searchParams.set("lane", apiLane)
        } else {
          url.searchParams.set("kioskCategory", kioskCategory)
        }

        const res = await fetch(url.toString(), { cache: "no-store" })
        const data = await res.json().catch(() => ({}))
        if (cancelled) return

        if (!res.ok) {
          const backendText = typeof data.backendText === "string" ? data.backendText.trim() : ""
          console.error("[SupplierKioskOrdersBoard] /api/kiosk/orders failed", {
            url: url.toString(),
            status: res.status,
            error: data.error,
            backendStatus: data.backendStatus,
            backendUrl: data.backendUrl,
            backendText: backendText ? backendText.slice(0, 300) : "",
          })

          // Keep warning responsive: backend HTML/debug can be huge.
          const safeBackendText = backendText ? backendText.slice(0, 1000) : ""
          setWarning(
            safeBackendText
              ? `${data.error || "Failed to load orders"} — ${safeBackendText}`
              : data.error || "Failed to load orders",
          )
          return
        }

        const raw = Array.isArray(data.orders) ? data.orders : []
        // Backend kiosk list is category/location-focused; filter on sellerAccount client-side
        // so suppliers only see orders that include products from their own seller account.
        const filtered = raw.filter((o: any) =>
          Array.isArray(o?.items) ? o.items.some((it: any) => String(it?.seller_account ?? "").trim() === sellerAccount.trim()) : false,
        ) as KioskLiveOrder[]
        setOrders(mergeOrdersWithLocalOverrides(filtered, localStatusOverrides))
        setLastUpdated(new Date().toLocaleTimeString())
        setWarning(null)
      } catch (e: any) {
        if (cancelled) return
        setWarning(e?.message || "Failed to load orders")
      }
    }

    poll()
    const interval = window.setInterval(poll, 5000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [sellerAccount, kioskCategory, apiLane])

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

  const updateStatus = async (order: KioskLiveOrder, next: KioskOrderStatus) => {
    const prev = order.status
    if (prev === next) return

    // Block moving backwards in the workflow (e.g. Ready → Preparing).
    const prevRank = STATUS_RANK[prev]
    const nextRank = STATUS_RANK[next]
    if (nextRank < prevRank && next !== "cancelled") {
      const fromLabel = STATUS_META.find((s) => s.status === prev)?.label || prev
      const toLabel = STATUS_META.find((s) => s.status === next)?.label || next
      setWarning(`You can't move an order from ${fromLabel} back to ${toLabel}.`)
      return
    }

    localStatusOverrides.current[order.order_id] = next
    setOrders((curr) => curr.map((o) => (o.order_id === order.order_id ? { ...o, status: next } : o)))

    try {
      const res = await fetch(
        `/api/kiosk/orders/${encodeURIComponent(order.order_id)}/status`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            apiLane ? { status: next, lane: apiLane } : { status: next },
          ),
        },
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Failed to update status")
    } catch (e: any) {
      delete localStatusOverrides.current[order.order_id]
      setOrders((curr) => curr.map((o) => (o.order_id === order.order_id ? { ...o, status: prev } : o)))
      setWarning(e?.message || "Failed to update status")
    }
  }

  const speakOrderAgain = async (order: KioskLiveOrder) => {
    try {
      setWarning(null)
      // Trigger speak again for any open customer status pages.
      const res = await fetch(
        `/api/kiosk/orders/${encodeURIComponent(order.order_id)}/speak`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((data as { error?: string }).error || "Failed to request speak")

      // Also speak locally on the operator browser (best-effort).
      const guest = formatGuestLabel(order.customer_name)
      const table = formatTableLabel(order.table_number)
      const orderNum = order.order_number || order.order_id
      const parts: string[] = []
      if (guest) parts.push(`Order for ${guest}.`)
      parts.push(`Order ${orderNum}.`)
      if (table) parts.push(`Table ${table}.`)
      parts.push("Pick up now.")
      const text = parts.join(" ")

      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        const utterance = new SpeechSynthesisUtterance(text)
        utterance.lang = "en-US"
        window.speechSynthesis.cancel()
        window.speechSynthesis.speak(utterance)
      }
    } catch (e: any) {
      setWarning(e?.message || "Failed to speak order")
    }
  }

  const refetchOrders = () => {
    const url = new URL("/api/kiosk/orders", window.location.origin)
    url.searchParams.set("sellerAccount", sellerAccount)
    if (apiLane) {
      url.searchParams.set("lane", apiLane)
    } else {
      url.searchParams.set("kioskCategory", kioskCategory)
    }
    fetch(url.toString(), { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        const raw = Array.isArray(data.orders) ? data.orders : []
        const filtered = raw.filter((o: any) =>
          Array.isArray(o?.items)
            ? o.items.some((it: any) => String(it?.seller_account ?? "").trim() === sellerAccount.trim())
            : false,
        ) as KioskLiveOrder[]
        setOrders(mergeOrdersWithLocalOverrides(filtered, localStatusOverrides))
      })
      .catch(() => {})
  }

  const markPickupDone = async (order: KioskLiveOrder) => {
    if (order.status !== "completed") return
    setWarning(null)
    delete localStatusOverrides.current[order.order_id]
    setOrders((curr) => curr.filter((o) => o.order_id !== order.order_id))
    try {
      const res = await fetch(
        `/api/kiosk/orders/${encodeURIComponent(order.order_id)}/pickup-done`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(apiLane ? { lane: apiLane } : {}),
        },
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((data as { error?: string }).error || "Failed to mark done")
    } catch (e: unknown) {
      setWarning(e instanceof Error ? e.message : "Failed to mark done")
      refetchOrders()
    }
  }

  return (
      <Card className="bg-white shadow-md mb-8 min-w-0">
      <CardHeader className="border-b bg-slate-50">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Live kiosk orders
        </p>
        <CardTitle className="text-lg">
          Kiosk Order Status — {kioskCategory === "BAR" ? "Bar" : kioskCategory === "RESTRO" ? "Kitchen" : kioskCategory}
        </CardTitle>
        <p className="text-xs text-slate-500 mt-1">
          Pending → Preparing → Ready → <strong>Completed</strong> (shows on customer display as &quot;Pick up&quot;).
          Then tap <strong>Done</strong> when the customer has collected this side&apos;s items. Mixed drink+food orders
          share one order number: Bar and Kitchen each track their own steps; the customer app follows the slower side
          until both parts are picked up.
        </p>
      </CardHeader>
      <CardContent className="p-4 min-w-0">
        {warning && (
          <div className="text-xs text-red-600 mb-3 break-words whitespace-pre-wrap max-h-28 overflow-auto">
            {warning}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-4">
          {STATUS_META.map((m) => {
            const count = grouped[m.status]?.length ?? 0
            return (
              <div
                key={m.status}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 flex items-center justify-between"
              >
                <div className="text-xs text-slate-600 font-medium">{m.label}</div>
                <div className="text-2xl font-bold text-slate-900">{count}</div>
              </div>
            )
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 min-w-0">
          {STATUS_META.map((col) => {
            const list = grouped[col.status] ?? []
            return (
              <div key={col.status} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-semibold text-slate-900">{col.label}</div>
                  <div className="text-xs text-slate-500">{list.length}</div>
                </div>

                <div className="space-y-2 max-h-[60vh] overflow-auto pr-1 min-w-0">
                  {list.length === 0 && (
                    <div className="text-xs text-slate-400 pt-2 text-center">No orders</div>
                  )}

                  {list.map((o) => {
                    const guest = formatGuestLabel(o.customer_name)
                    const table = formatTableLabel(o.table_number)
                    const createdAtMs = o.created_at ? new Date(o.created_at).getTime() : NaN
                    const ageMs = Number.isFinite(createdAtMs) ? Date.now() - createdAtMs : speakAfterMs + 1
                    const speakEligible = o.status === "completed" && ageMs > speakAfterMs
                    const speakInMin =
                      o.status === "completed" && Number.isFinite(createdAtMs)
                        ? Math.max(1, Math.ceil((speakAfterMs - ageMs) / 60000))
                        : 0
                    return (
                      <div
                        key={`${o.order_id}-${o.lane ?? apiLane ?? kioskCategory}`}
                        className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-xs text-slate-500">Order</div>
                            <div className="text-sm font-bold text-slate-900 truncate">
                              #{o.order_number || o.order_id}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-slate-500">Total</div>
                            <div className="text-sm font-bold text-red-600">
                              {Math.round(o.total_amount || 0).toLocaleString("en")} RWF
                            </div>
                            {o.full_order_total != null &&
                              Math.round(o.full_order_total) !== Math.round(o.total_amount || 0) && (
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  Full order {Math.round(o.full_order_total).toLocaleString("en")} RWF
                                </div>
                              )}
                          </div>
                        </div>

                        {(guest || table) && (
                          <div className="mt-2 text-[11px] text-slate-500 space-y-0.5">
                            {guest && (
                              <p className="truncate">
                                <span className="text-slate-400">Name:</span>{" "}
                                <span className="font-semibold text-slate-800">{guest}</span>
                              </p>
                            )}
                            {table && (
                              <p className="truncate">
                                <span className="text-slate-400">Table:</span>{" "}
                                <span className="font-semibold text-slate-800">{table}</span>
                              </p>
                            )}
                          </div>
                        )}

                        {/* Show ALL items in order */}
                        {Array.isArray(o.items) && o.items.length > 0 && (
                          <div className="mt-2 space-y-0.5">
                            {o.items.map((it: any, idx: number) => (
                              <div key={idx} className="text-xs text-slate-600 truncate flex items-center gap-1">
                                <span className="text-slate-400">·</span>
                                {it.item_name || it.item_code || "Item"}
                                {it.quantity && it.quantity > 1 && (
                                  <span className="text-slate-400">×{it.quantity}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {o.status === "completed" && (
                          <button
                            type="button"
                            onClick={() => speakOrderAgain(o)}
                            disabled={!speakEligible}
                            className={`w-full py-2 rounded-xl text-xs font-bold border transition ${
                              speakEligible
                                ? "bg-amber-600 border-amber-700 text-white hover:bg-amber-700"
                                : "bg-amber-50 border-amber-200 text-amber-900 disabled:opacity-60"
                            }`}
                          >
                            🔊 {speakEligible ? "Speak again (Pick up now)" : `Speak in ${speakInMin}m`}
                          </button>
                        )}

                        <div className="mt-3 space-y-2">
                          <div className="flex flex-wrap gap-2">
                            {STATUS_META.map((btn) => {
                              const active = o.status === btn.status
                              const currentRank = STATUS_RANK[o.status]
                              const targetRank = STATUS_RANK[btn.status]
                              const isBackward = targetRank < currentRank && btn.status !== "cancelled"
                              return (
                                <button
                                  key={btn.status}
                                  type="button"
                                  onClick={() => updateStatus(o, btn.status)}
                                  disabled={active || isBackward}
                                  className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                                    active
                                      ? "border-red-500 bg-red-50 text-red-600"
                                      : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                                  } disabled:opacity-60`}
                                >
                                  {btn.label}
                                </button>
                              )
                            })}
                          </div>
                          {o.status === "completed" && (
                            <button
                              type="button"
                              onClick={() => markPickupDone(o)}
                              className="w-full mt-2 py-2 rounded-xl text-xs font-bold bg-slate-800 text-white hover:bg-slate-900 transition"
                            >
                              Done — customer picked up (remove from display)
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {lastUpdated && (
          <div className="text-xs text-slate-500 mt-3">
            Updated: {lastUpdated}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

