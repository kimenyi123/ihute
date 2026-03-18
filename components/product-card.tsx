"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useCartStore } from "@/lib/cart-store"
import { useFavoritesStore } from "@/lib/favorites-store"
import { trackProductView, trackClick } from "@/lib/interaction-tracker"
import { Heart, Eye } from "lucide-react"
import { usePriceWatchStore } from "@/lib/price-watch-store"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"
import { PriceWatchButton } from "@/components/price-watch-button"
import { getProductImageSrc, getProductImageUrl, isValidImageUrl, NO_IMAGE_URL } from "@/lib/image-utils"
import { ProductBadges, ProductTrustSignals } from "@/components/product-badges"
import type { ProductBadgeType } from "@/components/product-badges"

type Product = {
  id: string
  name: string
  description?: string
  price: number
  currency?: string
  unit?: string
  inStock?: boolean
  rating?: number
  itemCode?: string
  supplierId?: string
  supplierName?: string
  supplierLocation?: string
  momo?: string
  image?: string
  image_url?: string
  item_image_url?: string
  item_key_words?: string
  item_code?: string
  famille?: string
  IMAGE_URL?: string
  searchPriority?: "direct" | "contains"
  containsIngredient?: string
  /** Commerce intelligence: badges (Best Price, Nearby, Low Stock, etc.) */
  badges?: ProductBadgeType[]
  /** Why this result: e.g. "Recommended near you", "Popular in this sector" */
  whyShown?: string
  /** Trust: review count, verified seller */
  reviewCount?: number
  verifiedSeller?: boolean
  /** For discount display */
  oldPrice?: number
  /** For "Only N left" badge */
  stockQuantity?: number
  /** For "X% margin" badge */
  marginPercent?: number
  /** e.g. "1.2km away" */
  distanceLabel?: string
}

