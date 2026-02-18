// lib/favorites-store.ts
"use client"

import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import { trackInteraction } from "./interaction-tracker"

// what we save for each favorite (snapshot at the time of hearting)
export type FavoriteItem = {
  id: string
  name: string
  price: number
  unit?: string
  image?: string
  description?: string
  addedAt?: string

  supplierId?: string
  supplierName?: string
  supplierLocation?: string
  momo?: string
  inStock?: boolean
  supplierDistanceKm?: number
  supplierRating?: number
  supplierBadge?: string
  deliveryEtaMin?: number
}

type FavoritesState = {
  favorites: FavoriteItem[]

  addFavorite: (item: FavoriteItem) => void
  removeFavorite: (productId: string, supplierId?: string) => void
  isFavorite: (productId: string, supplierId?: string) => boolean
  toggleFavorite: (item: FavoriteItem) => void
  setFavorites: (items: FavoriteItem[]) => void
  clearFavorites: () => void

  // handy helpers
  count: () => number
  getGroupsBySeller: () => Array<{
    supplierId: string
    supplierName: string
    supplierLocation?: string
    supplierDistanceKm?: number
    supplierRating?: number
    supplierBadge?: string
    deliveryEtaMin?: number
    items: FavoriteItem[]
  }>
}

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      favorites: [],

  addFavorite: (item) => {
    // Track favorite interaction
    trackInteraction("favorite", "product", item.id, {
      entityName: item.name,
      metadata: {
        supplierId: item.supplierId,
        price: item.price,
      },
    })
    
    return set((state) => {
      const supplierId = item.supplierId || "unknown"
      if (state.favorites.some((f) => f.id === item.id && (f.supplierId || "unknown") === supplierId)) return state
      const next = { ...item, addedAt: item.addedAt || new Date().toISOString() }
      return { favorites: [next, ...state.favorites] }
    })
  },

  removeFavorite: (productId, supplierId) => {
    // Note: We don't track unfavorite as a separate interaction
    // The absence of favorite interactions will naturally decay
    return set((state) => ({
      favorites: state.favorites.filter((f) => {
        if (f.id !== productId) return true
        if (!supplierId) return false
        return (f.supplierId || "unknown") !== supplierId
      }),
    }))
  },

  isFavorite: (productId, supplierId) =>
    get().favorites.some((f) => {
      if (f.id !== productId) return false
      if (!supplierId) return true
      return (f.supplierId || "unknown") === supplierId
    }),

  toggleFavorite: (item) => {
    const { isFavorite, removeFavorite, addFavorite } = get()
    if (isFavorite(item.id, item.supplierId)) removeFavorite(item.id, item.supplierId)
    else addFavorite(item)
  },

  setFavorites: (items) => set({ favorites: items }),
  clearFavorites: () => set({ favorites: [] }),

  count: () => get().favorites.length,

  getGroupsBySeller: () => {
    const groups = new Map<
      string,
      {
        supplierId: string
        supplierName: string
        supplierLocation?: string
        supplierDistanceKm?: number
        supplierRating?: number
        supplierBadge?: string
        deliveryEtaMin?: number
        items: FavoriteItem[]
      }
    >()
    for (const it of get().favorites) {
      const sid = it.supplierId || "unknown"
      const g =
        groups.get(sid) ??
        {
          supplierId: sid,
          supplierName: it.supplierName || "Supplier",
          supplierLocation: it.supplierLocation,
          supplierDistanceKm: it.supplierDistanceKm,
          supplierRating: it.supplierRating,
          supplierBadge: it.supplierBadge,
          deliveryEtaMin: it.deliveryEtaMin,
          items: [],
        }
      g.items.push(it)
      groups.set(sid, g)
    }
    return Array.from(groups.values())
  },
    }),
    {
      name: "ihute-favorites-storage",
      storage: createJSONStorage(() => localStorage),
    }
  )
)
