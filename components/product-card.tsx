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
import { getProductImageSrc, isValidImageUrl } from "@/lib/image-utils"

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
  } = product

  const fav = isFavorite(id)
  const checkPriceDrop = usePriceWatchStore((s) => s.checkPriceDrop)
  const [imgError, setImgError] = useState(false)
  const placeholder = "/placeholder.svg?height=300&width=300"

  // Resolve from any backend field (image, image_url, item_image_url) so display is consistent
  const resolvedUrl = getProductImageSrc(product, placeholder)
  const hasValidUrl = resolvedUrl !== placeholder && isValidImageUrl(resolvedUrl)
  const src = !imgError && hasValidUrl ? resolvedUrl : placeholder
  const isRemote = /^https?:\/\//i.test(src)

  useEffect(() => {
    setImgError(false)
  }, [resolvedUrl])

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
      <div className="relative w-full aspect-square bg-muted">
        {isRemote ? (
          <img
            src={src}
            alt={name}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
          />
        ) : (
          <Image
            fill
            src={src}
            alt={name}
            className="object-cover"
            onError={() => setImgError(true)}
            unoptimized={src === placeholder}
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
          Buy
        </Button>
        <PriceWatchButton
          productId={id}
          supplierId={(supplierId || "unknown").toString().trim()}
          name={name}
          currentPrice={price}
          supplierName={supplierName}
          image={image}
          size="sm"
          variant="outline"
        />
        </div>
      </CardContent>
    </Card>
  )
}
