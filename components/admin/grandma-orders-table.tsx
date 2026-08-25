"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import type { GrandmaAdminOrder } from "@/lib/admin-grandma-orders"

type Tone = "dark" | "light"

function formatWhen(raw: string): string {
  if (!raw) return "—"
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  return d.toLocaleString()
}

function formatRwf(amount: number): string {
  return `${Math.round(amount).toLocaleString()} RWF`
}

export function GrandmaOrdersTable({ tone }: { tone: Tone }) {
  const [orders, setOrders] = useState<GrandmaAdminOrder[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  const dark = tone === "dark"
  const inputClass = dark
    ? "w-full max-w-md rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
    : "w-full max-w-md rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400"
  const bannerWarn = dark
    ? "rounded-lg border border-amber-900/60 bg-amber-950/40 px-4 py-3 text-sm text-amber-200"
    : "rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
  const bannerErr = dark
    ? "rounded-lg border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200"
    : "rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
  const wrap = dark
    ? "overflow-x-auto rounded-xl border border-zinc-800"
    : "overflow-x-auto rounded-xl border border-slate-200 bg-white"
  const thead = dark
    ? "border-b border-zinc-800 bg-zinc-900/80 text-zinc-400"
    : "border-b border-slate-200 bg-slate-50 text-slate-500"
  const cell = dark ? "px-3 py-3 text-zinc-300" : "px-3 py-3 text-slate-700"
  const muted = dark ? "text-zinc-500" : "text-slate-400"
  const rowHover = dark ? "hover:bg-zinc-900/40" : "hover:bg-slate-50"
  const divide = dark ? "divide-y divide-zinc-800" : "divide-y divide-slate-100"
  const linkClass = dark ? "font-medium text-sky-300 hover:underline" : "font-medium text-blue-600 hover:underline"

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch("/api/admin/grandma/orders", { cache: "no-store" })
        const j = (await res.json()) as {
          ok: boolean
          orders?: GrandmaAdminOrder[]
          message?: string
          error?: string
        }
        if (cancelled) return
        if (j.message) setMessage(j.message)
        if (j.error) setError(j.error)
        setOrders(Array.isArray(j.orders) ? j.orders : [])
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Load failed")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return orders
    return orders.filter((o) => {
      const hay = [
        o.id,
        o.orderNumber,
        o.sellerName,
        o.sellerAccount,
        o.buyerName,
        o.buyerPhone,
        o.status,
        o.paymentStatus,
        o.paymentName,
        o.paymentId,
        o.items,
        o.deliveryLocation,
      ]
        .join(" ")
        .toLowerCase()
      return hay.includes(q)
    })
  }, [orders, search])

  return (
    <div className="space-y-4">
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search order, buyer, seller, item…"
        className={inputClass}
        aria-label="Search Grandma orders"
      />

      {message ? <div className={bannerWarn}>{message}</div> : null}
      {error ? <div className={bannerErr}>{error}</div> : null}

      <div className={wrap}>
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead className={thead}>
            <tr>
              <th className="px-3 py-3 font-medium">Order</th>
              <th className="px-3 py-3 font-medium">Placed</th>
              <th className="px-3 py-3 font-medium">Buyer</th>
              <th className="px-3 py-3 font-medium">Seller</th>
              <th className="px-3 py-3 font-medium">Items</th>
              <th className="px-3 py-3 font-medium">Amount</th>
              <th className="px-3 py-3 font-medium">Payment</th>
              <th className="px-3 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className={divide}>
            {filtered.map((o) => (
              <tr key={o.id} className={rowHover}>
                <td className={cell}>
                  <Link href={`/admin/orders/${o.id}`} className={linkClass}>
                    #{o.id}
                  </Link>
                  {o.orderNumber ? <div className={`text-xs ${muted}`}>{o.orderNumber}</div> : null}
                </td>
                <td className={`${cell} whitespace-nowrap text-xs`}>{formatWhen(o.placedAt)}</td>
                <td className={`max-w-[160px] ${cell}`}>
                  <div className="truncate">{o.buyerName || "—"}</div>
                  <div className={`truncate text-xs ${muted}`}>{o.buyerPhone || "—"}</div>
                </td>
                <td className={`max-w-[180px] ${cell}`}>
                  <div className="truncate">{o.sellerName || "—"}</div>
                  <div className={`truncate font-mono text-xs ${muted}`}>{o.sellerAccount || "—"}</div>
                </td>
                <td className={`max-w-[220px] ${cell}`}>
                  <div className="line-clamp-2" title={o.items}>
                    {o.items || "—"}
                  </div>
                </td>
                <td className={`${cell} whitespace-nowrap tabular-nums`}>{formatRwf(o.amount)}</td>
                <td className={`max-w-[140px] ${cell}`}>
                  <div className="truncate">{o.paymentStatus || o.paymentName || "—"}</div>
                  {o.paymentId ? <div className={`truncate text-xs ${muted}`}>{o.paymentId}</div> : null}
                </td>
                <td className={cell}>{o.status || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading ? (
          <p className={`px-4 py-8 text-center text-sm ${muted}`}>Loading Grandma orders…</p>
        ) : null}
        {!loading && filtered.length === 0 && !message && !error ? (
          <p className={`px-4 py-8 text-center text-sm ${muted}`}>
            No Grandma orders found. Only rows with ORDER_SOURCE = GRANDMA are listed.
          </p>
        ) : null}
      </div>
      {!loading && orders.length > 0 ? (
        <p className={`text-xs ${muted}`}>
          Showing {filtered.length} of {orders.length} Grandma orders
        </p>
      ) : null}
    </div>
  )
}
