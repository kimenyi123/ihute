"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useCartStore } from "@/lib/cart-store"
import { useFavoritesStore } from "@/lib/favorites-store"
import { trackProductView, trackClick } from "@/lib/interaction-tracker"
import { Heart, Eye, Store } from "lucide-react"
import { Heart, ScanSearch, ShoppingCart } from "lucide-react"
import { usePriceWatchStore } from "@/lib/price-watch-store"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"
import { PriceWatchButton } from "@/components/price-watch-button"
import { getProductImageSrc, getProductImageUrl, isValidImageUrl, NO_IMAGE_URL } from "@/lib/image-utils"
import { ErxPrescriptionDialog } from "@/components/erx-prescription-dialog"
import { serializeErxForNotes } from "@/lib/erx-prescription"
import { ProductBadges, ProductTrustSignals } from "@/components/product-badges"
import type { ProductBadgeType } from "@/components/product-badges"
import {
  getProductImageSrc,
  getProductImageCandidates,
  getNikiCodeFromSource,
  isValidImageUrl,
  NO_IMAGE_URL,
} from "@/lib/image-utils"
import { unitMeaningfulForDisplay } from "@/lib/product-unit-display"
import { generalSellingPrice, normalizeItemEmballageForCart } from "@/lib/package-price"
import { itemEmballageDisplaySuffix } from "@/lib/cart-display-utils"
import { isExpiryMeaningfulForCustomerDisplay } from "@/lib/item-state-display"

/** Suffix after price: `N pcs` from `item_emballage` (pack size), not currency — default N=1 when omitted. */
function formatPcsFromItemEmballage(raw: unknown): string | null {
  const s =
    raw == null || String(raw).trim() === ""
      ? "1"
      : String(raw)
  return itemEmballageDisplaySuffix(s)
}

