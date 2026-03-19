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
import { getProductImageCandidates, getProductImageSrc, NO_IMAGE_URL, isValidImageUrl } from "@/lib/image-utils"

export type QuickViewProduct = {
  id: string
  name: string
  description?: string
  price: number
  currency?: string
  unit?: string
  image?: string
  itemCode?: string
  supplierId?: string
  supplierName?: string
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

  if (!product) return null

  const placeholder = "/placeholder.svg?height=300&width=300"

  const candidates = useMemo(() => {
    try {
      return getProductImageCandidates(product as any)
    } catch {
      return [NO_IMAGE_URL]
    }
  }, [
    product.id,
    product.image,
    (product as any).image_url,
    (product as any).item_image_url,
    (product as any).IMAGE_URL,
    (product as any).item_key_words,
    (product as any).famille,
  ])

  const [candidateIdx, setCandidateIdx] = useState(0)
  useEffect(() => {
    setCandidateIdx(0)
  }, [candidates.join("\x1e")])

  const candidateSrc = candidates[Math.min(candidateIdx, candidates.length - 1)] ?? NO_IMAGE_URL
  const src = isValidImageUrl(candidateSrc) ? candidateSrc : getProductImageSrc(product as any, placeholder)

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
                key={src}
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
                key={src}
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
              {product.unit && <span className="text-sm font-normal text-muted-foreground"> / {product.unit}</span>}
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