export function ProductCard({
  product,
  navigateAfterAdd = false,
  compact = false,
}: {
  product: Product
  navigateAfterAdd?: boolean
  compact?: boolean
}) {
  const router = useRouter()
  const addOrInc = useCartStore((s) => s.addOrInc ?? s.addItem)
  const toggleFavorite = useFavoritesStore((s) => s.toggleFavorite)
  const isFavorite = useFavoritesStore((s) => s.isFavorite)
  const { toast } = useToast()

  const {
    id,
    name,
    description,
    price,
    currency = "RWF",
    unit,
    itemCode,
    supplierId,
    supplierName,
    supplierLocation,
    momo,
    image,
    searchPriority,
    containsIngredient,
    badges = [],
    whyShown,
    reviewCount,
    verifiedSeller,
    oldPrice,
    rating,
    stockQuantity,
    marginPercent,
    distanceLabel,
  } = product

  const fav = isFavorite(id)
  const checkPriceDrop = usePriceWatchStore((s) => s.checkPriceDrop)
  const [imgError, setImgError] = useState(false)
  const [fallbackSrc, setFallbackSrc] = useState<string | null>(null)
  const placeholder = "/placeholder.svg?height=300&width=300"

  // Primary: KAOS-based URL (famille + item_key_words, then flat NIKI code, then backend URL, then KAOS no_image)
  const resolvedUrl = getProductImageSrc(product, placeholder)
  // Secondary: raw backend image_url/item_image_url/IMAGE_URL/image (used if KAOS path 404s)
  const backendUrl = getProductImageUrl(product as any) || null

  const activeSrc = fallbackSrc || resolvedUrl
  const hasValidUrl = activeSrc !== placeholder && isValidImageUrl(activeSrc)
  // When no image or load error, show KAOS "no image" graphic instead of grey placeholder
  const src = !imgError && hasValidUrl ? activeSrc : NO_IMAGE_URL
  const isRemote = /^https?:\/\//i.test(src)

  useEffect(() => {
    // Reset error and fallback when product or primary URL changes
    setImgError(false)
    setFallbackSrc(null)

    // Debug log to inspect image resolution for this product
    try {
      // Only log in browser
      if (typeof window !== "undefined") {
        // @ts-expect-error debug
        const famille = (product as any).famille ?? (product as any).FAMILLE
        // @ts-expect-error debug
        const niki = (product as any).item_key_words ?? (product as any).itemCode ?? (product as any).item_code ?? (product as any).ITEM_CODE
        // eslint-disable-next-line no-console
        console.log("[ProductCard][image-debug]", {
          id,
          name,
          famille,
          niki,
          resolvedUrl,
          backendUrl,
        })
      }
    } catch {
      // ignore logging failures
    }
  }, [resolvedUrl, id])

  // Track product view when component mounts
  useEffect(() => {
    trackProductView(id, name, {
      supplierId,
      categoryId: undefined,
    })
  }, [id, name, supplierId])

  // Notify when watched price has dropped
  useEffect(() => {
    const sid = (supplierId || "unknown").toString().trim()
    const dropped = checkPriceDrop(id, sid, price)
    if (dropped) {
      toast({
        title: "Price drop",
        description: `${name} is now ${price.toLocaleString()} RWF (was ${dropped.priceWhenWatched.toLocaleString()} when you watched)`,
        duration: 5000,
      })
    }
  }, [id, supplierId, price, name, checkPriceDrop, toast])

  return (
    <Card className={cn("group h-full overflow-hidden transition-all hover:shadow-lg", compact && "border shadow-sm")}>
      <div className={cn("relative w-full bg-muted", compact ? "aspect-[4/5]" : "aspect-square")}>
        {isRemote ? (
          <img
            src={src}
            alt={name}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => {
              if (!fallbackSrc && backendUrl && backendUrl !== resolvedUrl && isValidImageUrl(backendUrl)) {
                setFallbackSrc(backendUrl)
                setImgError(false)
              } else {
                setImgError(true)
              }
            }}
          />
        ) : (
          <Image
            fill
            src={src}
            alt={name}
            className="object-cover"
            onError={() => {
              if (!fallbackSrc && backendUrl && backendUrl !== resolvedUrl && isValidImageUrl(backendUrl)) {
                setFallbackSrc(backendUrl)
                setImgError(false)
              } else {
                setImgError(true)
              }
            }}
            unoptimized={src === NO_IMAGE_URL || src === placeholder}
          />
        )}

        {/* Heart overlay */}
        <button
          aria-label={fav ? "Remove from favorites" : "Add to favorites"}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            const wasFav = isFavorite(id)
            toggleFavorite({
              id,
              name,
              price,
              unit,
              image,
              description,
              supplierId,
              supplierName,
              supplierLocation,
              momo,
            })
            toast({
              title: wasFav ? "Removed from favorites" : "Added to favorites!",
              description: name,
              duration: 1500,
            })
          }}
          className={cn(
            "absolute inline-flex items-center justify-center rounded-full border bg-white/90 backdrop-blur transition hover:bg-white",
            compact ? "right-1 top-1 h-6 w-6" : "right-2 top-2 h-8 w-8",
            fav ? "text-red-600" : "text-muted-foreground"
          )}
          title={fav ? "Remove from favorites" : "Add to favorites"}
        >
          <Heart className={cn(fav && "fill-current", compact ? "h-3 w-3" : "h-4 w-4")} />
        </button>
      </div>

      <CardContent className={cn("flex flex-col gap-2", compact ? "p-2" : "p-3")}>
        <div className={compact ? "min-h-[32px]" : "min-h-[38px]"}>
          <h3 className={cn("font-semibold leading-tight line-clamp-2", compact ? "text-xs" : "text-sm")}>{name}</h3>
          {(searchPriority === "direct" || containsIngredient) && (
            <div className="mt-1 flex flex-wrap gap-1">
              {searchPriority === "direct" && (
                <span className="inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                  Main Ingredient
                </span>
              )}
              {containsIngredient && searchPriority !== "direct" && (
                <span className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700">
                  Contains: {containsIngredient}
                </span>
              )}
            </div>
          )}
        </div>

        {description && description !== id && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {description}
          </p>
        )}

        <div className={compact ? "text-xs" : "text-sm"}>
          <div className="flex items-baseline gap-2">
            <span className="font-semibold">
              {price.toLocaleString()} {currency}
            </span>
            {oldPrice != null && oldPrice > price && (
              <span className="text-[10px] text-muted-foreground line-through">
                {oldPrice.toLocaleString()}
              </span>
            )}
          </div>
          {supplierName && (
            <p className={cn("mt-0.5 text-muted-foreground font-normal", compact ? "text-[10px]" : "text-xs")}>
              {supplierName.toUpperCase()} <span className="text-amber-500" aria-hidden>⭐⭐⭐</span>
            </p>
          )}
        </div>

        <ProductBadges
          badges={badges}
          max={4}
          className={compact ? "mt-0.5" : "mt-1"}
          stockQuantity={stockQuantity}
          marginPercent={marginPercent}
          distanceLabel={distanceLabel}
        />
        {whyShown && (
          <p className={cn("text-[10px] text-muted-foreground italic", compact ? "mt-0.5" : "mt-1")}>
            {whyShown}
          </p>
        )}
        <ProductTrustSignals
          rating={rating}
          reviewCount={reviewCount}
          verifiedSeller={verifiedSeller}
          className={compact ? "mt-0.5" : "mt-1"}
        />

        <div className={cn("flex flex-wrap gap-1", compact ? "mt-0.5" : "mt-1")}>
        <Button
          size={compact ? "sm" : "sm"}
          className={cn("flex-1 min-w-0", compact && "h-7 text-xs px-2")}
          onClick={(e) => {
            e.stopPropagation()
            trackClick("product", id, name)
            addOrInc(
              {
                id,
                itemCode: itemCode ?? id,
                name,
                price,
                unit,
                image,
                supplierId: (supplierId || "unknown").toString().trim(),
                supplierName: supplierName || "Supplier",
                supplierLocation,
                momo,
                selectedUnit: unit,
              },
              1
            )
            if (navigateAfterAdd) {
              router.push("/cart")
            } else {
              toast({
                title: "Added to cart",
                description: name,
                duration: 2000,
              })
            }
          }}
        >
          ⚡ Buy Now
        </Button>
        <PriceWatchButton
          productId={id}
          supplierId={(supplierId || "unknown").toString().trim()}
          name={name}
          currentPrice={price}
          supplierName={supplierName}
          image={image}
          size={compact ? "sm" : "sm"}
          variant="outline"
          className={compact ? "h-7 text-xs px-2" : undefined}
        />
        </div>
      </CardContent>
    </Card>
  )
}
