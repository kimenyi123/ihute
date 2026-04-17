"use client"

import { useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useCartStore } from "@/lib/cart-store"
import { Trash2, ShoppingCart, ChevronLeft } from "lucide-react"

export function KioskCartPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const items = useCartStore((s) => s.items)
  const setQty = useCartStore((s) => s.setQty)
  const remove = useCartStore((s) => s.remove)

  const total = useMemo(
    () => Math.round(items.reduce((sum, line) => sum + line.price * line.qty, 0)),
    [items],
  )

  const kioskCategory = searchParams.get("kioskCategory") ?? ""
  const nickname = searchParams.get("nickname") ?? ""

  const backHref = (() => {
    const sp = new URLSearchParams()
    if (kioskCategory) sp.set("kioskCategory", kioskCategory)
    if (nickname) sp.set("nickname", nickname)
    return sp.toString() ? `/self-order/menu?${sp.toString()}` : "/self-order/menu"
  })()

  const checkoutHref = (() => {
    const sp = new URLSearchParams()
    if (kioskCategory) sp.set("kioskCategory", kioskCategory)
    if (nickname) sp.set("nickname", nickname)
    return sp.toString() ? `/self-order/checkout?${sp.toString()}` : "/self-order/checkout"
  })()

  const categoryEmoji = kioskCategory === "BAR" ? "🍺" : kioskCategory === "RESTRO" ? "🍽" : "🛒"
  const categoryLabel = kioskCategory === "BAR" ? "Bar" : kioskCategory === "RESTRO" ? "Kitchen" : "Order"

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-red-600 text-white shadow-md">
        <div className="flex items-center gap-3 px-4 py-3 max-w-3xl mx-auto">
          <button
            type="button"
            onClick={() => router.push(backHref)}
            className="p-1.5 rounded-full hover:bg-white/10 transition"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <span className="text-lg">{categoryEmoji}</span>
            <div>
              <p className="font-bold text-sm leading-tight">Review your order</p>
              <p className="text-white/70 text-xs">{categoryLabel} order</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1 text-sm font-semibold">
            <ShoppingCart className="w-4 h-4" />
            {items.reduce((s, i) => s + i.qty, 0)} items
          </div>
        </div>
      </header>

      {/* Items */}
      <main className="flex-1 px-4 py-4 max-w-3xl mx-auto w-full space-y-3">
        {items.length === 0 && (
          <div className="text-center text-gray-400 mt-20">
            <ShoppingCart className="w-12 h-12 mx-auto text-gray-200 mb-3" />
            <p className="text-sm">Your cart is empty.</p>
            <button
              type="button"
              onClick={() => router.push(backHref)}
              className="mt-4 text-red-600 text-sm font-semibold underline underline-offset-2"
            >
              Go back to menu
            </button>
          </div>
        )}

        {items.map((line) => (
          <div
            key={line.id + (line.selectedUnit ?? "")}
            className="flex items-center gap-3 rounded-2xl bg-white border border-gray-100 p-3 shadow-sm"
          >
            {/* Product image */}
            <div className="h-16 w-16 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
              {line.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={line.image}
                  alt={line.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-2xl text-gray-300">
                  {kioskCategory === "BAR" ? "🍺" : "🍽"}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold line-clamp-2 text-gray-900">{line.name}</p>
              {line.supplierName && (
                <p className="text-[11px] text-gray-400 mt-0.5 truncate">{line.supplierName}</p>
              )}
              <p className="mt-1 text-sm font-bold text-red-600">
                {(line.price * line.qty).toLocaleString("en")} RWF
              </p>
            </div>

            {/* Qty controls */}
            <div className="flex flex-col items-end gap-2">
              <input
                type="number"
                min={1}
                step={1}
                value={line.qty}
                onChange={(e) => {
                  const parsed = Number.parseInt(e.target.value, 10)
                  if (Number.isFinite(parsed)) setQty(line.id, parsed, line.selectedUnit)
                }}
                onBlur={(e) => {
                  const parsed = Number.parseInt(e.target.value, 10)
                  setQty(line.id, Number.isFinite(parsed) ? parsed : line.qty, line.selectedUnit)
                }}
                className="w-16 rounded-xl border-2 border-gray-200 bg-white px-2 py-1 text-center text-sm font-bold tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                aria-label="Quantity"
              />
              <button
                type="button"
                onClick={() => remove(line.id, line.selectedUnit)}
                className="text-[11px] text-gray-400 hover:text-red-500 flex items-center gap-0.5 transition"
              >
                <Trash2 className="w-3 h-3" />
                Remove
              </button>
            </div>
          </div>
        ))}
      </main>

      {/* Footer */}
      {items.length > 0 && (
        <div className="sticky bottom-0 bg-white border-t border-gray-100 shadow-lg px-4 py-4">
          <div className="max-w-3xl mx-auto space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">
                {items.length} item{items.length !== 1 ? "s" : ""}
              </span>
              <span className="text-lg font-bold text-gray-900">
                Total: <span className="text-red-600">{total.toLocaleString("en")} RWF</span>
              </span>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => router.push(backHref)}
                className="flex-shrink-0 px-4 py-3 rounded-xl border-2 border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
              >
                ← Menu
              </button>
              <button
                type="button"
                onClick={() => router.push(checkoutHref)}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl py-3 text-base transition shadow-lg flex items-center justify-center gap-2"
              >
                <ShoppingCart className="w-5 h-5" />
                Proceed to checkout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
