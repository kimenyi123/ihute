"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useCartStore, type CartItem } from "@/lib/cart-store"
import { Lock } from "lucide-react"
import Image from "next/image"

const PLACEHOLDER = "/placeholder.svg?height=64&width=64"

function CheckoutSummaryItemRow({ item, lineTotal }: { item: CartItem; lineTotal: number }) {
  const [imgError, setImgError] = useState(false)
  const rawImage = item.image ?? (item as Record<string, unknown>).image_url ?? (item as Record<string, unknown>).item_image_url
  const validImage =
    rawImage &&
    typeof rawImage === "string" &&
    rawImage.trim() !== "" &&
    (rawImage.startsWith("http://") || rawImage.startsWith("https://") || rawImage.startsWith("/"))
  const src = !imgError && validImage ? (validImage as string).trim() : PLACEHOLDER
  const isRemote = /^https?:\/\//i.test(src)

  useEffect(() => {
    setImgError(false)
  }, [item.image])

  return (
    <div className="flex gap-3">
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
        {isRemote ? (
          <img
            src={src}
            alt={item.name}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
          />
        ) : (
          <Image
            src={src}
            alt={item.name}
            fill
            className="object-cover"
            onError={() => setImgError(true)}
            unoptimized={src === PLACEHOLDER}
          />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.name}</p>
        <p className="text-xs text-muted-foreground">
          {item.qty ?? 0} × {item.selectedUnit || item.unit || "pcs"}
        </p>
        <p className="text-sm font-semibold text-primary">
          {lineTotal.toLocaleString()} RWF
        </p>
      </div>
    </div>
  )
}

interface CheckoutSummaryProps {
  isProcessing: boolean
  showReview: boolean
}

export function CheckoutSummary({ isProcessing, showReview }: CheckoutSummaryProps) {
  const { items, getTotalItems, getTotalPrice } = useCartStore()

  const subtotal = getTotalPrice()
  const deliveryFee = subtotal > 50000 ? 0 : 2000
  const total = subtotal + deliveryFee

  return (
    <Card className="sticky top-20">
      <CardHeader>
        <CardTitle>Order Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {items.map((item) => {
            const lineTotal = item.price * (item.qty ?? 0)
            return (
              <CheckoutSummaryItemRow key={`${item.id}-${item.selectedUnit}`} item={item} lineTotal={lineTotal} />
            )
          })}
        </div>

        <Separator />

        {/* Pricing */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Subtotal ({getTotalItems()} items)</span>
            <span className="font-medium">{subtotal.toLocaleString()} RWF</span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Delivery Fee</span>
            <span className="font-medium">{deliveryFee === 0 ? "FREE" : `${deliveryFee.toLocaleString()} RWF`}</span>
          </div>

          {deliveryFee > 0 && (
            <p className="text-xs text-muted-foreground">
              Free delivery on orders over 50,000 RWF
            </p>
          )}
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <span className="font-semibold">Total</span>
          <span className="text-2xl font-bold text-primary">{total.toLocaleString()} RWF</span>
        </div>
      </CardContent>
      <CardFooter className="flex-col gap-3">
        <Button type="submit" className="w-full gap-2" size="lg" disabled={isProcessing}>
          <Lock className="h-4 w-4" />
          {isProcessing ? "Processing..." : showReview ? "Confirm & Pay" : "Review Order"}
        </Button>
        <p className="text-xs text-center text-muted-foreground">
          Your payment information is secure and encrypted
        </p>
      </CardFooter>
    </Card>
  )
}