"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ShoppingCart } from "lucide-react"
import Image from "next/image"
import { useMemo, useState, useEffect } from "react"
import { usePriceDropToasts } from "@/lib/use-price-drop-toasts"
import {
  getProductImageCandidates,
  getProductImageSrc,
  type ProductImageSource,
  NO_IMAGE_URL,
  isValidImageUrl,
} from "@/lib/image-utils"
import { unitMeaningfulForDisplay } from "@/lib/product-unit-display"

/**
 * Same image fields as product cards / `getProductImageCandidates` (image_url, famille, item_key_words, …).
 * Passing only a single resolved `image` URL skips backend URLs and KAOS fallbacks.
 */
export type QuickViewProduct = ProductImageSource & {
  id: string
  name: string
  description?: string
  price: number
  currency?: string
  unit?: string
  itemCode?: string
  supplierId?: string
  supplierName?: string
  /** Package/packet multiplier — forwarded to cart / orders when adding from quick view. */
  itemEmballage?: string
  famille?: string
  FAMILLE?: string
  item_key_words?: string
  item_code?: string
  niki_code?: string
  NIKI_CODE?: string
  nikiCode?: string
  requiresPrescription?: boolean
  requires_prescription?: boolean
}

type ProductQuickViewProps = {
  product: QuickViewProduct | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddToCart: (product: QuickViewProduct) => void
}

export function ProductQuickView({ product, open, onOpenChange, onAddToCart }: ProductQuickViewProps) {
  const priceCheckItems =
    open && product
      ? [
          {
            productId: product.id,
            supplierId: product.supplierId ?? "",
            currentPrice: product.price,
            name: product.name,
          },
        ]
      : []
  usePriceDropToasts(priceCheckItems)

  const placeholder = "/placeholder.svg?height=300&width=300"

  const candidates = useMemo(() => {
    if (!product) return [NO_IMAGE_URL]
    try {
      return getProductImageCandidates(product as ProductImageSource & Record<string, unknown>)
    } catch {
      return [NO_IMAGE_URL]
    }
  }, [product])

  const [candidateIdx, setCandidateIdx] = useState(0)
  const candidatesKey = candidates.join("\x1e")
  useEffect(() => {
    setCandidateIdx(0)
  }, [candidatesKey])

  const candidateSrc = candidates[Math.min(candidateIdx, candidates.length - 1)] ?? NO_IMAGE_URL
  const src =
    product && isValidImageUrl(candidateSrc)
      ? candidateSrc
      : product
        ? getProductImageSrc(product as ProductImageSource, placeholder)
        : placeholder

  if (!product) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="line-clamp-2">{product.name}</DialogTitle>
          {product.supplierName && (
            <DialogDescription>Seller: {product.supplierName}</DialogDescription>
          )}
        </DialogHeader>
        <div className="space-y-4">
          <div className="relative aspect-square w-full rounded-lg bg-muted overflow-hidden">
            {src.startsWith("http") ? (
              <img
                key={`${src}-${candidateIdx}`}
                src={src}
                alt={product.name}
                className="object-cover w-full h-full"
                loading="lazy"
                decoding="async"
                onError={() => {
                  if (candidateIdx + 1 < candidates.length) setCandidateIdx((i) => i + 1)
                }}
              />
            ) : (
              <Image
                key={`${src}-${candidateIdx}`}
                src={src}
                alt={product.name}
                fill
                className="object-cover"
                unoptimized={src === placeholder}
                onError={() => {
                  if (candidateIdx + 1 < candidates.length) setCandidateIdx((i) => i + 1)
                }}
              />
            )}
          </div>
          {product.description && (
            <p className="text-sm text-muted-foreground line-clamp-3">{product.description}</p>
          )}
          <div className="flex items-center justify-between">
            <span className="text-lg font-semibold">
              {product.price.toLocaleString()} {product.currency || "RWF"}
              {unitMeaningfulForDisplay(product.unit) && (
                <span className="text-sm font-normal text-muted-foreground"> / {product.unit}</span>
              )}
            </span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={() => { onAddToCart(product); onOpenChange(false); }}>
            <ShoppingCart className="h-4 w-4 mr-2" />
            Add to cart
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
