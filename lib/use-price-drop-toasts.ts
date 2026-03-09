"use client"

import { useEffect } from "react"
import { usePriceWatchStore } from "@/lib/price-watch-store"
import { useToast } from "@/components/ui/use-toast"

export type PriceCheckItem = {
  productId: string
  supplierId: string
  currentPrice: number
  name?: string
}

/**
 * Checks each item's current price against the price-watch list and shows a toast
 * when a watched item's price has dropped. Only notifies once per product per session
 * (shared with store so cart and quick view don't double-toast).
 */
export function usePriceDropToasts(items: PriceCheckItem[]) {
  const checkPriceDrop = usePriceWatchStore((s) => s.checkPriceDrop)
  const wasPriceDropNotified = usePriceWatchStore((s) => s.wasPriceDropNotified)
  const markPriceDropNotified = usePriceWatchStore((s) => s.markPriceDropNotified)
  const { toast } = useToast()

  const itemsKey = items
    .map((i) => `${i.productId}|${i.supplierId}|${i.currentPrice}`)
    .sort()
    .join(";")

  useEffect(() => {
    if (items.length === 0) return

    for (const item of items) {
      if (wasPriceDropNotified(item.productId, item.supplierId)) continue

      const dropped = checkPriceDrop(item.productId, item.supplierId, item.currentPrice)
      if (!dropped) continue

      markPriceDropNotified(item.productId, item.supplierId)
      const displayName = item.name ?? dropped.name
      toast({
        title: "Price drop",
        description: `${displayName} is now ${item.currentPrice.toLocaleString()} RWF (was ${dropped.priceWhenWatched.toLocaleString()} when you watched).`,
        duration: 6000,
      })
    }
  }, [itemsKey, items, checkPriceDrop, wasPriceDropNotified, markPriceDropNotified, toast])
}
