"use client"

/**
 * **Cart checkout upsell** — “Complete your order?” dialog shown before checkout.
 *
 * - **Data:** `POST /api/cart/suggestions` with current cart lines; backend prefers the same supplier’s catalog
 *   (Redis/`fetchSuggestions`) and returns up to 6 rows.
 * - **Each row:** thumbnail via {@link getProductImageSrc} (passes `image_url`, `item_key_words`, `famille`, …
 *   when the API includes them — missing fields → KAOS fallbacks or placeholder).
 * - **Price:** base `price` × `item_emballage` once; `(N pcs)` via {@link itemEmballageDisplaySuffix}.
 * - **Actions:** per-row add to cart; “View more” reveals up to {@link MAX_SHOW}; link to search scoped by supplier;
 *   “No thanks” / “Continue to checkout” both invoke {@link CartSuggestionsPopupProps.onContinue} (parent closes modal).
 */

import { useState, useEffect } from "react"
import Link from "next/link"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useCartStore } from "@/lib/cart-store"
import { DEFAULT_CURRENCY, DEFAULT_PLACEHOLDER_IMAGE } from "@/lib/constants"
import { getProductImageSrc } from "@/lib/image-utils"
import { Loader2, Plus, Check, ChevronDown, ExternalLink } from "lucide-react"
import { itemEmballageDisplaySuffix } from "@/lib/cart-display-utils"
import { generalSellingPrice, normalizeItemEmballageForCart } from "@/lib/package-price"
import Image from "next/image"

export type CartSuggestionItem = {
  product_id: string
  name: string
  /** Base catalog unit (`selling_price`); line total = × `item_emballage`. */
  price: number
  item_emballage?: string | number
  ITEM_EMBALLAGE?: string | number
  image_url?: string
  /** For KAOS image URL resolution when `image_url` is missing */
  item_key_words?: string
  famille?: string
  FAMILLE?: string
  item_commercial_name?: string
  reason?: string
  confidence?: number
  supplier_id?: string
  supplier_name?: string
  item_code?: string
}

/** First paint: show this many suggestions; “View more” expands up to {@link MAX_SHOW}. */
const INITIAL_SHOW = 3
/** Hard cap on rows kept in client state (must match server `MAX_SUGGESTIONS` in `app/api/cart/suggestions`). */
const MAX_SHOW = 6

function getSuggestionReasonLabel(reason?: string): string {
  if (!reason) return ""
  const labels: Record<string, string> = {
    frequently_bought_together: "Frequently bought together",
    complementary_item: "Completes your meal",
    category_based: "Goes well with your order",
    related: "You might also like",
  }
  return labels[reason] ?? ""
}

/** Resolved URL for the 56×56 thumbnail; same pipeline as product cards (backend URLs + KAOS paths). */
function getImageSrc(s: CartSuggestionItem): string {
  return getProductImageSrc(s as Record<string, unknown>, DEFAULT_PLACEHOLDER_IMAGE)
}

type CartSuggestionsPopupProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  cartItems: { product_id?: string; name?: string; quantity?: number; supplier_id?: string; supplier_name?: string }[]
  onContinue: () => void
}

