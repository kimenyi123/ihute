"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useCartStore } from "@/lib/cart-store"
import { useFavoritesStore } from "@/lib/favorites-store"
import { trackProductView, trackClick } from "@/lib/interaction-tracker"
import { Heart, ShoppingCart } from "lucide-react"
import { usePriceWatchStore } from "@/lib/price-watch-store"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"
import { PriceWatchButton } from "@/components/price-watch-button"
import {
  getProductImageSrc,
  getProductImageCandidates,
  getNikiCodeFromSource,
  isValidImageUrl,
  NO_IMAGE_URL,
} from "@/lib/image-utils"

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
  /** Raw API fields so getProductImageSrc can build KAOS URLs and fallback to backend */
  item_key_words?: string
  item_code?: string
  famille?: string
  IMAGE_URL?: string
  /** IHUTE: direct match vs contains — from backend search ranking */
  searchPriority?: "direct" | "contains"
  containsIngredient?: string
}

export function ProductCard({
  product,
  navigateAfterAdd = false,
}: {
  product: Product
  /** If true, "Buy" navigates to /cart after adding. If false, only adds to cart and shows a toast so user can keep adding. */
  navigateAfterAdd?: boolean
}) {
  const router = useRouter()
  const addOrInc = useCartStore((s) => s.addOrInc ?? s.addItem)
  const cartItems = useCartStore((s) => s.items)
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
    image_url,
    item_image_url,
    IMAGE_URL,
    searchPriority,
    containsIngredient,
  } = product

  const fav = isFavorite(id)
  const checkPriceDrop = usePriceWatchStore((s) => s.checkPriceDrop)

  /** Qty in cart for this product (same seller + code + unit as addOrInc uses) */
  const cartQty = useMemo(() => {
    const sid = (supplierId || "unknown").toString().trim()
    const code = (itemCode ?? id).toString().trim()
    const unitKey = (unit ?? "").toString().trim()
    if (!code) return 0
    return cartItems.reduce((sum, item) => {
      const itemSid = (item.supplierId || "").toString().trim()
      const itemCodeKey = (item.itemCode ?? item.id).toString().trim()
      const itemUnit = (item.selectedUnit ?? item.unit ?? "").toString().trim()
      if (itemSid !== sid || itemCodeKey !== code) return sum
      if (unitKey !== itemUnit) return sum
      return sum + (typeof item.qty === "number" ? item.qty : 0)
    }, 0)
  }, [cartItems, supplierId, itemCode, id, unit])
  const placeholder = "/placeholder.svg?height=300&width=300"

  // Same strategy as Shop With Me:
  // KAOS famille/NIKI → flat NIKI → each backend URL → KAOS no_image, advancing on img onError.
  const imageCandidates = useMemo(
    () => getProductImageCandidates(product as any),
    [
      id,
      itemCode,
      product.famille,
      (product as any).FAMILLE,
      product.item_key_words,
      product.item_code,
      image,
      image_url,
      item_image_url,
      IMAGE_URL,
    ]
  )
  /** Stable string so we only reset fallback index when the URL list actually changes — NOT when candidateIdx changes. */
  const candidatesSignature = imageCandidates.join("\x1e")
  const [candidateIdx, setCandidateIdx] = useState(0)
  const [imgError, setImgError] = useState(false)
  const resolvedUrl = imageCandidates[Math.min(candidateIdx, imageCandidates.length - 1)] ?? NO_IMAGE_URL

  const hasValidUrl = resolvedUrl !== placeholder && isValidImageUrl(resolvedUrl)
  // When no image or load error, show KAOS "no image" graphic instead of grey placeholder
  const src = !imgError && hasValidUrl ? resolvedUrl : NO_IMAGE_URL
  const isRemote = /^https?:\/\//i.test(src)
  /** Same URL shown on the card — pass this to cart/favorites so the line item keeps the working image */
  const imageUrlForCart = !imgError && src !== NO_IMAGE_URL ? src : getProductImageSrc(product, placeholder)

  useEffect(() => {
    // Reset only when this product's image URL list changes (never tie to resolvedUrl — that flickers with candidateIdx)
    setImgError(false)
    setCandidateIdx(0)

    // Debug logging for image resolution
    if (typeof window !== "undefined") {
      console.log("[ProductCard] Image resolution for:", {
        name: name,
        id: id,
        itemCode: itemCode,
        famille: (product as any).famille ?? (product as any).FAMILLE,
        nikiCode: getNikiCodeFromSource(product),
        imageCandidates: imageCandidates.slice(0, 5), // First 5 candidates
        totalCandidates: imageCandidates.length,
        resolvedUrl,
        hasValidUrl,
        backendImageFields: {
          image_url: product.image_url,
          item_image_url: product.item_image_url,
          IMAGE_URL: (product as any).IMAGE_URL,
          image: product.image
        }
      })
    }
  }, [candidatesSignature, id])

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
    <Card className="group h-full overflow-hidden transition-all hover:shadow-lg">
      <div
        className={cn(
          "relative w-full aspect-square bg-muted",
          cartQty > 0 && "ring-2 ring-emerald-500/90 ring-inset"
        )}
      >
        {isRemote ? (
          <img
            key={resolvedUrl}
            src={src}
            alt={name}
            className="absolute inset-0 h-full w-full object-contain"
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => {
              console.log("[ProductCard] Remote image failed to load:", {
                name: name,
                id: id,
                failedUrl: src,
                candidateIdx,
                totalCandidates: imageCandidates.length,
                tryingNext: candidateIdx + 1 < imageCandidates.length
              })
              
              if (candidateIdx + 1 < imageCandidates.length) {
                setCandidateIdx((i) => i + 1)
                setImgError(false)
              } else {
                setImgError(true)
                console.log("[ProductCard] All image candidates failed, showing NO_IMAGE_URL for:", name)
              }
            }}
          />
        ) : (
          <Image
            key={resolvedUrl}
            fill
            src={src}
            alt={name}
            className="object-contain"
            onError={() => {
              console.log("[ProductCard] Next.js Image failed to load:", {
                name: name,
                id: id,
                failedUrl: src,
                candidateIdx,
                totalCandidates: imageCandidates.length,
                tryingNext: candidateIdx + 1 < imageCandidates.length
              })
              
              if (candidateIdx + 1 < imageCandidates.length) {
                setCandidateIdx((i) => i + 1)
                setImgError(false)
              } else {
                setImgError(true)
                console.log("[ProductCard] All image candidates failed, showing NO_IMAGE_URL for:", name)
              }
            }}
            unoptimized={src === NO_IMAGE_URL || src === placeholder}
          />
        )}

        {/* In-cart badge on image */}
        {cartQty > 0 && (
          <div
            className="absolute bottom-2 left-2 z-10 flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white shadow-md"
            aria-label={`In cart, quantity ${cartQty}`}
          >
            <ShoppingCart className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>{cartQty}</span>
          </div>
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
              image: imageUrlForCart,
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
            "absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full border bg-white/90 backdrop-blur transition",
            "hover:bg-white",
            fav ? "text-red-600" : "text-muted-foreground"
          )}
          title={fav ? "Remove from favorites" : "Add to favorites"}
        >
          <Heart className={cn("h-4 w-4", fav && "fill-current")} />
        </button>
      </div>

      <CardContent className="p-3 flex flex-col gap-2">
        <div className="min-h-[38px]">
          <h3 className="text-sm font-semibold leading-tight line-clamp-2">{name}</h3>
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

        <div className="text-sm">
          <div className="font-semibold">
            {price.toLocaleString()} {currency}
          </div>
          {supplierName && (
            <div className="text-xs text-muted-foreground">
              {supplierName}
              {supplierLocation ? ` — ${supplierLocation}` : ""}
            </div>
          )}
        </div>

        <div className="mt-1 flex flex-wrap gap-1">
        <Button
          size="sm"
          className="flex-1 min-w-0"
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
                image: imageUrlForCart,
                image_url,
                item_image_url,
                IMAGE_URL,
                item_key_words: product.item_key_words,
                famille: product.famille,
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
          Buy
        </Button>
        <PriceWatchButton
          productId={id}
          supplierId={(supplierId || "unknown").toString().trim()}
          name={name}
          currentPrice={price}
          supplierName={supplierName}
          image={imageUrlForCart}
          size="sm"
          variant="outline"
        />
        </div>
      </CardContent>
    </Card>
  )
}
