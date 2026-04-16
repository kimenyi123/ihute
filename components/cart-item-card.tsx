"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useCartStore, CartItem } from "@/lib/cart-store"
import { Trash2 } from "lucide-react"
import { getProductImageCandidates, isValidImageUrl, NO_IMAGE_URL } from "@/lib/image-utils"
import { DEFAULT_CART_CURRENCY, displayUnitForPrice } from "@/lib/cart-display-utils"

const PLACEHOLDER = "/placeholder.svg?height=64&width=64"

export function CartItemCard({ item }: { item: CartItem }) {
  const setQty = useCartStore((s) => s.setQty)
  const remove = useCartStore((s) => s.remove)
  const [qtyText, setQtyText] = useState(String(item.qty))

  const imageCandidates = ((): string[] => {
    // Try same ordered fallback chain we use everywhere else:
    // KAOS famille/NIKI → flat NIKI → backend image fields → NO_IMAGE_URL
    try {
      return getProductImageCandidates(item as any)
    } catch {
      return [NO_IMAGE_URL]
    }
  })()

  const candidatesSignature = imageCandidates.join("\x1e")
  const [candidateIdx, setCandidateIdx] = useState(0)
  const resolvedUrl = imageCandidates[Math.min(candidateIdx, imageCandidates.length - 1)] ?? NO_IMAGE_URL
  const hasValidUrl = resolvedUrl !== PLACEHOLDER && isValidImageUrl(resolvedUrl)
  // When no image or load error, show KAOS "no image" graphic instead of grey placeholder
  const src = hasValidUrl ? resolvedUrl : NO_IMAGE_URL
  const isRemote = /^https?:\/\//i.test(src)

  useEffect(() => {
    setCandidateIdx(0)
  }, [candidatesSignature, item.id, item.selectedUnit])

  useEffect(() => {
    setQtyText(String(item.qty))
  }, [item.qty])

  const unitLabel = displayUnitForPrice(item.unit ?? item.selectedUnit)

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 rounded-lg border p-3">
      <div className="flex items-center gap-3 flex-1 w-full sm:w-auto">
        <div className="relative h-[72px] w-[72px] flex-shrink-0 rounded bg-muted overflow-hidden">
          {isRemote ? (
            <img
              key={src}
              src={src}
              alt={item.name}
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => {
                if (candidateIdx + 1 < imageCandidates.length) {
                  setCandidateIdx((i) => i + 1)
                } else {
                  setCandidateIdx(imageCandidates.length - 1)
                }
              }}
            />
          ) : (
            <Image
              fill
              key={src}
              src={src}
              alt={item.name}
              className="object-cover"
              onError={() => {
                if (candidateIdx + 1 < imageCandidates.length) {
                  setCandidateIdx((i) => i + 1)
                } else {
                  setCandidateIdx(imageCandidates.length - 1)
                }
              }}
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
          <div className="text-sm mt-1">
            {Number(item.price) > 0 ? (
              <>
                <span className="font-medium">
                  {Number(item.price).toLocaleString()} {DEFAULT_CART_CURRENCY}
                </span>
                {unitLabel ? (
                  <span className="text-muted-foreground"> · {unitLabel}</span>
                ) : null}
              </>
            ) : (
              "Price not available"
            )}
            {item.expiryLabel ? (
              <div className="text-xs text-amber-900/90 mt-1 font-medium">
                Expiry: {item.expiryLabel}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
        <div className="flex items-center gap-2">
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={qtyText}
            onChange={(e) => {
              const v = e.target.value
              setQtyText(v)
              const n = Number.parseInt(v, 10)
              if (Number.isFinite(n) && n >= 1) {
                setQty(item.id, item.selectedUnit, n)
              }
            }}
            onBlur={() => {
              const n = Number.parseInt(qtyText, 10)
              const clamped = Number.isFinite(n) && n >= 1 ? n : 1
              setQtyText(String(clamped))
              setQty(item.id, item.selectedUnit, clamped)
            }}
            aria-label="Quantity"
            className="h-8 w-20"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="w-24 sm:w-28 text-right font-semibold text-sm">
            {Number(item.price) > 0
              ? `${(Number(item.price) * item.qty).toLocaleString()} ${DEFAULT_CART_CURRENCY}`
              : "—"}
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
