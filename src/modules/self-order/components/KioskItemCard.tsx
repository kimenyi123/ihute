"use client"

import type { KioskMenuItem } from "@/src/modules/self-order/types"
import { Button } from "@/components/ui/button"

interface Props {
  item: KioskMenuItem
  onSelect: (item: KioskMenuItem) => void
}

export function KioskItemCard({ item, onSelect }: Props) {
  const price = Number(item.selling_price || 0)
  const mainBadge =
    typeof item.search_priority === "number" && item.search_priority >= 2
  const contains = item.contains_ingredient

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className="group flex flex-col rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden shadow-sm hover:border-emerald-400/70 hover:shadow-emerald-500/30 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
    >
      <div className="relative h-32 w-full bg-slate-800 overflow-hidden">
        {item.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.image_url}
            alt={item.item_commercial_name || ""}
            className="h-full w-full object-cover group-hover:scale-105 transition-transform"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-slate-500 text-xs">
            No image
          </div>
        )}
        {mainBadge && (
          <span className="absolute top-2 left-2 rounded-full bg-emerald-500/90 text-emerald-950 text-[11px] font-semibold px-2 py-0.5">
            Main ingredient
          </span>
        )}
        {!mainBadge && contains && (
          <span className="absolute top-2 left-2 rounded-full bg-slate-900/80 text-[11px] text-emerald-300 font-medium px-2 py-0.5 border border-emerald-400/60">
            Contains {contains}
          </span>
        )}
      </div>
      <div className="flex-1 flex flex-col p-3 gap-1">
        <div className="text-sm font-semibold text-slate-50 line-clamp-2">
          {item.item_commercial_name || item.item_name}
        </div>
        <div className="text-xs text-slate-400 line-clamp-1">
          {item.supplier_name}
        </div>
        <div className="mt-1 flex items-center justify-between">
          <div className="text-sm font-semibold text-emerald-300">
            {price.toLocaleString("en")} RWF{" "}
            <span className="text-xs text-slate-400 ml-1">{item.unit}</span>
          </div>
          <Button
            type="button"
            size="icon-sm"
            className="rounded-full bg-emerald-500 hover:bg-emerald-400 text-emerald-950"
          >
            +
          </Button>
        </div>
      </div>
    </button>
  )
}

