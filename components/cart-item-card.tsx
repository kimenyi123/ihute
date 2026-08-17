"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useCartStore, CartItem } from "@/lib/cart-store"
import { parseErxFromNotes, prescriptionLineKey } from "@/lib/erx-prescription"
import { Minus, Plus, Trash2 } from "lucide-react"
import { getProductImageCandidates, isValidImageUrl, NO_IMAGE_URL } from "@/lib/image-utils"
import { normalizeProductImagePublicUrl, resolvePublicAssetUrl } from "@/lib/public-asset-url"
import { DEFAULT_CART_CURRENCY, itemEmballageDisplaySuffix } from "@/lib/cart-display-utils"
import { sellerDisplayName } from "@/lib/seller-display-name"

const PLACEHOLDER = "/placeholder.svg?height=64&width=64"

export function CartItemCard({ item }: { item: CartItem }) {
  const inc = useCartStore((s) => s.inc)
  const dec = useCartStore((s) => s.dec)
  const setQty = useCartStore((s) => s.setQty)
  const remove = useCartStore((s) => s.remove)
  const [inputValue, setInputValue] = useState(String(item.qty))

  const imageCandidates = ((): string[] => {
    try {
      return getProductImageCandidates(item as any).map((url) => {
        if (url.includes("/uploads/products/") || url.includes("/api/images/products/")) {
          return normalizeProductImagePublicUrl(url)
        }
        return resolvePublicAssetUrl(url)
      })
    } catch {
      return [NO_IMAGE_URL]
    }
  })()

  const candidatesSignature = imageCandidates.join("\x1e")
  const [candidateIdx, setCandidateIdx] = useState(0)
  const resolvedUrl = imageCandidates[Math.min(candidateIdx, imageCandidates.length - 1)] ?? NO_IMAGE_URL
  const hasValidUrl = resolvedUrl !== PLACEHOLDER && isValidImageUrl(resolvedUrl)
  const src = hasValidUrl ? resolvedUrl : NO_IMAGE_URL
  const useNativeImg = /^https?:\/\//i.test(src) || src.startsWith("/api/")

  const erx = item.erx ?? parseErxFromNotes(item.notes ?? undefined)
  const lineSig = item.lineSignature ?? prescriptionLineKey({ erx: item.erx, notes: item.notes })
  const unitLabel = itemEmballageDisplaySuffix(item.itemEmballage ?? item.unit ?? item.selectedUnit)

  useEffect(() => {
    setCandidateIdx(0)
  }, [candidatesSignature, item.id, item.selectedUnit])

  // Sync input value when quantity changes externally
  useEffect(() => {
    setInputValue(String(item.qty))
  }, [item.qty])

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5 sm:gap-4 rounded-lg border p-2.5 sm:p-3">
      <div className="flex items-center gap-3 flex-1 w-full sm:w-auto">
        <div className="relative h-[64px] w-[64px] sm:h-[72px] sm:w-[72px] flex-shrink-0 rounded bg-muted overflow-hidden">
          {useNativeImg ? (
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
            {sellerDisplayName({
              supplierName: item.supplierName,
              supplierAccount: item.supplierId,
            })}
            {item.supplierLocation ? ` · ${item.supplierLocation}` : ""}
          </div>
          <div className="text-xs sm:text-sm mt-1">
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
            {Number(item.price) > 0 ? (
              <>
                <span className="font-medium">
                  {Number(item.price).toLocaleString()} {DEFAULT_CART_CURRENCY}
                </span>
                {unitLabel ? (
                  <span className="text-muted-foreground"> ({unitLabel})</span>
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
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
        <div className="flex items-center rounded-lg border bg-background shadow-sm overflow-hidden">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => dec(item.id, item.selectedUnit, lineSig)}
            aria-label="Decrease quantity"
            className="h-9 w-9 rounded-none border-r hover:bg-muted"
          >
            <Minus className="h-4 w-4" />
          </Button>
          <Input
            type="number"
            min={1}
            step={1}
            value={inputValue}
            onChange={(e) => {
              const raw = e.target.value
              setInputValue(raw)
              const parsed = Number.parseInt(raw, 10)
              if (Number.isFinite(parsed) && parsed >= 1) {
                setQty(item.id, parsed, item.selectedUnit, lineSig)
              }
            }}
            onFocus={(e) => e.currentTarget.select()}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return
              const parsed = Number.parseInt(inputValue, 10)
              const nextQty = Number.isFinite(parsed) ? parsed : item.qty
              setQty(item.id, nextQty, item.selectedUnit, lineSig)
              setInputValue(String(nextQty))
              e.currentTarget.blur()
            }}
            onBlur={(e) => {
              const parsed = Number.parseInt(e.target.value, 10)
              const nextQty = Number.isFinite(parsed) ? parsed : item.qty
              setQty(item.id, nextQty, item.selectedUnit, lineSig)
              setInputValue(String(nextQty))
            }}
            aria-label="Quantity"
            className="h-9 w-16 border-0 rounded-none text-center font-semibold shadow-none [appearance:textfield] focus-visible:ring-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => inc(item.id, item.selectedUnit, lineSig)}
            aria-label="Increase quantity"
            className="h-9 w-9 rounded-none border-l hover:bg-muted"
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
