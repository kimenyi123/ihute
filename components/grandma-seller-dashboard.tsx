"use client"

import { ArrowUpRight, Sparkles, Trophy } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

type OpenStat = { count: number; amount: number }

export type GrandmaSellerInsightsCopy = {
  bestTitle: string
  bestSubtitle: string
  bestEmpty: string
  unitsSold: string
  lineRevenue: string
  /** Use {{pct}} and {{rwf}} */
  shareTemplate: string
  topUpTitle: string
  topUpSubtitle: string
  ctaStock: string
  /** Shop with Me — NIKI catalog / add stock flow */
  ctaNikiStock: string
  ctaOrders: string
  /** "{{n}}" = served count */
  deliveredTail: string
}

export type GrandmaSellerDashboardProps = {
  shopLabel: string
  openOrders: OpenStat
  /** Total orders loaded (denominator: open count / total orders). */
  totalOrders: number
  /** Sum of stock quantities from inventory API. */
  itemsStockUnits: number
  /** Inventory value (qty × sale price). */
  itemsStockValueRwf: number
  /** Served / completed orders count. */
  salesDeliveredCount: number
  /** Total RWF for served orders (e.g. delivery + goods). */
  salesDeliveredRwf: number
  /** #1 SKU from delivered orders (by units, then revenue). */
  bestSelling: {
    name: string
    unitsSold: number
    revenueRwf: number
    pctOfLineRevenue: number | null
  } | null
  /** Growth / restock bullets (localized in parent). */
  topUpBullets: string[]
  copy: GrandmaSellerInsightsCopy
  clientsCount?: number
  clientStars?: number
  onOrders: () => void
  onClients: () => void
  onItems: () => void
  /** Opens Shop with Me for the seller nickname (NIKI product source). */
  onNikiStock: () => void
  onSales: () => void
  formatRwf: (n: number) => string
}

