"use client"

import { useMemo } from "react"
import { useRouter } from "next/navigation"
import { useCartStore } from "@/lib/cart-store"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function KioskCartPanel({ open, onOpenChange }: Props) {
  const router = useRouter()
  const items = useCartStore((s) => s.items)
  const inc = useCartStore((s) => s.inc)
  const dec = useCartStore((s) => s.dec)
  const remove = useCartStore((s) => s.remove)
  const getTotalPrice = useCartStore((s) => s.getTotalPrice)

  const total = useMemo(() => Math.round(getTotalPrice()), [getTotalPrice])

  const handleReview = () => {
    onOpenChange(false)
    router.push("/self-order/cart")
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="bg-slate-950 text-slate-50">
        <SheetHeader>
          <SheetTitle className="text-left">Your order</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col h-full">
          <div className="flex-1 overflow-auto space-y-3 px-4 pb-4">
            {items.length === 0 && (
              <p className="text-sm text-slate-400 mt-4">
                Your cart is empty. Start by adding some items.
              </p>
            )}
            {items.map((line) => (
              <div
                key={line.id + (line.selectedUnit ?? "")}
                className="flex items-center gap-3 rounded-xl bg-slate-900/80 border border-slate-800 p-3"
              >
                <div className="flex-1">
                  <div className="text-sm font-semibold line-clamp-2">
                    {line.name}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {line.supplierName}
                  </div>
                  <div className="mt-1 text-xs text-slate-300">
                    {(line.price * line.qty).toLocaleString("en")} RWF
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900/80">
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      className="rounded-full"
                      onClick={() => dec(line.id, line.selectedUnit)}
                    >
                      −
                    </Button>
                    <span className="w-8 text-center text-sm font-semibold tabular-nums">
                      {line.qty}
                    </span>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      className="rounded-full"
                      onClick={() => inc(line.id, line.selectedUnit)}
                    >
                      +
                    </Button>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(line.id, line.selectedUnit)}
                    className="text-[11px] text-slate-400 hover:text-slate-200 transition"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-slate-800 p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-300">Items</span>
              <span className="font-semibold">{items.length}</span>
            </div>
            <div className="flex items-center justify-between text-base font-semibold">
              <span>Total</span>
              <span>{total.toLocaleString("en")} RWF</span>
            </div>
            <Button
              type="button"
              className="w-full mt-2 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-semibold"
              disabled={items.length === 0}
              onClick={handleReview}
            >
              Review order
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

