// app/favorites/page.tsx
"use client"

import { useMemo, useEffect, useState } from "react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { ProductCard } from "@/components/product-card"
import { useFavoritesStore } from "@/lib/favorites-store"
import { useAuthStore } from "@/lib/auth-store"
import { getSessionId } from "@/lib/interaction-tracker"
import { Heart, Store, Sparkles, Clock } from "lucide-react"

type RecommendedProduct = {
  id: string
  name: string
  description?: string
  price: number
  unit?: string
  image?: string
  supplierId?: string
  supplierName?: string
  supplierLocation?: string
  momo?: string
  inStock?: boolean
  rating?: number
}

export default function FavoritesPage() {
  // subscribe only to the pieces we need
  const favorites = useFavoritesStore((s) => s.favorites)
  const getGroupsBySeller = useFavoritesStore((s) => s.getGroupsBySeller)
  const { user } = useAuthStore()

  // compute groups outside the selector to avoid the "getSnapshot" loop
  const groups = useMemo(() => getGroupsBySeller(), [getGroupsBySeller, favorites])

  const total = favorites.length

  // Recommendations state
  const [similarItems, setSimilarItems] = useState<RecommendedProduct[]>([])
  const [previouslyViewed, setPreviouslyViewed] = useState<RecommendedProduct[]>([])
  const [loadingRecommendations, setLoadingRecommendations] = useState(false)

  // Load recommendations
  useEffect(() => {
    if (total > 0) {
      loadRecommendations()
    }
  }, [total, user])

  async function loadRecommendations() {
    setLoadingRecommendations(true)
    try {
      const userId = user?.email || null
      const sessionId = getSessionId()

      // Get similar items based on favorites
      if (favorites.length > 0) {
        const favoriteIds = favorites.map(f => f.id)
        const firstFavorite = favorites[0]

        // Get similar items
        const similarRes = await fetch("/api/personalization/recommendations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "getSimilarItems",
            userId,
            sessionId,
            entityId: firstFavorite.id,
            entityType: "product",
            limit: 12,
          }),
        })

        if (similarRes.ok) {
          const similarData = await similarRes.json()
          if (similarData.ok && similarData.similar) {
            // Fetch product details (placeholder - implement based on your API)
            const products = await fetchProductDetails(
              similarData.similar.map((s: any) => s.id).filter((id: string) => !favoriteIds.includes(id))
            )
            setSimilarItems(products)
          }
        }

        // Get previously viewed but not favorited
        const viewedRes = await fetch(
          `/api/personalization/recommendations?action=getRecommendations&limit=12${userId ? `&userId=${userId}` : `&sessionId=${sessionId}`}`
        )

        if (viewedRes.ok) {
          const viewedData = await viewedRes.json()
          if (viewedData.ok && viewedData.products) {
            const products = await fetchProductDetails(
              viewedData.products.filter((id: string) => !favoriteIds.includes(id))
            )
            setPreviouslyViewed(products)
          }
        }
      }
    } catch (error) {
      console.error("Error loading recommendations:", error)
    } finally {
      setLoadingRecommendations(false)
    }
  }

  async function fetchProductDetails(productIds: string[]): Promise<RecommendedProduct[]> {
    if (productIds.length === 0) return []
    
    // Placeholder - implement based on your product API
    // This should fetch actual product details from your backend
    return []
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Heart className="h-8 w-8 text-red-500 fill-red-500" />
            <h1 className="text-3xl font-bold text-foreground">My Favorites</h1>
          </div>
          <p className="text-muted-foreground">
            {total} {total === 1 ? "item" : "items"} saved
          </p>
        </div>

        {total === 0 ? (
          <div className="text-center py-16">
            <Heart className="h-16 w-16 text-slate-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-600 mb-2">
              No favorites yet
            </h2>
            <p className="text-slate-500">
              Tap the heart on any product to save it here.
            </p>
          </div>
        ) : (
          <div className="space-y-10">
            {/* Your Favorites */}
            {groups.map((g) => (
              <section key={g.supplierId}>
                <div className="mb-3 flex items-center gap-2">
                  <Store className="h-5 w-5 text-muted-foreground" />
                  <h2 className="text-lg font-semibold">
                    {g.supplierName}
                    {g.supplierLocation ? ` — ${g.supplierLocation}` : ""}
                  </h2>
                  <span className="text-sm text-muted-foreground">
                    ({g.items.length} {g.items.length === 1 ? "item" : "items"})
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                  {g.items.map((p) => (
                    <ProductCard
                      key={p.id}
                      product={{
                        id: p.id,
                        name: p.name,
                        description: p.description,
                        price: p.price,
                        unit: p.unit,
                        image: p.image,
                        supplierId: p.supplierId,
                        supplierName: p.supplierName,
                        supplierLocation: p.supplierLocation,
                        momo: p.momo,
                        inStock: true,
                        rating: 4,
                      }}
                    />
                  ))}
                </div>
              </section>
            ))}

            {/* Similar Items */}
            {similarItems.length > 0 && (
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-muted-foreground" />
                  <h2 className="text-lg font-semibold">You Might Also Like</h2>
                  <span className="text-sm text-muted-foreground">
                    Similar to your favorites
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                  {similarItems.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              </section>
            )}

            {/* Previously Viewed */}
            {previouslyViewed.length > 0 && (
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <h2 className="text-lg font-semibold">Previously Viewed</h2>
                  <span className="text-sm text-muted-foreground">
                    Items you've browsed but haven't favorited yet
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                  {previouslyViewed.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              </section>
            )}

            {loadingRecommendations && (
              <div className="text-center py-8 text-muted-foreground">
                Loading recommendations...
              </div>
            )}
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