export function CartSuggestionsPopup({
  open,
  onOpenChange,
  cartItems,
  onContinue,
}: CartSuggestionsPopupProps) {
  const [suggestions, setSuggestions] = useState<CartSuggestionItem[]>([])
  const [loading, setLoading] = useState(false)
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())
  const [showAll, setShowAll] = useState(false)
  const addItem = useCartStore((s) => s.addItem ?? s.addOrInc)

  // When the dialog opens, load suggestions; reset when it closes or cart becomes empty.
  useEffect(() => {
    if (!open) {
      setSuggestions([])
      setAddedIds(new Set())
      setShowAll(false)
      return
    }
    if (cartItems.length === 0) {
      setSuggestions([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setSuggestions([])
    fetch("/api/cart/suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cart_items: cartItems.map((i) => ({
          product_id: i.product_id,
          name: i.name,
          quantity: i.quantity,
          supplier_id: i.supplier_id,
        })),
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data?.suggestions)) {
          setSuggestions(data.suggestions)
        }
      })
      .catch(() => {
        if (!cancelled) setSuggestions([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, cartItems])

  // Line price and optional `itemEmballage` on the cart line must match the displayed row.
  const handleAdd = (s: CartSuggestionItem) => {
    const embRaw = s.item_emballage ?? s.ITEM_EMBALLAGE
    const linePrice = generalSellingPrice(s.price, embRaw)
    const itemEmballage = normalizeItemEmballageForCart(embRaw)
    addItem({
      id: s.product_id,
      itemCode: s.item_code ?? s.product_id,
      name: s.name,
      price: linePrice,
      supplierId: s.supplier_id ?? "",
      supplierName: s.supplier_name ?? "Supplier",
      image: s.image_url,
      ...(itemEmballage ? { itemEmballage } : {}),
    }, 1)
    setAddedIds((prev) => new Set(prev).add(`${s.product_id}|${s.supplier_id ?? ""}`))
  }

  const displayList = showAll ? suggestions : suggestions.slice(0, INITIAL_SHOW)
  const hasMore = suggestions.length > INITIAL_SHOW && !showAll
  // Deep link: same supplier as first cart line when known; otherwise search by first product name.
  const primarySupplierId = cartItems[0]?.supplier_id?.trim()
  const primarySupplierName = cartItems[0]?.supplier_name?.trim()
  const viewAllSuggestionsHref =
    primarySupplierId
      ? `/search?supplier=${encodeURIComponent(primarySupplierId)}${primarySupplierName ? `&supplierName=${encodeURIComponent(primarySupplierName)}` : ""}`
      : `/search?q=${encodeURIComponent(cartItems.map((i) => i.name).filter(Boolean)[0] || "products")}`

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v)
        if (!v) onContinue()
      }}
    >
      <DialogContent className="max-w-md sm:max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Complete your order?</DialogTitle>
          <DialogDescription>
            Items that go well with your order
          </DialogDescription>
        </DialogHeader>
        {/* Scrollable body: spinner → empty copy → list of suggestion cards → optional “View more” + search link */}
        <div className="overflow-y-auto flex-1 min-h-0 py-2">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : suggestions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No suggestions right now.</p>
          ) : (
            <ul className="space-y-3">
              {displayList.map((s) => {
                const key = `${s.product_id}|${s.supplier_id ?? ""}`
                const added = addedIds.has(key)
                const img = getImageSrc(s)
                const embRaw = s.item_emballage ?? s.ITEM_EMBALLAGE
                const linePrice = generalSellingPrice(s.price, embRaw)
                const unitLabel = itemEmballageDisplaySuffix(
                  embRaw != null && String(embRaw).trim() !== "" ? String(embRaw) : undefined,
                )
                return (
                  <li
                    key={key}
                    className="flex items-center gap-3 rounded-lg border p-2"
                  >
                    <div className="relative h-14 w-14 shrink-0 rounded-md bg-muted overflow-hidden">
                      {img.startsWith("http") || img.startsWith("//") ? (
                        <img
                          src={img.startsWith("//") ? `https:${img}` : img}
                          alt=""
                          className="object-cover w-full h-full"
                        />
                      ) : (
                        <Image src={img} alt="" fill className="object-cover" unoptimized={img === DEFAULT_PLACEHOLDER_IMAGE} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{s.name}</p>
                      {getSuggestionReasonLabel(s.reason) && (
                        <p className="text-xs text-muted-foreground">{getSuggestionReasonLabel(s.reason)}</p>
                      )}
                      <p className="text-sm text-muted-foreground">
                        <span className="tabular-nums">{linePrice.toLocaleString()}</span>{" "}
                        {DEFAULT_CURRENCY}
                        {unitLabel ? (
                          <span className="text-muted-foreground"> ({unitLabel})</span>
                        ) : null}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant={added ? "secondary" : "default"}
                      onClick={() => !added && handleAdd(s)}
                      disabled={added}
                      aria-label={added ? "Added" : "Add to cart"}
                    >
                      {added ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
          {hasMore && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-2"
              onClick={() => setShowAll(true)}
            >
              <ChevronDown className="h-4 w-4 mr-1" />
              {/* Reveal remaining rows up to MAX_SHOW (already fetched). */}
              View more ({suggestions.length - INITIAL_SHOW} more)
            </Button>
          )}
          {suggestions.length > 0 && (
            <Button variant="link" size="sm" className="w-full mt-1" asChild>
              <Link href={viewAllSuggestionsHref}>
                <ExternalLink className="h-4 w-4 mr-1" />
                {primarySupplierId ? "View all from this supplier" : "View all suggestions"}
              </Link>
            </Button>
          )}
        </div>
        {/* Primary dismiss: both buttons call onContinue so the host can advance to checkout or stay on cart. */}
        <DialogFooter className="flex-shrink-0 gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onContinue()}>
            No thanks
          </Button>
          <Button onClick={() => onContinue()}>
            Continue to checkout
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
