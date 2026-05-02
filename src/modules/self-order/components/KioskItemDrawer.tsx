"use client"

import { useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import type { KioskMenuItem } from "@/src/modules/self-order/types"
import { useCartStore } from "@/lib/cart-store"
import { generalSellingPrice, normalizeItemEmballageForCart } from "@/lib/package-price"
import { itemEmballageDisplaySuffix } from "@/lib/cart-display-utils"

interface KioskItemDrawerProps {
  item: KioskMenuItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function KioskItemDrawer({ item, open, onOpenChange }: KioskItemDrawerProps) {
  const [qty, setQty] = useState(1)
  const addItem = useCartStore((s) => s.addItem)

  if (!item) return null

  const price = generalSellingPrice(Number(item.selling_price || 0), item.item_emballage)
  const itemEmballage = normalizeItemEmballageForCart(item.item_emballage)
  const displayUnitLabel = itemEmballageDisplaySuffix(
    item.item_emballage == null || String(item.item_emballage).trim() === ""
      ? "1"
      : String(item.item_emballage)
  )

  const handleAdd = () => {
    if (!item) return
    if (qty <= 0) return
    const baseId = item.item_code || item.item_commercial_name
    const cartLine = {
      id: baseId,
      name: item.item_commercial_name || item.item_name || "",
      price,
      unit: item.unit,
      image: item.image_url,
      itemCode: item.item_code,
      supplierId: item.supplier_account,
      supplierName: item.supplier_name,
      supplierLocation: item.supplier_location,
      qty: 0, // will be set by store
      ...(itemEmballage ? { itemEmballage } : {}),
    }
    addItem(cartLine, qty)
    setQty(1)
    onOpenChange(false)
  }

  const inc = () => setQty((q) => Math.min(q + 1, 99))
  const dec = () => setQty((q) => Math.max(q - 1, 1))

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[70vh] rounded-t-3xl border-t bg-slate-950 text-slate-50">
        <SheetHeader>
          <SheetTitle className="text-left text-xl">
            {item.item_commercial_name || item.item_name}
          </SheetTitle>
        </SheetHeader>
        <div className="flex flex-col md:flex-row gap-6 p-4">
          {item.image_url && (
            <div className="w-full md:w-64 h-40 md:h-48 rounded-2xl overflow-hidden bg-slate-900">
              { }
              <img
                src={item.image_url}
                alt={item.item_commercial_name || ""}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div className="flex-1 space-y-4">
            <div>
              <p className="text-lg font-semibold">
                {price.toLocaleString("en")} RWF
                {displayUnitLabel ? (
                  <span className="text-sm font-normal text-slate-300 ml-1">({displayUnitLabel})</span>
                ) : null}
              </p>
              {item.keywords && (
                <p className="text-sm text-slate-400 mt-1 line-clamp-2">
                  {item.keywords}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Quantity</span>
                <div className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900/80">
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    className="rounded-full"
                    onClick={dec}
                  >
                    −
                  </Button>
                  <span className="w-10 text-center text-lg font-semibold tabular-nums">
                    {qty}
                  </span>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    className="rounded-full"
                    onClick={inc}
                  >
                    +
                  </Button>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <Button
                type="button"
                className="w-full h-12 text-lg font-semibold bg-emerald-500 hover:bg-emerald-400 text-emerald-950"
                onClick={handleAdd}
              >
                Add {qty} to cart •{" "}
                {(price * qty).toLocaleString("en")} RWF
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

