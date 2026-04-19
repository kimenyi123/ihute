"use client"

import { cn } from "@/lib/utils"

type OpenStat = { count: number; amount: number }

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
  clientsCount?: number
  clientStars?: number
  onOrders: () => void
  onClients: () => void
  onItems: () => void
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
  clientsCount = 0,
  clientStars = 0,
  onOrders,
  onClients,
  onItems,
  onSales,
  formatRwf,
}: GrandmaSellerDashboardProps) {
  const denom = Math.max(1, totalOrders)
  const stars =
    clientStars > 0
      ? "★".repeat(Math.min(5, Math.max(0, clientStars))) + "☆".repeat(Math.max(0, 5 - clientStars))
      : "—"

  return (
    <section className="seller-screen space-y-3 px-3 pb-6 pt-2">
      <div className="rounded-2xl border border-[#dbe7f3] bg-white px-4 py-3 shadow-sm">
        <div className="text-xs font-bold uppercase tracking-wide text-[#6f8399]">Shop</div>
        <div className="mt-1 text-lg font-extrabold text-[#17324d]">{shopLabel}</div>
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
