"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

export type WatchedItem = {
  productId: string
  supplierId: string
  name: string
  priceWhenWatched: number
  addedAt: number
  /** Target price - alert when current price hits this */
  targetPrice?: number
  /** Auto-remove after purchase */
  autoRemoveAfterPurchase?: boolean
  /** Resolved image URL (same as search/shop-with-me: image_url from backend). */
  image?: string
  /** Backend image_url / item_image_url — same source as /search and shop-with-me. */
  image_url?: string
  /** Seller/supplier display name (e.g. from product card). */
  supplierName?: string
}

/** Session-only set of "productId|supplierId" we already showed a price-drop toast for. */
const notifiedPriceDropKeys = new Set<string>()

type PriceWatchState = {
  watched: WatchedItem[]
  /** Global setting: auto-remove items after purchase */
  autoRemoveAfterPurchase: boolean
  setAutoRemoveAfterPurchase: (value: boolean) => void
  addWatch: (item: Omit<WatchedItem, "addedAt">) => void
  removeWatch: (productId: string, supplierId: string) => void
  updateWatch: (productId: string, supplierId: string, updates: Partial<WatchedItem>) => void
  isWatched: (productId: string, supplierId?: string) => boolean
  getWatched: () => WatchedItem[]
  /** Alias for getWatched (e.g. favorites page). */
  getItems: () => WatchedItem[]
  /** Returns the watched item if this product is watched and current price is lower than when watched. */
  checkPriceDrop: (productId: string, supplierId: string, currentPrice: number) => WatchedItem | null
  checkPriceDrops: (currentPrices: { productId: string; supplierId: string; currentPrice: number }[]) => WatchedItem[]
  /** Mark that we already showed a price-drop toast for this product (session-only). */
  markPriceDropNotified: (productId: string, supplierId: string) => void
  /** Whether we already showed a price-drop toast for this product this session. */
  wasPriceDropNotified: (productId: string, supplierId: string) => boolean
  /** Remove all watched items (bulk action) */
  removeAll: () => void
}

export const usePriceWatchStore = create<PriceWatchState>()(
  persist(
    (set, get) => ({
      watched: [],
      autoRemoveAfterPurchase: false,

      setAutoRemoveAfterPurchase: (value) =>
        set((s) => ({ autoRemoveAfterPurchase: value })),

      addWatch: (item) =>
        set((s) => {
          const key = `${item.productId}|${item.supplierId}`
          if (s.watched.some((w) => `${w.productId}|${w.supplierId}` === key)) return s
          // Apply global auto-remove setting to new items
          const newItem = {
            ...item,
            addedAt: Date.now(),
            autoRemoveAfterPurchase: s.autoRemoveAfterPurchase
          }
          return {
            watched: [...s.watched, newItem],
          }
        }),

      removeWatch: (productId, supplierId) =>
        set((s) => ({
          watched: s.watched.filter(
            (w) => !(w.productId === productId && (w.supplierId === supplierId || !supplierId))
          ),
        })),

      updateWatch: (productId, supplierId, updates) =>
        set((s) => ({
          watched: s.watched.map((w) =>
            w.productId === productId && w.supplierId === supplierId
              ? { ...w, ...updates }
              : w
          ),
        })),

      isWatched: (productId, supplierId) =>
        get().watched.some(
          (w) => w.productId === productId && (!supplierId || w.supplierId === supplierId)
        ),

      getWatched: () => get().watched,
      getItems: () => get().watched,

      checkPriceDrop: (productId, supplierId, currentPrice) => {
        const w = get().watched.find(
          (x) => x.productId === productId && x.supplierId === supplierId
        )
        if (w && currentPrice < w.priceWhenWatched) return w
        return null
      },

      checkPriceDrops: (currentPrices) => {
        const watched = get().watched
        const drops: WatchedItem[] = []
        for (const w of watched) {
          const row = currentPrices.find(
            (p) => p.productId === w.productId && p.supplierId === w.supplierId
          )
          if (row && row.currentPrice < w.priceWhenWatched) drops.push(w)
        }
        return drops
      },

      markPriceDropNotified: (productId, supplierId) => {
        notifiedPriceDropKeys.add(`${productId}|${supplierId}`)
      },

      wasPriceDropNotified: (productId, supplierId) =>
        notifiedPriceDropKeys.has(`${productId}|${supplierId}`),

      removeAll: () => set({ watched: [] }),
    }),
    {
      name: "ihute-price-watch",
      version: 2,
      partialize: (state) => ({
        watched: state.watched,
        autoRemoveAfterPurchase: state.autoRemoveAfterPurchase,
      }),
      migrate: (persistedState) => {
        const p = persistedState as {
          watched?: unknown
          autoRemoveAfterPurchase?: unknown
        } | null
        if (!p || typeof p !== "object") {
          return { watched: [] as WatchedItem[], autoRemoveAfterPurchase: false }
        }
        return {
          watched: Array.isArray(p.watched) ? (p.watched as WatchedItem[]) : [],
          autoRemoveAfterPurchase: p.autoRemoveAfterPurchase === true,
        }
      },
    }
  )
)
