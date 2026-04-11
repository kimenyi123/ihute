"use client"

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
import { generalSellingPrice, normalizeItemEmballageForCart } from "@/lib/package-price"
import Image from "next/image"

export type CartSuggestionItem = {
  product_id: string
  name: string
  price: number
  item_emballage?: string | number
  ITEM_EMBALLAGE?: string | number
  image_url?: string
  reason?: string
  confidence?: number
  supplier_id?: string
  supplier_name?: string
  item_code?: string
}

const INITIAL_SHOW = 3
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
                        {generalSellingPrice(
                          s.price,
                          s.item_emballage ?? s.ITEM_EMBALLAGE
                        ).toLocaleString()}{" "}
                        {DEFAULT_CURRENCY}
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
