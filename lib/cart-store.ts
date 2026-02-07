"use client"

import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import { trackClick } from "./interaction-tracker"

export type CartItem = {
  id: string
  name: string
  price: number
  unit?: string
  image?: string

  /** Item code / NIKI code (e.g. item_key_words) — sent in order transaction */
  itemCode?: string

  // seller info
  supplierId: string
  supplierName: string
  supplierLocation?: string
  momo?: string              // seller MoMo (for USSD)
  sellerPhone?: string       // WhatsApp phone from account_signup.TEL

  // variant key
  selectedUnit?: string

  /** Set when adding from shop-with-me bar/resto (DEPARTMENT or PREFERRED_CATEGORIES); enables table-command autofill in cart */
  isBarResto?: boolean

  qty: number
}

// ✅ NEW: Table info for bar/restaurant orders
export type TableInfo = {
  /**
   * Encoded identifier combining name + address (for backwards compatibility),
   * usually in the format: "Name | Address"
   */
  tableNumber?: string

  /** Explicit customer name (for delivery or table orders) */
  customerName?: string

  /** Explicit delivery address / table location */
  customerAddress?: string

  /** Optional shop metadata */
  shopName?: string
  shopId?: string
}

export type SellerGroup = {
  supplierId: string
  supplierName: string
  supplierLocation?: string
  momo?: string
  phone?: string
  items: CartItem[]
  subtotal: number
  /** True if any item came from shop-with-me with bar-resto department/preferred category; used for table-command autofill */
  isBarResto?: boolean
}

type PayState = "unpaid" | "pending" | "paid" | "failed"

type CartState = {
  items: CartItem[]
  payment: Record<string, PayState>
  tableInfo: TableInfo | null  // ✅ NEW: Table information

  // CRUD
  addItem: (item: Omit<CartItem, "qty">, qty?: number) => void
  add: (item: Omit<CartItem, "qty">, qty?: number) => void
  addOrInc: (item: Omit<CartItem, "qty">, qty?: number) => void
  inc: (id: string, selectedUnit?: string) => void
  dec: (id: string, selectedUnit?: string) => void
  remove: (id: string, selectedUnit?: string) => void
  clear: () => void
  clearCart: () => void
  removeGroupBySeller: (supplierId: string) => void

  // ✅ NEW: Table management
  setTableInfo: (info: TableInfo | null) => void
  clearTableInfo: () => void
  getTableInfo: () => TableInfo | null

  // Helpers
  getTotalItems: () => number
  getTotalPrice: () => number
  getGrandTotal: () => number
  getGroupsBySeller: () => SellerGroup[]

  // Payments
  getPaymentStatus: (supplierId: string) => PayState
  setPaymentStatus: (supplierId: string, status: PayState) => void
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      payment: {},
      tableInfo: null,  // ✅ NEW: Initialize table info

      addItem: (item, qty = 1) =>
        set((state) => {
          const selectedUnit = item.selectedUnit ?? item.unit
          const keyMatch = (x: CartItem) => x.id === item.id && x.selectedUnit === selectedUnit
          const existing = state.items.find(keyMatch)

          // Track add-to-cart as a preference (best-effort)
          try {
            trackClick("product", item.id, item.name)
          } catch {
            // ignore tracking errors
          }

          if (existing) {
            return {
              items: state.items.map((x) => (keyMatch(x) ? { ...x, qty: x.qty + qty } : x)),
            }
          }
          return { items: [...state.items, { ...item, selectedUnit, qty }] }
        }),

      // alias for compatibility with older calls (s.add)
      add: (item, qty = 1) => get().addItem(item, qty),

      // NEW: add or increment if same (id, selectedUnit)
      addOrInc: (item, qty = 1) =>
        set((state) => {
          const selectedUnit = item.selectedUnit ?? item.unit
          const keyMatch = (x: CartItem) => x.id === item.id && x.selectedUnit === selectedUnit
          const idx = state.items.findIndex(keyMatch)
          if (idx >= 0) {
            const next = [...state.items]
            next[idx] = { ...next[idx], qty: next[idx].qty + qty }
            return { items: next }
          }
          return { items: [...state.items, { ...item, selectedUnit, qty }] }
        }),

      inc: (id, selectedUnit) =>
        set((s) => ({
          items: s.items.map((x) => (x.id === id && x.selectedUnit === selectedUnit ? { ...x, qty: x.qty + 1 } : x)),
        })),

      dec: (id, selectedUnit) =>
        set((s) => ({
          items: s.items.map((x) => {
            if (x.id === id && x.selectedUnit === selectedUnit) {
              return { ...x, qty: Math.max(1, x.qty - 1) } // clamp at 1; use remove() to drop
            }
            return x
          }),
        })),

      remove: (id, selectedUnit) =>
        set((s) => ({
          items: s.items.filter((x) => !(x.id === id && x.selectedUnit === selectedUnit)),
        })),

      clear: () => set({ items: [], payment: {}, tableInfo: null }),  // ✅ Clear table info too

      // ✅ Alias for clear() to match checkout form usage
      clearCart: () => {
        set({ items: [], payment: {}, tableInfo: null })
      },

      removeGroupBySeller: (supplierId) =>
        set((s) => ({
          items: s.items.filter((x) => x.supplierId !== supplierId),
          payment: { ...s.payment, [supplierId]: "paid" },
        })),

      // ✅ NEW: Table management functions
      setTableInfo: (info) => set({ tableInfo: info }),

      clearTableInfo: () => set({ tableInfo: null }),

      getTableInfo: () => get().tableInfo,

      getTotalItems: () => get().items.reduce((acc, it) => acc + it.qty, 0),

      getGrandTotal: () => get().items.reduce((acc, it) => acc + it.price * it.qty, 0),

      // ✅ Alias for getGrandTotal() to match checkout form usage
      getTotalPrice: () => {
        return get().items.reduce((acc, it) => acc + it.price * it.qty, 0)
      },

      getGroupsBySeller: () => {
        const groups = new Map<string, SellerGroup>()
        for (const it of get().items) {
          if (!it.supplierId) continue
          const g =
            groups.get(it.supplierId) ??
            {
              supplierId: it.supplierId,
              supplierName: it.supplierName,
              supplierLocation: it.supplierLocation,
              momo: it.momo,
              phone: it.sellerPhone,
              items: [],
              subtotal: 0,
              isBarResto: false,
            }
          g.items.push(it)
          g.subtotal += it.price * it.qty
          if (it.momo && it.momo.trim()) g.momo = it.momo
          if (it.sellerPhone && it.sellerPhone.trim()) g.phone = it.sellerPhone
          if (it.isBarResto) g.isBarResto = true
          groups.set(it.supplierId, g)
        }
        return Array.from(groups.values()).map((g) => ({
          ...g,
          subtotal: Math.max(0, Math.round(g.subtotal)),
        }))
      },

      getPaymentStatus: (supplierId) => get().payment[supplierId] ?? "unpaid",
      setPaymentStatus: (supplierId, status) =>
        set((s) => ({ payment: { ...s.payment, [supplierId]: status } })),
    }),
    {
      name: "cart-storage",
      storage: createJSONStorage(() => localStorage),
    }
  )
)