type Product = {
  id: string
  name: string
  description?: string
  /** Base catalog unit selling price (before × item_emballage). */
  price: number
  currency?: string
  unit?: string
  /** Package/packet multiplier from API (`item_emballage` / `ITEM_EMBALLAGE`). */
  itemEmballage?: string | number
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
  /** Brand from backend: item_fabricant or id_fabricant */
  brand?: string
  IMAGE_URL?: string
  item_state?: string
  expiryLabel?: string
  /** From `/api/fetchSuggestions` enrichment — customer line price (base × emballage). */
  final_selling_price?: number
  /** IHUTE: direct match vs contains — from backend search ranking */
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
  layout = "card",
  onQuickView,
  quickViewReplacesWatchPrice = false,
  compact = false,
  /** Pharmacy sector (/category_ai/pharmacy): open eRx form before add to cart */
  pharmacyErx = false,
}: {
  product: Product
  navigateAfterAdd?: boolean
  /**
   * `spotlight` = single-product style: same vertical card as the grid, but larger and centered
   * (image on top, title/price/seller, Buy + Watch price, optional Quick view below).
   * `compact` = denser grid tiles: shorter image (4:3), smaller type and buttons (e.g. supplier catalog).
   */
  layout?: "card" | "spotlight" | "compact"
  /** When set, opens the quick-view dialog (see `quickViewReplacesWatchPrice`). */
  onQuickView?: () => void
  /**
   * When true with `onQuickView`, the secondary action is “Quick view” in the same slot as “Watch price”
   * (category grid). When false (default), keeps “Watch price” and optionally a third “Quick view” row.
   */
  quickViewReplacesWatchPrice?: boolean
  compact?: boolean
  pharmacyErx?: boolean
}) {
  const isSpotlight = layout === "spotlight"
  const isCompact = layout === "compact"
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
    itemEmballage,
  } = product

  const displayPrice = useMemo(() => {
    return generalSellingPrice(
      price,
      itemEmballage ?? (product as { ITEM_EMBALLAGE?: unknown }).ITEM_EMBALLAGE,
    )
  }, [price, itemEmballage, product])
  const itemEmballageForCart = useMemo(
    () => normalizeItemEmballageForCart(itemEmballage ?? (product as { ITEM_EMBALLAGE?: unknown }).ITEM_EMBALLAGE),
    [itemEmballage, product]
  )
  const displayUnitLabel = useMemo(() => {
    const pcs = formatPcsFromItemEmballage(itemEmballage ?? (product as { ITEM_EMBALLAGE?: unknown }).ITEM_EMBALLAGE)
    if (pcs) return pcs
    if (unitMeaningfulForDisplay(unit)) return String(unit).trim()
    return null
  }, [itemEmballage, product, unit])

  const fav = isFavorite(id)
  const checkPriceDrop = usePriceWatchStore((s) => s.checkPriceDrop)

  /** Qty in cart for this line (id distinguishes same NIKI at different prices) */
  const cartQty = useMemo(() => {
    const sid = (supplierId || "unknown").toString().trim()
    const lineId = id.toString().trim()
    const unitKey = (unit ?? "").toString().trim()
    if (!lineId) return 0
    return cartItems.reduce((sum, item) => {
      const itemSid = (item.supplierId || "").toString().trim()
      const itemLineId = (item.id ?? "").toString().trim()
      const itemUnit = (item.selectedUnit ?? item.unit ?? "").toString().trim()
      if (itemSid !== sid || itemLineId !== lineId) return sum
      if (unitKey !== itemUnit) return sum
      return sum + (typeof item.qty === "number" ? item.qty : 0)
    }, 0)
  }, [cartItems, supplierId, id, unit])
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
  const [fallbackSrc, setFallbackSrc] = useState<string | null>(null)
  const [erxOpen, setErxOpen] = useState(false)
  const placeholder = "/placeholder.svg?height=300&width=300"

  // Primary: KAOS-based URL (famille + item_key_words, then flat NIKI code, then backend URL, then KAOS no_image)
  const resolvedUrl = getProductImageSrc(product, placeholder)
  // Secondary: raw backend image_url/item_image_url/IMAGE_URL/image (used if KAOS path 404s)
  const backendUrl = getProductImageUrl(product as any) || null

  const activeSrc = fallbackSrc || resolvedUrl
  // Same as shop-with-me: treat NO_IMAGE_URL as no image and show Store icon placeholder
  const hasValidUrl = activeSrc !== placeholder && activeSrc !== NO_IMAGE_URL && isValidImageUrl(activeSrc)
  const src = !imgError && hasValidUrl ? activeSrc : NO_IMAGE_URL
  const isRemote = /^https?:\/\//i.test(src)
  const showPlaceholderIcon = !hasValidUrl || imgError

  useEffect(() => {
    // Reset error and fallback when product or primary URL changes
    setImgError(false)
    setFallbackSrc(null)

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
    const dropped = checkPriceDrop(id, sid, displayPrice)
    if (dropped) {
      toast({
        title: "Price drop",
        description: `${name} is now ${displayPrice.toLocaleString()} RWF (was ${dropped.priceWhenWatched.toLocaleString()} when you watched)`,
        duration: 5000,
      })
    }
  }, [id, supplierId, displayPrice, name, checkPriceDrop, toast])

  const addProductToCart = () => {
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
  }

  return (
    <>
    <Card className={cn("group h-full overflow-hidden transition-all hover:shadow-lg", compact && "border shadow-sm")}>
      <div className={cn("relative w-full bg-muted", compact ? "aspect-[4/5]" : "aspect-square")}>
        {showPlaceholderIcon ? (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            <Store className="h-10 w-10 opacity-50" />
          </div>
        ) : isRemote ? (
          <img
            src={src}
            alt={name}
            className={cn(
              "absolute inset-0 h-full w-full",
              src === NO_IMAGE_URL ? "object-contain p-2" : "object-cover"
            )}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => {
              if (!fallbackSrc && backendUrl && backendUrl !== resolvedUrl && isValidImageUrl(backendUrl)) {
                setFallbackSrc(backendUrl)
                setImgError(false)
              } else {
                setImgError(true)
                console.log("[ProductCard] All image candidates failed, showing NO_IMAGE_URL for:", name)
              }
            }}
          />
        ) : (
          <Image
            fill
            src={src}
            alt={name}
            className={cn(
              src === NO_IMAGE_URL ? "object-contain p-2" : "object-cover"
            )}
            onError={() => {
              if (!fallbackSrc && backendUrl && backendUrl !== resolvedUrl && isValidImageUrl(backendUrl)) {
                setFallbackSrc(backendUrl)
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
            className={cn(
              "absolute bottom-2 left-2 z-10 flex items-center gap-1 rounded-full font-bold text-white shadow-md",
              isSpotlight
                ? "bg-[#00a676] px-2.5 py-1.5 text-xs"
                : isCompact
                  ? "bg-emerald-600 px-1.5 py-0.5 text-[9px]"
                  : "bg-emerald-600 px-2 py-1 text-[10px]",
            )}
            aria-label={`In cart, quantity ${cartQty}`}
          >
            <ShoppingCart
              className={cn("shrink-0", isSpotlight ? "h-4 w-4" : isCompact ? "h-3 w-3" : "h-3.5 w-3.5")}
              aria-hidden
            />
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
              price: displayPrice,
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
        <div
          className={cn(
            "flex shrink-0 flex-col gap-2",
            isSpotlight ? "mt-2" : "",
            isCompact && "gap-1",
          )}
        >
        <div
          className={cn(
            "flex gap-2",
            !isSpotlight && !isCompact && "mt-1 flex-wrap gap-1",
            isCompact && "mt-0 w-full flex-col gap-1",
          )}
        >
        <Button
          size={isSpotlight ? "default" : "sm"}
          className={cn(
            isSpotlight
              ? "h-9 w-[40%] shrink-0 rounded-md border-0 bg-[#1a3d5f] px-2 text-sm text-white hover:bg-[#153550]"
              : isCompact
                ? "h-8 w-full px-2 text-[11px] font-semibold"
                : "min-w-0 flex-1",
          )}
          size={compact ? "sm" : "sm"}
          className={cn("flex-1 min-w-0", compact && "h-7 text-xs px-2")}
          onClick={(e) => {
            e.stopPropagation()
            trackClick("product", id, name)
            if (pharmacyErx) {
              setErxOpen(true)
              return
            }
            addProductToCart()
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
    {pharmacyErx && (
      <ErxPrescriptionDialog
        open={erxOpen}
        onOpenChange={setErxOpen}
        productName={name}
        prefillSource={product as Record<string, unknown>}
        onConfirm={(erx) => {
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
              erx,
              notes: serializeErxForNotes(erx),
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
      />
    )}
    </>
            addOrInc(
              {
                id,
                itemCode: itemCode ?? id,
                name,
                price: displayPrice,
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
                ...(itemEmballageForCart ? { itemEmballage: itemEmballageForCart } : {}),
                ...(product.item_state ? { item_state: product.item_state } : {}),
                ...(product.expiryLabel ? { expiryLabel: product.expiryLabel } : {}),
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
        {onQuickView && quickViewReplacesWatchPrice ? (
          <Button
            type="button"
            variant="outline"
            size={isSpotlight ? "default" : "sm"}
            className={
              isSpotlight
                ? "h-9 min-w-0 flex-1 rounded-md border-gray-300 text-sm text-foreground"
                : isCompact
                  ? "h-8 w-full px-2 text-[10px] leading-tight [&_svg]:mr-1 [&_svg]:h-3 [&_svg]:w-3"
                  : "min-w-0 flex-1"
            }
            onClick={(e) => {
              e.stopPropagation()
              onQuickView()
            }}
            title="Quick view"
          >
            <ScanSearch className="h-4 w-4 mr-1 shrink-0" />
            Quick view
          </Button>
        ) : (
          <PriceWatchButton
            productId={(itemCode ?? id).toString().trim()}
            supplierId={(supplierId || "unknown").toString().trim()}
            name={name}
            currentPrice={displayPrice}
            supplierName={supplierName}
            image={imageUrlForCart}
            size={isSpotlight ? "default" : "sm"}
            variant="outline"
            className={
              isSpotlight
                ? "h-9 min-w-0 flex-1 rounded-md border-gray-300 text-sm text-foreground"
                : isCompact
                  ? "h-8 w-full px-2 text-[10px] leading-tight [&_svg]:mr-1 [&_svg]:h-3 [&_svg]:w-3"
                  : undefined
            }
          />
        )}
        </div>
        {onQuickView && !quickViewReplacesWatchPrice && (
          <Button
            type="button"
            variant="outline"
            size={isSpotlight ? "default" : "sm"}
            className={cn(
              isSpotlight
                ? "h-9 w-full rounded-md border-gray-300 text-sm text-foreground"
                : isCompact
                  ? "ml-auto h-6 w-auto rounded-md px-2 text-[10px] leading-none"
                  : "ml-auto h-7 w-auto rounded-md px-2.5 text-xs",
            )}
            onClick={(e) => {
              e.stopPropagation()
              onQuickView()
            }}
          >
            Quick view
          </Button>
        )}
        </div>
      </CardContent>
    </Card>
  )
}
