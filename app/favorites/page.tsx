// app/favorites/page.tsx
"use client"

import { useMemo } from "react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { ProductCard } from "@/components/product-card"
import { useFavoritesStore } from "@/lib/favorites-store"
import { Heart, Store } from "lucide-react"

export default function FavoritesPage() {
  // subscribe only to the pieces we need
  const favorites = useFavoritesStore((s) => s.favorites)
  const getGroupsBySeller = useFavoritesStore((s) => s.getGroupsBySeller)

  // compute groups outside the selector to avoid the "getSnapshot" loop
  const groups = useMemo(() => getGroupsBySeller(), [getGroupsBySeller, favorites])

  const total = favorites.length

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
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