export function GrandmaSellerDashboard({
  shopLabel,
  openOrders,
  totalOrders,
  itemsStockUnits,
  itemsStockValueRwf,
  salesDeliveredCount,
  salesDeliveredRwf,
  bestSelling,
  topUpBullets,
  copy,
  clientsCount = 0,
  clientStars = 0,
  onOrders,
  onClients,
  onItems,
  onNikiStock,
  onSales,
  formatRwf,
}: GrandmaSellerDashboardProps) {
  const denom = Math.max(1, totalOrders)
  const stars =
    clientStars > 0
      ? "★".repeat(Math.min(5, Math.max(0, clientStars))) + "☆".repeat(Math.max(0, 5 - clientStars))
      : "—"

  const shareLine =
    bestSelling &&
    copy.shareTemplate &&
    bestSelling.pctOfLineRevenue != null &&
    bestSelling.revenueRwf > 0
      ? copy.shareTemplate
          .replace("{{pct}}", String(bestSelling.pctOfLineRevenue))
          .replace("{{rwf}}", formatRwf(bestSelling.revenueRwf))
      : bestSelling && bestSelling.revenueRwf > 0
        ? `${copy.lineRevenue}: ${formatRwf(bestSelling.revenueRwf)}`
        : null

  return (
    <section className="seller-screen space-y-3 px-3 pb-6 pt-2">
      <div className="rounded-2xl border border-[#dbe7f3] bg-white px-4 py-3 shadow-sm">
        <div className="text-xs font-bold uppercase tracking-wide text-[#6f8399]">Shop</div>
        <div className="mt-1 text-lg font-extrabold text-[#17324d]">{shopLabel}</div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {/* Best selling — hero product */}
        <div
          className={cn(
            "relative overflow-hidden rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50 via-white to-orange-50/90 p-4 shadow-sm md:min-h-[200px]",
          )}
        >
          <div
            className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-amber-200/30 blur-2xl"
            aria-hidden
          />
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md shadow-amber-500/25">
              <Trophy className="h-5 w-5" strokeWidth={2.2} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-amber-900/70">
                {copy.bestTitle}
              </div>
              <div className="mt-0.5 text-[10px] font-semibold text-[#64748b]">{copy.bestSubtitle}</div>
            </div>
          </div>

          {bestSelling ? (
            <>
              <h3 className="mt-4 line-clamp-3 text-xl font-black leading-snug tracking-tight text-[#0f172a]">
                {bestSelling.name}
              </h3>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full border border-amber-200/90 bg-white/90 px-2.5 py-1 text-[11px] font-bold text-amber-950 shadow-sm">
                  {bestSelling.unitsSold.toLocaleString()}{" "}
                  <span className="ml-1 font-semibold opacity-85">{copy.unitsSold}</span>
                </span>
                {shareLine ? (
                  <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50/95 px-2.5 py-1 text-[11px] font-bold text-emerald-950">
                    {shareLine}
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                onClick={onSales}
                className="mt-4 inline-flex items-center gap-1 text-[12px] font-bold text-amber-900 hover:underline"
              >
                {copy.lineRevenue} · {copy.deliveredTail.replace("{{n}}", String(salesDeliveredCount))}
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
              </button>
            </>
          ) : (
            <p className="mt-4 text-sm font-medium leading-relaxed text-[#475569]">{copy.bestEmpty}</p>
          )}
        </div>

        {/* Top-up sale — growth & shop hygiene */}
        <div className="flex flex-col rounded-2xl border border-emerald-200/70 bg-gradient-to-b from-emerald-50/80 to-white p-4 shadow-sm md:min-h-[200px]">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-600/25">
              <Sparkles className="h-5 w-5" strokeWidth={2.2} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-emerald-900/75">
                {copy.topUpTitle}
              </div>
              <p className="mt-1 text-[12px] font-medium leading-snug text-[#475569]">{copy.topUpSubtitle}</p>
            </div>
          </div>

          <ul className="mt-3 flex flex-1 flex-col gap-2 border-t border-emerald-100/80 pt-3">
            {topUpBullets.slice(0, 4).map((line, i) => (
              <li key={i} className="flex gap-2 text-[13px] leading-snug text-[#0f172a]">
                <span
                  className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500 ring-4 ring-emerald-100"
                  aria-hidden
                />
                <span className="font-medium">{line}</span>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-9 border-emerald-200 bg-white text-emerald-900 hover:bg-emerald-50"
              onClick={onItems}
            >
              {copy.ctaStock}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-9 border-blue-200 bg-white text-blue-900 hover:bg-blue-50"
              onClick={onNikiStock}
            >
              {copy.ctaNikiStock}
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-9 bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={onOrders}
            >
              {copy.ctaOrders}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onOrders}
          className={cn(
            "flex flex-col rounded-2xl border-2 border-[#1897e0] bg-gradient-to-br from-[#f0f8ff] to-white p-4 text-left shadow-sm transition hover:shadow-md active:scale-[0.99]",
          )}
        >
          <span className="text-xs font-extrabold uppercase tracking-wide text-[#127fc0]">Orders</span>
          <span className="mt-2 text-sm font-bold text-[#17324d]">Open</span>
          <span className="text-lg font-black text-[#17324d]">
            {openOrders.count}/{denom}
          </span>
          <span className="mt-1 text-sm font-bold text-[#127fc0]">{formatRwf(openOrders.amount)}</span>
        </button>

        <button
          type="button"
          onClick={onClients}
          className="flex flex-col rounded-2xl border border-[#dbe7f3] bg-white p-4 text-left shadow-sm transition hover:bg-[#f7fbff] active:scale-[0.99]"
        >
          <span className="text-xs font-extrabold uppercase tracking-wide text-[#6f8399]">Clients</span>
          <span className="mt-3 text-2xl font-black text-[#17324d]">{clientsCount > 0 ? clientsCount : "—"}</span>
          <span className="mt-1 text-xs font-semibold text-[#f4b400]" aria-hidden>
            {stars}
          </span>
          <span className="mt-0.5 text-[10px] font-bold uppercase text-[#6f8399]">Ratings</span>
        </button>

        <button
          type="button"
          onClick={onItems}
          className="flex flex-col rounded-2xl border border-[#dbe7f3] bg-white p-4 text-left shadow-sm transition hover:bg-[#f7fbff] active:scale-[0.99]"
        >
          <span className="text-xs font-extrabold uppercase tracking-wide text-[#6f8399]">Items</span>
          <span className="mt-1 text-[10px] font-bold uppercase text-[#6f8399]">Stock units</span>
          <span className="mt-1 text-2xl font-black text-[#17324d]">{itemsStockUnits}</span>
          <span className="mt-1 text-sm font-bold text-[#127fc0]">{formatRwf(itemsStockValueRwf)}</span>
        </button>

        <button
          type="button"
          onClick={onSales}
          className="flex flex-col rounded-2xl border border-[#dbe7f3] bg-white p-4 text-left shadow-sm transition hover:bg-[#f7fbff] active:scale-[0.99]"
        >
          <span className="text-xs font-extrabold uppercase tracking-wide text-[#6f8399]">Sales</span>
          <span className="mt-1 text-[10px] font-bold uppercase text-[#6f8399]">Served orders</span>
          <span className="mt-1 text-2xl font-black text-[#17324d]">{salesDeliveredCount}</span>
          <span className="mt-1 text-sm font-bold text-[#127fc0]">{formatRwf(salesDeliveredRwf)}</span>
        </button>
      </div>

      <p className="px-1 text-center text-[11px] font-semibold text-[#6f8399]">
        Tap <span className="text-[#127fc0]">Orders</span> for the queue · figures use your live orders and stock
      </p>
    </section>
  )
}
