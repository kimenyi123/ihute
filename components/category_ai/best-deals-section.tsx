"use client"

import { useState, useEffect } from "react"
import { ProductCard } from "@/components/product-card"
import type { ProductBadgeType } from "@/components/product-badges"

const BURROWS_NICKNAME = "burrows"

type Product = {
  id: string
  name: string
  price: number
  unit?: string
  image?: string
  supplierId?: string
  supplierName?: string
  supplierLocation?: string
  category?: string
  badges?: ProductBadgeType[]
  stockQuantity?: number
  marginPercent?: number
  distanceLabel?: string
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * Best Deals: fetches Burrows products (they have images), shuffles them,
 * and shows "Best deals for you" with war-style cards (badges + Buy Now).
 * No "From PANGOLIN'S BURROWS" header.
 */
export function BestDealsSection() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true
    async function load() {
      try {
        const res = await fetch(
          `/api/shop-with-me?nickname=${encodeURIComponent(BURROWS_NICKNAME)}`,
          { cache: "no-store", headers: { "Cache-Control": "no-cache" } }
        )
        if (!isMounted || !res.ok) return
        const data = await res.json()
        const sellers = data.sellers || []
        const list: Product[] = []
        const seen = new Set<string>()
        for (const seller of sellers) {
          const items = seller.products || []
          const supplierName = seller.OWNER || seller.supplier_name || "Burrows"
          const supplierId = seller.ISHYIGA_ACCOUNT || seller.supplier_account || ""
          for (const p of items) {
            const code = p.item_code || p.ITEM_CODE || p.item_commercial_name || ""
            if (seen.has(code)) continue
            seen.add(code)
            const rawPrice =
              p.selling_price ?? p.price ?? p.item_emballage ?? p.SALE_PRICE_INCLUSIVE ?? (p as any).PRICE ?? 0
            const price = typeof rawPrice === "number" ? rawPrice : parseFloat(String(rawPrice).replace(/[^\d.,]/g, "").replace(",", ".")) || 0
            if (price <= 0) continue
            const img = p.image_url ?? p.item_image_url ?? p.image ?? p.IMAGE_URL
            list.push({
              id: code || `deal-${list.length}`,
              name: p.item_commercial_name ?? p.ITEM_NAME ?? p.item_name ?? "Product",
              price,
              unit: p.item_packet ?? p.UNIT ?? "",
              image: typeof img === "string" ? img : undefined,
              supplierId,
              supplierName,
              supplierLocation: seller.loc_cell ?? seller.supplier_location ?? "",
              category: p.famille ?? p.FAMILLE ?? p.item_department,
              badges: ["best-price", "nearby", "low-stock", "margin"],
              stockQuantity: 3,
              marginPercent: 18,
              distanceLabel: "1.2km away",
            })
          }
        }
        const shuffled = shuffle(list).slice(0, 12)
        if (isMounted) setProducts(shuffled)
      } catch {
        if (isMounted) setProducts([])
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    load()
    return () => { isMounted = false }
  }, [])

  if (loading) {
    return (
      <section className="py-8">
        <div className="container mx-auto px-4">
          <h2 className="text-xl font-semibold mb-4">Best deals for you</h2>
          <div className="text-center py-12 text-muted-foreground text-sm">Loading deals…</div>
        </div>
      </section>
    )
  }

  if (products.length === 0) {
    return (
      <section className="py-8">
        <div className="container mx-auto px-4">
          <h2 className="text-xl font-semibold mb-4">Best deals for you</h2>
          <div className="text-center py-12 text-muted-foreground text-sm">No deals right now. Check back later.</div>
        </div>
      </section>
    )
  }

  return (
    <section className="py-8">
      <div className="container mx-auto px-4">
        <h2 className="text-xl font-semibold mb-4">Best deals for you</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {products.map((p) => (
            <ProductCard
              key={p.id}
              product={{
                ...p,
                currency: "RWF",
                inStock: true,
                itemCode: p.id,
              }}
              compact
            />
          ))}
        </div>
      </div>
    </section>
  )
}
