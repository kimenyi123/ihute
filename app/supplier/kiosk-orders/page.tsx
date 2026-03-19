"use client"

import type { MutableRefObject } from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import type { KioskCategory, KioskLiveOrder } from "@/src/modules/self-order/types"

const DRINK_KEYWORDS = [
  "beer", "bière", "primus", "heineken", "skol", "amstel", "guinness", "tusker",
  "savana", "smirnoff", "bavaria", "desperados", "leffe", "virunga", "exo", "corona", "serengete",
  "wine", "champagne", "whisky", "whiskey", "vodka", "tequila", "gin", "rum", "cognac", "brandy",
  "jager", "cocktail", "mojito", "soda", "cola", "sprite", "fanta", "redbull", "red bull", "energy",
  "juice", "jus", "smoothie", "water", "eau", "coffee", "café", "tea", "inyange", "umutobe",
]

function looksLikeDrink(name: string) {
  const n = name.toLowerCase()
  return DRINK_KEYWORDS.some((kw) => n.includes(kw))
}

function LiveClock() {
  const [t, setT] = useState("")
  const [d, setD] = useState("")
  useEffect(() => {
    const update = () => {
      const now = new Date()
      setT(now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }))
      setD(now.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }))
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="text-right hidden sm:block">
      <p className="text-xl font-mono font-bold text-white">{t}</p>
      <p className="text-xs text-slate-400">{d}</p>
    </div>
  )
}

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

function OrderCard({
  order,
  isNew,
  pickupHighlight,
}: {
  order: KioskLiveOrder
  isNew: boolean
  pickupHighlight: boolean
}) {
  const items = order.items ?? []
  const isDrinks = items.length > 0 && items.every((it) => looksLikeDrink(it.item_name ?? ""))
  const categoryEmoji = isDrinks ? "🍺" : "🍳"
  const isCompletedSupplier = order.status === "completed"
  const guest = formatGuestLabel(order.customer_name)
  const table = formatTableLabel(order.table_number)

  return (
    <div
      className={`rounded-xl border p-3 transition-all duration-500 ${
        pickupHighlight
          ? "border-emerald-500/60 bg-emerald-900/20"
          : "border-slate-700/60 bg-slate-800/50"
      } ${isNew ? "ring-2 ring-emerald-400/40 animate-pulse-once" : ""}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-lg font-black text-white">#{order.order_number || order.order_id}</span>
        <span
          className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${
            pickupHighlight
              ? "bg-emerald-500/20 text-emerald-300"
              : "bg-slate-700 text-slate-400"
          }`}
        >
          {pickupHighlight
            ? isCompletedSupplier
              ? "PICK UP NOW!"
              : "READY!"
            : isDrinks
              ? "BEING PREPARED"
              : "ORDER RECEIVED"}
        </span>
      </div>
      {(guest || table) && (
        <div className="mb-2 text-[11px] text-slate-400 space-y-0.5">
          {guest && (
            <p className="truncate">
              <span className="text-slate-500">Name:</span>{" "}
              <span className="font-semibold text-slate-200">{guest}</span>
            </p>
          )}
          {table && (
            <p className="truncate">
              <span className="text-slate-500">Table:</span>{" "}
              <span className="font-semibold text-slate-200">{table}</span>
            </p>
          )}
        </div>
      )}
      <div className="space-y-0.5">
        {items.slice(0, 4).map((it, i) => (
          <p key={i} className="text-xs text-slate-300 truncate">
            {categoryEmoji} {it.item_name || it.item_code || "Item"}
            {it.quantity && it.quantity > 1 ? ` ×${it.quantity}` : ""}
          </p>
        ))}
        {items.length > 4 && <p className="text-xs text-slate-500">+{items.length - 4} more</p>}
      </div>
    </div>
  )
}

