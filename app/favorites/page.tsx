// app/favorites/page.tsx
"use client"

import { useMemo, useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useFavoritesStore } from "@/lib/favorites-store"
import { useAuthStore } from "@/lib/auth-store"
import { useCartStore } from "@/lib/cart-store"
import { fetchFavorites, flattenFavoriteGroups, removeFavoriteApi, trackFavoriteEvent } from "@/lib/favorites-api"
import { Heart, Store, MapPin, Star, ShieldCheck, Clock } from "lucide-react"

export default function FavoritesPage() {
  const favorites = useFavoritesStore((s) => s.favorites)
  const getGroupsBySeller = useFavoritesStore((s) => s.getGroupsBySeller)
  const setFavorites = useFavoritesStore((s) => s.setFavorites)
  const removeFavorite = useFavoritesStore((s) => s.removeFavorite)
  const addToCart = useCartStore((s) => s.addItem)
  const { user, isAuthenticated } = useAuthStore()

  const [loading, setLoading] = useState(false)

  const groups = useMemo(() => getGroupsBySeller(), [getGroupsBySeller, favorites])
  const total = favorites.length

  useEffect(() => {
    if (!isAuthenticated) return
    let active = true
    setLoading(true)
    fetchFavorites()
      .then((data) => {
        if (!active) return
        setFavorites(flattenFavoriteGroups(data))
      })
      .catch((err) => console.warn("[Favorites] Refresh failed:", err))
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [isAuthenticated, setFavorites])

  const handleRemove = async (productId: string, supplierId?: string) => {
    if (!supplierId) return
    try {
      if (isAuthenticated && user) {
        await removeFavoriteApi({ productId, supplierId })
      }
      removeFavorite(productId, supplierId)
    } catch (err) {
      console.warn("[Favorites] Remove failed:", err)
    }
  }

  const handleAddToCart = async (item: (typeof favorites)[number]) => {
    addToCart(
      {
        id: item.id,
        name: item.name,
        price: item.price,
        unit: item.unit,
        image: item.image,
        supplierId: item.supplierId || "unknown",
        supplierName: item.supplierName || "Supplier",
        supplierLocation: item.supplierLocation,
        momo: item.momo,
        selectedUnit: item.unit,
      },
      1
    )
    try {
      await trackFavoriteEvent({
        eventType: "favorite_to_cart",
        productId: item.id,
        supplierId: item.supplierId,
      })
    } catch {
      // best-effort
    }
  }

  const handleAddAllFromSupplier = async (items: (typeof favorites)[number][]) => {
    for (const item of items) {
      await handleAddToCart(item)
    }
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
            <h2 className="text-xl font-semibold text-slate-600 mb-2">No favorites yet</h2>
            <p className="text-slate-500">Tap the heart on any product to save it here.</p>
          </div>
        ) : (
          <div className="space-y-10">
            {groups.map((g) => (
              <section key={g.supplierId} className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Store className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <h2 className="text-lg font-semibold">
                        {g.supplierName}
                        {g.supplierLocation ? ` — ${g.supplierLocation}` : ""}
                      </h2>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        {g.supplierDistanceKm !== undefined && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {g.supplierDistanceKm.toFixed(1)} km
                          </span>
                        )}
                        {g.supplierRating !== undefined && (
                          <span className="inline-flex items-center gap-1">
                            <Star className="h-3.5 w-3.5" />
                            {g.supplierRating.toFixed(1)}
                          </span>
                        )}
                        {g.deliveryEtaMin !== undefined && (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {g.deliveryEtaMin} min ETA
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {g.supplierBadge && (
                      <Badge variant="secondary" className="gap-1">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        {g.supplierBadge}
                      </Badge>
                    )}
                    <Button variant="outline" size="sm" onClick={() => handleAddAllFromSupplier(g.items)}>
                      Add all to cart
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  {g.items.map((p) => {
                    const inStock = p.inStock !== false
                    return (
                      <div
                        key={`${p.id}-${p.supplierId || "unknown"}`}
                        className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:items-center"
                      >
                        <div className="relative h-20 w-20 flex-none overflow-hidden rounded-md bg-muted">
                          <Image
                            fill
                            src={p.image || "/placeholder.svg?height=160&width=160"}
                            alt={p.name}
                            className="object-cover"
                          />
                        </div>

                        <div className="flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <h3 className="text-sm font-semibold">{p.name}</h3>
                              {p.description && <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>}
                            </div>
                            <div className="text-sm font-semibold">
                              {p.price.toLocaleString()}{" "}
                              <span className="text-muted-foreground">{p.unit ? ` / ${p.unit}` : ""}</span>
                            </div>
                          </div>
                          <div className="mt-2 flex items-center gap-2 text-xs">
                            <Badge variant={inStock ? "secondary" : "destructive"}>
                              {inStock ? "In stock" : "Out of stock"}
                            </Badge>
                            {p.deliveryEtaMin !== undefined && (
                              <span className="text-muted-foreground">{p.deliveryEtaMin} min delivery ETA</span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <Button size="sm" onClick={() => handleAddToCart(p)} disabled={!inStock}>
                            Add to cart
                          </Button>
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/products/${p.id}`}>View product</Link>
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleRemove(p.id, p.supplierId)}>
                            Remove
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        {loading && (
          <div className="text-center py-8 text-muted-foreground">
            Refreshing favorites...
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
