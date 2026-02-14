"use client"

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useCartStore } from "@/lib/cart-store"
import { Lock } from "lucide-react"
import Image from "next/image"

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
        {/* Items List */}
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {items.map((item) => {
            // ✅ Calculate line total: price × quantity
            const lineTotal = item.price * (item.qty ?? 0)

            return (
              <div key={`${item.id}-${item.selectedUnit}`} className="flex gap-3">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                  <Image
                    src={item.image || "/placeholder.svg"}
                    alt={item.name}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {/* ✅ Use quantity property */}
                    {item.qty ?? 0} × {item.selectedUnit || item.unit || "pcs"}
                  </p>
                  <p className="text-sm font-semibold text-primary">
                    {/* ✅ Use calculated lineTotal */}
                    {lineTotal.toLocaleString()} RWF
                  </p>
                </div>
              </div>
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