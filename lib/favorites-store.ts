// lib/favorites-store.ts
"use client"

import { create } from "zustand"

// what we save for each favorite (snapshot at the time of hearting)
export type FavoriteItem = {
  id: string
  name: string
  price: number
  unit?: string
  image?: string
  description?: string

  supplierId?: string
  supplierName?: string
  supplierLocation?: string
  momo?: string
}

type FavoritesState = {
  favorites: FavoriteItem[]

  addFavorite: (item: FavoriteItem) => void
  removeFavorite: (productId: string) => void
  isFavorite: (productId: string) => boolean
  toggleFavorite: (item: FavoriteItem) => void

  // handy helpers
  count: () => number
  getGroupsBySeller: () => Array<{
    supplierId: string
    supplierName: string
    supplierLocation?: string
    items: FavoriteItem[]
  }>
}

export const useFavoritesStore = create<FavoritesState>()((set, get) => ({
  favorites: [],

  addFavorite: (item) =>
    set((state) => {
      if (state.favorites.some((f) => f.id === item.id)) return state
      return { favorites: [item, ...state.favorites] }
    }),

  removeFavorite: (productId) =>
    set((state) => ({
      favorites: state.favorites.filter((f) => f.id !== productId),
    })),

  isFavorite: (productId) => get().favorites.some((f) => f.id === productId),

  toggleFavorite: (item) => {
    const { isFavorite, removeFavorite, addFavorite } = get()
    if (isFavorite(item.id)) removeFavorite(item.id)
    else addFavorite(item)
  },

  count: () => get().favorites.length,

  getGroupsBySeller: () => {
    const groups = new Map<
      string,
      { supplierId: string; supplierName: string; supplierLocation?: string; items: FavoriteItem[] }
    >()
    for (const it of get().favorites) {
      const sid = it.supplierId || "unknown"
      const g =
        groups.get(sid) ??
        {
          supplierId: sid,
          supplierName: it.supplierName || "Supplier",
          supplierLocation: it.supplierLocation,
          items: [],
        }
      g.items.push(it)
      groups.set(sid, g)
    }
    return Array.from(groups.values())
  },
}))
