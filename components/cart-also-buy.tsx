"use client"

import { useEffect, useState } from "react"
import { ProductCard } from "@/components/product-card"
import type { CartItem } from "@/lib/cart-store"
import { Sparkles, Loader2 } from "lucide-react"

type Product = {
  id: string
  name: string
  description?: string
  price: number
  unit?: string
  image?: string
  /** Product code for cart merge (same code + same seller = one line) */
  itemCode?: string
  supplierId?: string
  supplierName?: string
  supplierLocation?: string
  momo?: string
  inStock?: boolean
}

const MAX_PRODUCTS = 8

function parsePrice(value: unknown): number {
  if (typeof value === "number") return value
  const s = String(value ?? "").replace(/[^\d.,]/g, "").replace(",", ".")
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

/**
 * "You can also buy" / fast-moving section on cart.
 *
 * Logic: Fast-moving = most liked to be ordered (most frequently ordered / popular).
 * 1. We first call RecommendationServlet (getRecommendations) so the backend can return
 *    products ranked by order frequency / popularity.
 * 2. We resolve those product names to full details via fetchSuggestions, exclude cart
 *    items, then show up to MAX_PRODUCTS.
 * 3. If recommendations fail or return nothing, we fall back to "related by same seller":
 *    fetchSuggestions by the first cart item's supplier name.
 */
export function CartAlsoBuy({ cartItems }: { cartItems: CartItem[] }) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  const firstSupplierName = cartItems[0]?.supplierName?.trim() || ""

  useEffect(() => {
    let cancelled = false
    const excludeIdsNow = new Set(cartItems.flatMap((i) => [(i.itemCode ?? i.id).toString().trim(), i.id].filter(Boolean)))
    const excludeNamesNow = new Set(cartItems.map((i) => i.name.trim().toLowerCase()))

    function rawToProduct(p: any, fallbackId: string): Product | null {
      const code = String(p.ITEM_CODE ?? p.item_code ?? p.id ?? "").trim()
      const name = String(p.ITEM_NAME ?? p.item_commercial_name ?? p.name ?? "").trim()
      if (!name) return null
      const key = (code || fallbackId).toLowerCase()
      const id = code || key
      const price = parsePrice(p.selling_price ?? p.SALE_PRICE_INCLUSIVE ?? p.price)
      const supplierIdRaw = (p.SELLER_ISHYIGA_ACCOUNT ?? p.item_seller_account ?? "").toString().trim()
      const supplierNameRaw = (p.SELLER_NAMES ?? p.supplier_name ?? "").toString().trim()
      return {
        id,
        itemCode: code || id,
        name,
        price,
        unit: p.UNIT ?? p.item_packet ?? "",
        image: p.image_url ?? p.item_image_url ?? p.IMAGE_URL ?? p.image,
        supplierId: p.SELLER_ISHYIGA_ACCOUNT ?? p.item_seller_account ?? supplierIdRaw ?? "",
        supplierName: p.SELLER_NAMES ?? p.supplier_name ?? supplierNameRaw ?? "",
        supplierLocation: p.LOCATION ?? p.supplier_location,
        momo: p.momo,
        inStock: true,
      }
    }

    // Use first cart item's supplierId when product is from same seller so "You can also buy" adds to same checkout group
    function normalizeSupplierId(products: Product[]): Product[] {
      if (cartItems.length === 0) return products
      return products.map((prod) => {
        const sameSeller = cartItems.find(
          (c) =>
            (c.supplierName?.trim().toLowerCase() === prod.supplierName?.trim().toLowerCase()) ||
            (c.supplierId?.trim().toLowerCase() === prod.supplierId?.trim().toLowerCase())
        )
        if (sameSeller) {
          return { ...prod, supplierId: sameSeller.supplierId }
        }
        return prod
      })
    }

    async function loadFromSuggestions(searchTerm: string): Promise<Product[]> {
      const res = await fetch(
        `/api/fetchSuggestions?globalSearch=${encodeURIComponent(searchTerm)}&limit=${MAX_PRODUCTS + 4}&Currency=RWF`,
        { cache: "no-store" }
      )
      if (!res.ok) return []
      const data = await res.json()
      const raw = (data.products || []) as any[]
      const seen = new Set<string>()
      const list: Product[] = []
      for (const p of raw) {
        const prod = rawToProduct(p, "k")
        if (!prod) continue
        const key = (prod.id || prod.name).toLowerCase()
        if (seen.has(key)) continue
        if (excludeIdsNow.has(prod.id) || excludeNamesNow.has(prod.name.toLowerCase())) continue
        seen.add(key)
        list.push(prod)
        if (list.length >= MAX_PRODUCTS) break
      }
      return list
    }

    async function load() {
      setLoading(true)
      try {
        // 1) Fast-moving = most ordered: get recommendation names from backend
        const recRes = await fetch(
          `/api/personalization/recommendations?action=getRecommendations&limit=${MAX_PRODUCTS + 4}`,
          { cache: "no-store" }
        )
        let list: Product[] = []
        if (!cancelled && recRes.ok) {
          const recData = await recRes.json()
          const names = recData?.products
          if (Array.isArray(names) && names.length > 0) {
            const seen = new Set<string>()
            for (let i = 0; i < Math.min(names.length, MAX_PRODUCTS + 2); i++) {
              if (cancelled) break
              const raw = names[i]
              const productName = (typeof raw === "string"
                ? raw
                : raw && typeof raw === "object" && (raw.name ?? raw.productName ?? raw.id)
                  ? String((raw as any).name ?? (raw as any).productName ?? (raw as any).id)
                  : ""
              ).trim()
              if (!productName || excludeNamesNow.has(productName.toLowerCase())) continue
              try {
                const sugRes = await fetch(
                  `/api/fetchSuggestions?globalSearch=${encodeURIComponent(productName)}&limit=3&Currency=RWF`,
                  { cache: "no-store" }
                )
                if (!sugRes.ok) continue
                const sugData = await sugRes.json()
                const rawList = (sugData.products || []) as any[]
                for (const p of rawList) {
                  const prod = rawToProduct(p, productName)
                  if (!prod) continue
                  const key = (prod.id || prod.name).toLowerCase()
                  if (seen.has(key)) continue
                  if (excludeIdsNow.has(prod.id) || excludeNamesNow.has(prod.name.toLowerCase())) continue
                  seen.add(key)
                  list.push(prod)
                  break
                }
              } catch {
                // skip this name
              }
            }
          }
        }

        // 2) Fallback: related by same seller (or generic "product" search)
        if (!cancelled && list.length === 0) {
          const searchTerm = firstSupplierName || "product"
          list = await loadFromSuggestions(searchTerm)
        }

        if (!cancelled) setProducts(normalizeSupplierId(list).slice(0, MAX_PRODUCTS))
      } catch (e) {
        if (!cancelled) setProducts([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [firstSupplierName, cartItems.map((i) => i.id).sort().join(",")])

  if (loading) {
    return (
      <section className="rounded-lg border bg-card p-4">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
          <Sparkles className="h-5 w-5 text-muted-foreground" />
          You can also buy
        </h2>
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </section>
    )
  }

  if (products.length === 0) return null

  return (
    <section className="rounded-lg border bg-card p-4">
      <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
        <Sparkles className="h-5 w-5 text-muted-foreground" />
        You can also buy
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  )
}
