"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { useCartStore, CartItem } from "@/lib/cart-store"
import { parseErxFromNotes, prescriptionLineKey } from "@/lib/erx-prescription"
import { Minus, Plus, Trash2 } from "lucide-react"
import { getProductImageSrc, isValidImageUrl, NO_IMAGE_URL } from "@/lib/image-utils"

const PLACEHOLDER = "/placeholder.svg?height=64&width=64"

export function CartItemCard({ item }: { item: CartItem }) {
  const inc = useCartStore((s) => s.inc)
  const dec = useCartStore((s) => s.dec)
  const remove = useCartStore((s) => s.remove)
  const [imgError, setImgError] = useState(false)

  const resolvedUrl = getProductImageSrc(item as Record<string, unknown>, PLACEHOLDER)
  const hasValidUrl = resolvedUrl !== PLACEHOLDER && isValidImageUrl(resolvedUrl)
  // When no image or load error, show KAOS "no image" graphic instead of grey placeholder
  const src = !imgError && hasValidUrl ? resolvedUrl : NO_IMAGE_URL
  const isRemote = /^https?:\/\//i.test(src)

  const erx = item.erx ?? parseErxFromNotes(item.notes ?? undefined)
  const lineSig = item.lineSignature ?? prescriptionLineKey({ erx: item.erx, notes: item.notes })

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
              unoptimized={src === PLACEHOLDER || src === NO_IMAGE_URL}
            />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{item.name}</div>
          <div className="text-xs text-muted-foreground truncate">
            {item.supplierName}
            {item.supplierLocation ? ` · ${item.supplierLocation}` : ""}
          </div>
          {erx && (
            <div className="text-[11px] text-muted-foreground mt-1.5 space-y-0.5 border-l-2 border-primary/30 pl-2">
              <p className="font-medium text-foreground/80">Prescription</p>
              <p>Measurement: {erx.measurement}</p>
              <p>Every: {erx.every}</p>
              {erx.toBeTakenDays ? <p>Duration (days): {erx.toBeTakenDays}</p> : null}
              {erx.quantityOnce ? <p>Qty (once): {erx.quantityOnce}</p> : null}
              <p>Route: {erx.route}</p>
              <p>Refill: {erx.refill}</p>
              {erx.instructionNotes ? (
                <p className="line-clamp-3">Instructions: {erx.instructionNotes}</p>
              ) : null}
            </div>
          )}
          <div className="text-sm mt-1">
            {Number(item.price) > 0
              ? `${Number(item.price).toLocaleString()} ${item.unit ? ` / ${item.unit}` : "RWF"}`
              : "Price not available"}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="outline"
            onClick={() => dec(item.id, item.selectedUnit, lineSig)}
            aria-label="Decrease"
            className="h-8 w-8"
          >
            <Minus className="h-4 w-4" />
          </Button>
          <span className="w-8 text-center font-medium">{item.qty}</span>
          <Button
            size="icon"
            variant="outline"
            onClick={() => inc(item.id, item.selectedUnit, lineSig)}
            aria-label="Increase"
            className="h-8 w-8"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-20 sm:w-24 text-right font-semibold">
            {Number(item.price) > 0
              ? (Number(item.price) * item.qty).toLocaleString()
              : "—"}
          </div>

          <Button
            size="icon"
            variant="ghost"
            onClick={() => remove(item.id, item.selectedUnit, lineSig)}
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
