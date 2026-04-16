"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useCartStore } from "@/lib/cart-store"
import { useFavoritesStore } from "@/lib/favorites-store"
import { trackProductView, trackClick } from "@/lib/interaction-tracker"
import { Heart, ScanSearch, ShoppingCart } from "lucide-react"
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
  /** Raw API fields so getProductImageSrc can build KAOS URLs and fallback to backend */
  item_key_words?: string
  item_code?: string
  famille?: string
  IMAGE_URL?: string
  item_state?: string
  expiryLabel?: string
  /** From `/api/fetchSuggestions` enrichment — customer line price (base × emballage). */
  final_selling_price?: number
  /** IHUTE: direct match vs contains — from backend search ranking */
  searchPriority?: "direct" | "contains"
  containsIngredient?: string
}

export function ProductCard({
  product,
  navigateAfterAdd = false,
  layout = "card",
  onQuickView,
  quickViewReplacesWatchPrice = false,
}: {
  product: Product
  /** If true, "Buy" navigates to /cart after adding. If false, only adds to cart and shows a toast so user can keep adding. */
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
}) {
  const isSpotlight = layout === "spotlight"
  const isCompact = layout === "compact"
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
    const dropped = checkPriceDrop(id, sid, displayPrice)
    if (dropped) {
      toast({
        title: "Price drop",
        description: `${name} is now ${displayPrice.toLocaleString()} RWF (was ${dropped.priceWhenWatched.toLocaleString()} when you watched)`,
        duration: 5000,
      })
    }
  }, [id, supplierId, displayPrice, name, checkPriceDrop, toast])

  return (
    <Card
      className={cn(
        "group overflow-hidden transition-all",
        isSpotlight
          ? "flex h-[560px] w-[280px] shrink-0 flex-col gap-0 rounded-[14px] border border-gray-200 bg-white py-0 shadow-[0_4px_14px_rgba(15,23,42,0.08)]"
          : isCompact
            ? "h-full border-slate-200/90 shadow-sm hover:shadow-md"
            : "h-full hover:shadow-lg",
      )}
    >
      <div
        className={cn(
          "relative w-full bg-muted",
          /* Reference: ~58% of card height ≈ 325px; green accent on top + sides */
          isSpotlight
            ? "h-[325px] shrink-0 border-l-2 border-r-2 border-t-2 border-[#00a676]"
            : isCompact
              ? "aspect-[4/3] max-h-[132px] sm:max-h-[140px]"
              : "aspect-square",
          !isSpotlight && cartQty > 0 && "ring-2 ring-emerald-500 ring-inset",
        )}
      >
        {isRemote ? (
          <img
            key={resolvedUrl}
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
            className={cn(
              src === NO_IMAGE_URL ? "object-contain p-2" : "object-cover"
            )}
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
            "absolute right-2 top-2 inline-flex items-center justify-center rounded-full border bg-white shadow-sm transition hover:bg-white",
            isSpotlight
              ? "h-9 w-9 border-gray-300"
              : isCompact
                ? "right-1 top-1 h-6 w-6 border-transparent bg-white/95 p-0 shadow backdrop-blur"
                : "h-8 w-8 border-transparent bg-white/90 backdrop-blur",
            fav ? "text-red-600" : "text-muted-foreground",
          )}
          title={fav ? "Remove from favorites" : "Add to favorites"}
        >
          <Heart
            className={cn(
              isSpotlight ? "h-5 w-5" : isCompact ? "h-3 w-3" : "h-4 w-4",
              fav && "fill-current",
            )}
          />
        </button>
      </div>

      <CardContent
        className={cn(
          "flex flex-col",
          isSpotlight
            ? "min-h-0 flex-1 justify-between gap-2 px-5 pb-5 pt-4"
            : isCompact
              ? "gap-1 p-2 pt-1.5"
              : "gap-2 p-3",
        )}
      >
        {isSpotlight ? (
          <div className="flex min-h-0 flex-1 flex-col space-y-2 overflow-hidden">
            <h3 className="line-clamp-3 text-sm font-semibold uppercase tracking-wide leading-snug text-black">
              {name}
            </h3>
            {(searchPriority === "direct" || containsIngredient) && (
              <div className="flex flex-wrap gap-1">
                {searchPriority === "direct" && (
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                    {/* Main Ingredient */}
                  </span>
                )}
                {containsIngredient && searchPriority !== "direct" && (
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                    Contains: {containsIngredient}
                  </span>
                )}
              </div>
            )}
            {description && description !== id && (
              <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{description}</p>
            )}
            <div className="mt-auto space-y-1 pt-1">
              <div className="text-base font-semibold tabular-nums text-black">
                {displayPrice.toLocaleString()} {currency}
                {displayUnitLabel ? (
                  <span className="text-sm font-normal text-muted-foreground"> ({displayUnitLabel})</span>
                ) : null}
              </div>
              {isExpiryMeaningfulForCustomerDisplay(product.expiryLabel) ? (
                <div className="text-[11px] font-medium text-amber-800/90">
                  Expiry: {product.expiryLabel}
                </div>
              ) : null}
              {supplierName && (
                <div className="text-[11px] font-medium uppercase tracking-wide text-[#7c8ba1]">
                  {supplierName}
                  {supplierLocation ? ` — ${supplierLocation}` : ""}
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className={cn(isCompact ? "min-h-0" : "min-h-[38px]")}>
              <h3
                className={cn(
                  "line-clamp-2 font-semibold leading-snug text-foreground",
                  isCompact ? "text-[11px] leading-tight" : "text-sm",
                )}
              >
                {name}
              </h3>
              {(searchPriority === "direct" || containsIngredient) && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {searchPriority === "direct" && (
                    <span className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                      {/* Main Ingredient */}
                    </span>
                  )}
                  {containsIngredient && searchPriority !== "direct" && (
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700">
                      Contains: {containsIngredient}
                    </span>
                  )}
                </div>
              )}
            </div>
            {description && description !== id && (
              <p
                className={cn(
                  "line-clamp-2 text-muted-foreground",
                  isCompact ? "text-[10px] leading-snug" : "text-xs",
                )}
              >
                {description}
              </p>
            )}
            <div className={cn(isCompact ? "text-[11px]" : "text-sm")}>
              <div className="font-semibold tabular-nums text-foreground">
                {displayPrice.toLocaleString()} {currency}
                {displayUnitLabel ? (
                  <span
                    className={cn(
                      "font-normal text-muted-foreground",
                      isCompact ? "text-[10px]" : "text-sm",
                    )}
                  >
                    {" "}
                    ({displayUnitLabel})
                  </span>
                ) : null}
              </div>
              {isExpiryMeaningfulForCustomerDisplay(product.expiryLabel) ? (
                <div
                  className={cn(
                    "text-amber-800/90 mt-0.5",
                    isCompact ? "text-[9px] leading-tight" : "text-[11px]",
                  )}
                >
                  Expiry: {product.expiryLabel}
                </div>
              ) : null}
              {supplierName && (
                <div
                  className={cn(
                    "uppercase tracking-wide text-muted-foreground",
                    isCompact ? "line-clamp-1 text-[9px]" : "text-xs",
                  )}
                >
                  <span className="text-foreground/90">{supplierName}</span>
                  {supplierLocation ? ` — ${supplierLocation}` : ""}
                </div>
              )}
            </div>
          </>
        )}

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
          onClick={(e) => {
            e.stopPropagation()
            trackClick("product", id, name)
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
