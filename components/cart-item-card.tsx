"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useCartStore, CartItem } from "@/lib/cart-store"
import { Minus, Plus, Trash2 } from "lucide-react"
import { getProductImageCandidates, isValidImageUrl, NO_IMAGE_URL } from "@/lib/image-utils"
import { DEFAULT_CART_CURRENCY, displayUnitForPrice } from "@/lib/cart-display-utils"

const PLACEHOLDER = "/placeholder.svg?height=64&width=64"

export function CartItemCard({ item }: { item: CartItem }) {
  const inc = useCartStore((s) => s.inc)
  const dec = useCartStore((s) => s.dec)
  const setQty = useCartStore((s) => s.setQty)
  const remove = useCartStore((s) => s.remove)
  const [inputValue, setInputValue] = useState(String(item.qty))

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

  // Sync input value when quantity changes externally
  useEffect(() => {
    setInputValue(String(item.qty))
  }, [item.qty])

  const unitLabel = displayUnitForPrice(item.unit ?? item.selectedUnit)

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5 sm:gap-4 rounded-lg border p-2.5 sm:p-3">
      <div className="flex items-center gap-3 flex-1 w-full sm:w-auto">
        <div className="relative h-[64px] w-[64px] sm:h-[72px] sm:w-[72px] flex-shrink-0 rounded bg-muted overflow-hidden">
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
          <div className="font-medium text-sm sm:text-base truncate">{item.name}</div>
          <div className="text-[11px] sm:text-xs text-muted-foreground truncate">
            {item.supplierName}
            {item.supplierLocation ? ` · ${item.supplierLocation}` : ""}
          </div>
          <div className="text-xs sm:text-sm mt-1">
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

      <div className="w-full sm:w-auto flex flex-col gap-2 sm:gap-3">
        <div className="flex w-full items-center justify-center sm:justify-start gap-1.5 sm:gap-2">
          <Button
            size="icon"
            variant="outline"
            onClick={() => {
              dec(item.id, item.selectedUnit)
              setInputValue(String(Math.max(1, item.qty - 1)))
            }}
            aria-label="Decrease"
            className="h-7 w-7 sm:h-8 sm:w-8"
          >
            <Minus className="h-4 w-4" />
          </Button>
          <Input
            type="number"
            min={1}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onBlur={() => {
              const newQty = parseInt(inputValue, 10)
              if (!isNaN(newQty) && newQty >= 1) {
                setQty(item.id, item.selectedUnit, newQty)
              } else {
                setInputValue(String(item.qty))
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const newQty = parseInt(inputValue, 10)
                if (!isNaN(newQty) && newQty >= 1) {
                  setQty(item.id, item.selectedUnit, newQty)
                }
                e.currentTarget.blur()
              }
            }}
            className="h-7 sm:h-8 w-12 sm:w-16 text-center font-medium px-1"
          />
          <Button
            size="icon"
            variant="outline"
            onClick={() => {
              inc(item.id, item.selectedUnit)
              setInputValue(String(item.qty + 1))
            }}
            aria-label="Increase"
            className="h-7 w-7 sm:h-8 sm:w-8"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2 pt-1">
          <div className="min-w-0 text-right font-semibold text-xs sm:text-sm whitespace-nowrap">
            {Number(item.price) > 0
              ? `${(Number(item.price) * item.qty).toLocaleString()} ${DEFAULT_CART_CURRENCY}`
              : "N/A"}
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
