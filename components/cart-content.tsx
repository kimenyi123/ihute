"use client"

import { useCartStore } from "@/lib/cart-store"
import { CartItemCard } from "@/components/cart-item-card"
import { CartSummary } from "@/components/cart-summary"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ShoppingBag, ArrowLeft, Search } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { CartAlsoBuy } from "@/components/cart-also-buy"

export function CartContent() {
  const items = useCartStore((state) => state.items)
  const [searchQuery, setSearchQuery] = useState("")

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 rounded-full bg-muted p-6">
          <ShoppingBag className="h-12 w-12 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Your cart is empty</h2>
        <p className="text-muted-foreground mb-6">Add some products to get started</p>
        <Button className="gap-2" asChild>
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
            Continue Shopping
          </Link>
        </Button>
      </div>
    )
  }

  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-foreground">Shopping Cart</h1>
        <p className="text-sm text-muted-foreground">{items.length} items</p>
      </div>

      {/* NEW: Global search bar (search across all products & sellers) */}
      {/* <GlobalSearch placeholder="Search all products & sellers…" className="max-w-xl" /> */}

      {/* Local filter (only filters items already in cart) */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Filter items in this cart…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Cart items + Summary */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {filteredItems.length > 0 ? (
            filteredItems.map((item) => (
              <CartItemCard key={`${item.id}-${item.selectedUnit}`} item={item} />
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No products found matching “{searchQuery}”
            </div>
          )}
          <CartAlsoBuy cartItems={items} />
        </div>

        <div className="lg:col-span-1">
          <CartSummary />
        </div>
      </div>
    </div>
  )
}
