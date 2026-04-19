import { create } from "zustand"
import { persist } from "zustand/middleware"

export type ShopByTab = "sector" | "category" | "brand" | "all" | "opportunities" | "manufacturers" | "high-margin" | "high-demand"

export interface ProductFiltersState {
  sector: string
  category: string
  brand: string
  priceMin: string
  priceMax: string
  shopBy: ShopByTab
  setSector: (v: string) => void
  setCategory: (v: string) => void
  setBrand: (v: string) => void
  setPriceMin: (v: string) => void
  setPriceMax: (v: string) => void
  setShopBy: (v: ShopByTab) => void
  clearAll: () => void
  hasActiveFilters: () => boolean
}

const defaultState = {
  sector: "",
  category: "",
  brand: "",
  priceMin: "",
  priceMax: "",
  shopBy: "all" as ShopByTab,
}

export const useProductFiltersStore = create<ProductFiltersState>()(
  persist(
    (set, get) => ({
      ...defaultState,
      setSector: (v) => set({ sector: v }),
      setCategory: (v) => set({ category: v }),
      setBrand: (v) => set({ brand: v }),
      setPriceMin: (v) => set({ priceMin: v }),
      setPriceMax: (v) => set({ priceMax: v }),
      setShopBy: (v) => set({ shopBy: v }),
      clearAll: () => set(defaultState),
      hasActiveFilters: () => {
        const s = get()
        return !!(s.sector || s.category || s.brand || s.priceMin || s.priceMax)
      },
    }),
    { name: "product-filters", partialize: (s) => ({ shopBy: s.shopBy }) }
  )
)