function KioskCategorySection({
  account,
  category,
  sectionTitle,
  seenIds,
  autoHideMinutes,
}: {
  account: string
  category: KioskCategory
  sectionTitle: string
  seenIds: MutableRefObject<Set<string | number>>
  autoHideMinutes?: number
}) {
  const [orders, setOrders] = useState<KioskLiveOrder[]>([])
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [newIds, setNewIds] = useState<Set<string | number>>(new Set())
  const autoHideMs = (autoHideMinutes ?? 15) * 60 * 1000

  useEffect(() => {
    let cancelled = false
    const poll = async () => {
      try {
        const url = new URL("/api/kiosk/orders", window.location.origin)
        url.searchParams.set("sellerAccount", account)
        if (category === "BAR") url.searchParams.set("lane", "bar")
        else if (category === "RESTRO") url.searchParams.set("lane", "kitchen")
        else url.searchParams.set("kioskCategory", category)
        const res = await fetch(url.toString(), { cache: "no-store" })
        const data = await res.json().catch(() => ({}))
        const raw: KioskLiveOrder[] = Array.isArray(data.orders) ? data.orders : []
        const filtered = raw.filter((o: any) =>
          Array.isArray(o?.items)
            ? o.items.some((it: any) => String(it?.seller_account ?? "").trim() === account)
            : false,
        )
        if (cancelled) return

        const fresh = new Set<string | number>()
        for (const o of filtered) {
          const id = o.order_id
          if (!seenIds.current.has(id)) {
            fresh.add(id)
            seenIds.current.add(id)
          }
        }
        if (fresh.size > 0) {
          setNewIds(fresh)
          setTimeout(() => setNewIds(new Set()), 4000)
        }

        setOrders(filtered)
        setLastUpdated(new Date().toLocaleTimeString())
      } catch {
        /* silent */
      }
    }
    poll()
    const id = setInterval(poll, 5000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [account, category, seenIds])

  const { waiting, inKitchen, pickup } = useMemo(() => {
    const w: KioskLiveOrder[] = []
    const k: KioskLiveOrder[] = []
    const p: KioskLiveOrder[] = []
    const now = Date.now()
    for (const o of orders) {
      if (o.status === "cancelled") continue
      if (o.status === "waiting") w.push(o)
      else if (o.status === "in_kitchen") k.push(o)
      else if (o.status === "ready" || o.status === "completed") {
        // Hide long-running pickup orders from the TV screen (no DB delete).
        const createdAtMs = o.created_at ? new Date(o.created_at).getTime() : NaN
        const tooOld = Number.isFinite(createdAtMs) ? now - createdAtMs > autoHideMs : false
        if (!tooOld) p.push(o)
      }
    }
    return { waiting: w, inKitchen: k, pickup: p }
  }, [orders])

  const nowServing =
    pickup.length > 0 ? Math.max(...pickup.map((o) => Number(o.order_number || o.order_id) || 0)) : null

  const cols = [
    {
      key: "waiting",
      list: waiting,
      label: "Pending",
      sub: "Waiting",
      color: "border-amber-700/60 bg-amber-950/30",
      badge: "bg-amber-500",
    },
    {
      key: "kitchen",
      list: inKitchen,
      label: "Preparing",
      sub: "In Kitchen",
      color: "border-blue-700/60 bg-blue-950/30",
      badge: "bg-blue-500",
    },
    {
      key: "pickup",
      list: pickup,
      label: "Ready",
      sub: "Pick Up Now!",
      color: "border-emerald-700/60 bg-emerald-950/30",
      badge: "bg-emerald-500",
    },
  ] as const

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden mb-8">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-800 bg-slate-900">
        <div>
          <p className="text-[9px] uppercase tracking-[0.25em] text-slate-500">Live kiosk orders</p>
          <h2 className="text-lg font-bold text-white">{sectionTitle}</h2>
          <p className="text-xs text-slate-500">
            Ready/Completed orders appear here until staff taps <strong>Done</strong> on Self Ordering.
            Pickup orders older than <strong>{autoHideMinutes ?? 15}</strong> minutes are hidden from the TV screen (no DB delete).
          </p>
        </div>
        {nowServing !== null && (
          <div className="flex flex-col items-center sm:items-end">
            <p className="text-[9px] uppercase tracking-[0.3em] text-slate-400">Now Serving</p>
            <div className="mt-0.5 px-4 py-1 rounded-full bg-emerald-500 text-slate-950 text-sm font-black">
              #{nowServing}
            </div>
          </div>
        )}
        {lastUpdated && <p className="text-xs text-slate-500 w-full sm:w-auto">Updated: {lastUpdated}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 min-h-0">
        {cols.map((col) => (
          <div key={col.key} className={`rounded-2xl border ${col.color} flex flex-col min-h-0 min-h-[200px]`}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
              <div>
                <p className="text-[9px] uppercase tracking-[0.3em] text-slate-500">{col.label}</p>
                <p className="text-base font-bold text-white">{col.sub}</p>
              </div>
              <div
                className={`w-7 h-7 rounded-full ${col.badge} flex items-center justify-center text-xs font-black text-white`}
              >
                {col.list.length}
              </div>
            </div>
            <div className="flex-1 overflow-auto p-3 space-y-2 max-h-[50vh]">
              {col.list.length === 0 && (
                <p className="text-xs text-slate-600 text-center pt-6">No orders</p>
              )}
              {col.list.map((o) => (
                <OrderCard
                  key={`${category}-${o.order_id}`}
                  order={o}
                  isNew={newIds.has(o.order_id)}
                  pickupHighlight={col.key === "pickup"}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export default function SupplierKioskOrdersPage() {
  const searchParams = useSearchParams()
  const account = (searchParams.get("account") ?? "").trim()
  const kioskCategoryParam = (searchParams.get("kioskCategory") ?? "").trim()
  const autoHideMinutes = Number(searchParams.get("autoHideMinutes") ?? 15)

  const categories: KioskCategory[] = useMemo(() => {
    const v = kioskCategoryParam.toUpperCase()
    if (v === "BAR") return ["BAR"]
    if (v === "RESTRO") return ["RESTRO"]
    if (v === "COFFEE_SHOP") return ["COFFEE_SHOP"]
    return ["BAR", "RESTRO"]
  }, [kioskCategoryParam])

  const [sellerName, setSellerName] = useState("")
  const seenIds = useRef<Set<string | number>>(new Set())

  useEffect(() => {
    if (!account) return
    fetch(`/api/supplier/profile?account=${encodeURIComponent(account)}`)
      .then((r) => r.json())
      .then((d) =>
        setSellerName((d?.businessName || d?.ownerName || d?.owner || d?.firstName || "").trim()),
      )
      .catch(() => {})
  }, [account])

  if (!account) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-red-400 text-sm">Missing `account` query param.</p>
      </div>
    )
  }

  const showBar = categories.includes("BAR")
  const showKitchen = categories.includes("RESTRO")

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="relative bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-2 h-2 rounded-full bg-red-500 text-[0px]">.</div>
          <div>
            <p className="text-[9px] uppercase tracking-[0.3em] text-slate-500">Quick Order Kiosk</p>
            <p className="text-base font-bold text-white">Order Status Board</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <p className="text-sm text-slate-400 hidden md:block font-medium">{sellerName || account}</p>
          <LiveClock />
        </div>
      </header>

      <main className="flex-1 flex flex-col p-4 md:p-6 max-w-[1600px] mx-auto w-full">
        {showBar && (
          <KioskCategorySection
            account={account}
            category="BAR"
            sectionTitle="Kiosk Order Status — Bar"
            seenIds={seenIds}
            autoHideMinutes={autoHideMinutes}
          />
        )}
        {showKitchen && (
          <KioskCategorySection
            account={account}
            category="RESTRO"
            sectionTitle="Kiosk Order Status — Kitchen"
            seenIds={seenIds}
            autoHideMinutes={autoHideMinutes}
          />
        )}
        {!showBar && !showKitchen && categories[0] && (
          <KioskCategorySection
            account={account}
            category={categories[0]}
            sectionTitle={`Kiosk Order Status — ${categories[0]}`}
            seenIds={seenIds}
            autoHideMinutes={autoHideMinutes}
          />
        )}
      </main>

      <footer className="bg-slate-900 border-t border-slate-800 px-6 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Live · Updates automatically
        </div>
        <p className="text-xs text-slate-400 font-medium">
          Pick up when your number is under <span className="text-emerald-400 font-bold">Pick Up Now!</span>
        </p>
      </footer>
    </div>
  )
}
