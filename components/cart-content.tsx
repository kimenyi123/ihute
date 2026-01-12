"use client"

import { useCartStore } from "@/lib/cart-store"
import { CartItemCard } from "@/components/cart-item-card"
import { CartSummary } from "@/components/cart-summary"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ShoppingBag, ArrowLeft, Search } from "lucide-react"
import Link from "next/link"
import { useState, useEffect } from "react"
import { RecommendationCarousel } from "@/components/recommendation-carousel"

export function CartContent() {
  const items = useCartStore((state) => state.items)
  const [searchQuery, setSearchQuery] = useState("")

  // Track cart activity when page loads (for abandoned cart tracking)
  useEffect(() => {
    // Only track if cart has items
    if (items.length > 0) {
      // Get email from auth store
      let userEmail: string | null = null
      try {
        const authStorage = localStorage.getItem('auth-storage')
        if (authStorage) {
          const authData = JSON.parse(authStorage)
          userEmail = authData?.state?.user?.email || null
        }
      } catch (e) {
        console.error('[Abandoned Cart] Error reading auth storage:', e)
      }

      if (userEmail) {
        console.log('[Abandoned Cart] Cart page loaded with', items.length, 'items for', userEmail)

        // Calculate cart total
        const cartTotal = items.reduce((sum, item) => sum + (item.price * item.qty), 0)

        // Prepare cart items for backend (for email display)
        const cartItemsJson = JSON.stringify(items.map(item => ({
          name: item.name,
          quantity: item.qty,
          price: item.price,
          total: item.price * item.qty
        })))

        fetch('http://localhost:8080/Trading/OrdersServlet?action=trackCartActivity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            buyerEmail: userEmail,
            itemCount: items.length.toString(),
            cartValue: cartTotal.toString(),
            currency: 'RWF',
            cartItems: cartItemsJson
          })
        })
          .then(response => {
            console.log('[Abandoned Cart] Page load tracking status:', response.status)
            return response.json()
          })
          .then(data => {
            console.log('[Abandoned Cart] Page load tracking success:', data)
          })
          .catch(error => {
            console.error('[Abandoned Cart] Page load tracking error:', error)
          })
      } else {
        console.warn('[Abandoned Cart] Cart page loaded but no user email found in auth storage')
      }
    }
  }, [items.length]) // Run when items.length changes (including when loaded from localStorage)

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 rounded-full bg-muted p-6">
          <ShoppingBag className="h-12 w-12 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Your cart is empty</h2>
        <p className="text-muted-foreground mb-6">Add some products to get started</p>
        <Link href="/">
          <Button className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Continue Shopping
          </Button>
        </Link>
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

          {/* Recommendations related to items in cart (fallback: trending) */}
          <RecommendationCarousel
            title="You might also like"
            type="alsoBought"
            className="mt-6"
          />
        </div>

        <div className="lg:col-span-1">
          <CartSummary />
        </div>
      </div>
    </div>
  )
}
