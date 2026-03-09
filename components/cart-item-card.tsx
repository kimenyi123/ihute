"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { useCartStore, CartItem } from "@/lib/cart-store"
import { Minus, Plus, Trash2 } from "lucide-react"
import { getProductImageSrc, isValidImageUrl } from "@/lib/image-utils"

const PLACEHOLDER = "/placeholder.svg?height=64&width=64"

export function CartItemCard({ item }: { item: CartItem }) {
  const inc = useCartStore((s) => s.inc)
  const dec = useCartStore((s) => s.dec)
  const remove = useCartStore((s) => s.remove)
  const [imgError, setImgError] = useState(false)

  const resolvedUrl = getProductImageSrc(item as Record<string, unknown>, PLACEHOLDER)
  const hasValidUrl = resolvedUrl !== PLACEHOLDER && isValidImageUrl(resolvedUrl)
  const src = !imgError && hasValidUrl ? resolvedUrl : PLACEHOLDER
  const isRemote = /^https?:\/\//i.test(src)

  useEffect(() => {
    setImgError(false)
  }, [resolvedUrl])

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 rounded-lg border p-3">
      <div className="flex items-center gap-3 flex-1 w-full sm:w-auto">
        <div className="relative h-16 w-16 flex-shrink-0 rounded bg-muted overflow-hidden">
          {isRemote ? (
            <img
              src={src}
              alt={item.name}
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
            />
          ) : (
            <Image
              fill
              src={src}
              alt={item.name}
              className="object-cover"
              onError={() => setImgError(true)}
              unoptimized={src === PLACEHOLDER}
            />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{item.name}</div>
          <div className="text-xs text-muted-foreground truncate">
            {item.supplierName}
            {item.supplierLocation ? ` · ${item.supplierLocation}` : ""}
          </div>
          <div className="text-sm mt-1">
            {item.price.toLocaleString()} {item.unit ? ` / ${item.unit}` : ""}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="outline"
            onClick={() => dec(item.id, item.selectedUnit)}
            aria-label="Decrease"
            className="h-8 w-8"
          >
            <Minus className="h-4 w-4" />
          </Button>
          <span className="w-8 text-center font-medium">{item.qty}</span>
          <Button
            size="icon"
            variant="outline"
            onClick={() => inc(item.id, item.selectedUnit)}
            aria-label="Increase"
            className="h-8 w-8"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-20 sm:w-24 text-right font-semibold">
            {(item.price * item.qty).toLocaleString()}
          </div>

          <Button
            size="icon"
            variant="ghost"
            onClick={() => remove(item.id, item.selectedUnit)}
            aria-label="Remove"
            className="h-8 w-8"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
