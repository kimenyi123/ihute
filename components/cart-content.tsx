"use client"

import { useEffect, useState } from "react"
import { useCartStore } from "@/lib/cart-store"
import { CartItemCard } from "@/components/cart-item-card"
import { CartSummary } from "@/components/cart-summary"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ShoppingBag, ArrowLeft, Search, ScanBarcode } from "lucide-react"
import Link from "next/link"
import { CartAlsoBuy } from "@/components/cart-also-buy"
import { BarcodeScanner } from "@/components/barcode-scanner"
import { useToast } from "@/components/ui/use-toast"
import { usePriceDropToasts } from "@/lib/use-price-drop-toasts"

export function CartContent() {
  const items = useCartStore((state) => state.items)
  const addItem = useCartStore((state) => state.addItem)
  const mergeDuplicateCartLines = useCartStore((state) => state.mergeDuplicateCartLines)
  const [searchQuery, setSearchQuery] = useState("")
  const [barcodeOpen, setBarcodeOpen] = useState(false)
  const { toast } = useToast()

  // Notify when a watched item's price is below what the user watched (cart load)
  const priceCheckItems = items.map((i) => ({
    productId: i.id,
    supplierId: i.supplierId,
    currentPrice: i.price,
    name: i.name,
  }))
  usePriceDropToasts(priceCheckItems)

  // Merge duplicate lines (same product code or name from same seller) when cart is opened
  useEffect(() => {
    mergeDuplicateCartLines?.()
  }, [mergeDuplicateCartLines])

  const handleBarcodeScan = async (barcode: string) => {
    if (!barcode.trim()) return
    try {
      const res = await fetch(
        `/api/fetchSuggestions?globalSearch=${encodeURIComponent(barcode.trim())}&limit=5`
      )
      const data = await res.json().catch(() => ({}))
      const products = data?.products ?? []
      const first = products[0]
      if (!first) {
        toast({ title: "Product not found", description: `No product for code "${barcode.trim()}"`, variant: "destructive" })
        return
      }
      const name = first.item_commercial_name ?? first.ITEM_NAME ?? "Product"
      const price = Number(first.selling_price ?? first.UNIT_PRICE ?? 0) || 0
      const code = first.item_key_words ?? first.item_code ?? first.ITEM_CODE ?? first.id ?? barcode
      const supplierId = (first.supplier_account ?? first.seller_account ?? "unknown").toString().trim()
      const supplierName = first.supplier_name ?? first.OWNER ?? "Supplier"
      addItem({
        id: code,
        itemCode: code,
        name,
        price,
        unit: first.item_packet ?? "",
        image: first.image_url ?? first.image ?? first.item_image_url,
        supplierId,
        supplierName,
        supplierLocation: first.supplier_location,
        momo: first.momo,
      }, 1)
      toast({ title: "Added to cart", description: name })
    } catch {
      toast({ title: "Could not add product", variant: "destructive" })
    }
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 rounded-full bg-muted p-6">
          <ShoppingBag className="h-12 w-12 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Your cart is empty</h2>
        <p className="text-muted-foreground mb-6">Add some products to get started</p>
        <div className="flex flex-wrap gap-2 justify-center">
          <Button className="gap-2" asChild>
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
              Continue Shopping
            </Link>
          </Button>
          {/*<Button variant="outline" className="gap-2" onClick={() => setBarcodeOpen(true)}>
            <ScanBarcode className="h-4 w-4" />
            Scan barcode
          </Button>
          */}
        </div>
        <BarcodeScanner open={barcodeOpen} onOpenChange={setBarcodeOpen} onScan={handleBarcodeScan} />
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
        <div className="flex items-center gap-2">
          {/*<Button variant="outline" size="sm" className="gap-2" onClick={() => setBarcodeOpen(true)}>
            <ScanBarcode className="h-4 w-4" />
            Add by barcode
          </Button>
*/}
          <p className="text-sm text-muted-foreground">{items.length} items</p>
        </div>
      </div>
      <BarcodeScanner open={barcodeOpen} onOpenChange={setBarcodeOpen} onScan={handleBarcodeScan} />

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
