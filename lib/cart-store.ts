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
  /** Merge duplicate lines (same supplier + same product code or name) into one line with summed qty */
  mergeDuplicateCartLines: () => void

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

      // Same product = same supplier + (same product CODE or same product name) — merge into one line
      addItem: (item, qty = 1) =>
        set((state) => {
          const selectedUnit = item.selectedUnit ?? item.unit
          const productCode = (item.itemCode ?? item.id).toString().trim()
          const nameKey = (item.name ?? "").toString().trim().toLowerCase()
          const sid = (item.supplierId ?? "").toString().trim()

          const matchExact = (x: CartItem) => {
            const xCode = (x.itemCode ?? x.id).toString().trim()
            const xUnit = (x.selectedUnit ?? x.unit) ?? ""
            return (x.supplierId ?? "").toString().trim() === sid && xCode === productCode && (x.selectedUnit ?? x.unit) === selectedUnit
          }
          const matchByCode = (x: CartItem) => {
            const xCode = (x.itemCode ?? x.id).toString().trim()
            return (x.supplierId ?? "").toString().trim() === sid && xCode === productCode
          }
          const matchByName = (x: CartItem) => {
            const xName = (x.name ?? "").toString().trim().toLowerCase()
            return (x.supplierId ?? "").toString().trim() === sid && xName === nameKey && nameKey !== ""
          }

          const existing = state.items.find(matchExact) ?? state.items.find(matchByCode) ?? state.items.find(matchByName)

          try {
            trackClick("product", item.id, item.name)
          } catch {
            // ignore tracking errors
          }

          if (existing) {
            const keyMatch = (x: CartItem) => x === existing || matchExact(x) || (productCode && matchByCode(x)) || (nameKey && matchByName(x))
            const matching = state.items.filter(keyMatch)
            const totalQty = matching.reduce((sum, x) => sum + x.qty, 0) + qty
            const first = matching[0]
            const mergedLine: CartItem = {
              ...first,
              qty: totalQty,
              itemCode: (first.itemCode ?? item.itemCode ?? first.id ?? item.id).toString().trim() || first.itemCode,
            }
            return {
              items: state.items.filter((x) => !keyMatch(x)).concat([mergedLine]),
            }
          }
          const withCode = { ...item, selectedUnit, qty, itemCode: (item.itemCode ?? item.id).toString().trim() || undefined }
          return { items: [...state.items, withCode] }
        }),

      add: (item, qty = 1) => get().addItem(item, qty),

      // Add or increment: same supplier + (same code or same name) = one line (quantity added up)
      addOrInc: (item, qty = 1) =>
        set((state) => {
          const selectedUnit = item.selectedUnit ?? item.unit
          const productCode = (item.itemCode ?? item.id).toString().trim()
          const nameKey = (item.name ?? "").toString().trim().toLowerCase()
          const sid = (item.supplierId ?? "").toString().trim()

          const matchExact = (x: CartItem) => {
            const xCode = (x.itemCode ?? x.id).toString().trim()
            return (x.supplierId ?? "").toString().trim() === sid && xCode === productCode && (x.selectedUnit ?? x.unit) === selectedUnit
          }
          const matchByCode = (x: CartItem) => {
            const xCode = (x.itemCode ?? x.id).toString().trim()
            return (x.supplierId ?? "").toString().trim() === sid && xCode === productCode
          }
          const matchByName = (x: CartItem) => {
            const xName = (x.name ?? "").toString().trim().toLowerCase()
            return (x.supplierId ?? "").toString().trim() === sid && xName === nameKey && nameKey !== ""
          }

          const idx = state.items.findIndex(matchExact)
          const idxByCode = idx >= 0 ? idx : state.items.findIndex(matchByCode)
          const idxByName = idxByCode >= 0 ? idxByCode : state.items.findIndex(matchByName)
          const targetIdx = idx >= 0 ? idx : idxByCode >= 0 ? idxByCode : idxByName

          if (targetIdx >= 0) {
            const keyMatch = (x: CartItem) => matchExact(x) || (productCode && matchByCode(x)) || (nameKey && matchByName(x))
            const matching = state.items.filter(keyMatch)
            const totalQty = matching.reduce((sum, x) => sum + x.qty, 0) + qty
            const first = matching[0]
            const mergedLine: CartItem = {
              ...first,
              qty: totalQty,
              itemCode: (first.itemCode ?? item.itemCode ?? first.id ?? item.id).toString().trim() || first.itemCode,
            }
            return {
              items: state.items.filter((x) => !keyMatch(x)).concat([mergedLine]),
            }
          }
          const withCode = { ...item, selectedUnit, qty, itemCode: (item.itemCode ?? item.id).toString().trim() || undefined }
          return { items: [...state.items, withCode] }
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

      removeGroupBySeller: (supplierId) => {
        const sid = (supplierId ?? "").toString().trim()
        set((s) => ({
          items: s.items.filter((x) => (x.supplierId ?? "").toString().trim() !== sid),
          payment: { ...s.payment, [supplierId]: "paid" },
        }))
      },

      mergeDuplicateCartLines: () =>
        set((state) => {
          const items = state.items
          if (items.length <= 1) return state
          const merged: CartItem[] = []
          for (const it of items) {
            const sid = (it.supplierId ?? "").toString().trim()
            const code = (it.itemCode ?? it.id).toString().trim()
            const nameKey = (it.name ?? "").toString().trim().toLowerCase()
            const existingIdx = merged.findIndex((m) => {
              const msid = (m.supplierId ?? "").toString().trim()
              if (msid !== sid) return false
              const mCode = (m.itemCode ?? m.id).toString().trim()
              if (code && mCode === code) return true
              const mName = (m.name ?? "").toString().trim().toLowerCase()
              if (nameKey && mName === nameKey) return true
              return false
            })
            if (existingIdx >= 0) {
              const cur = merged[existingIdx]
              merged[existingIdx] = {
                ...cur,
                qty: cur.qty + it.qty,
                itemCode: (cur.itemCode ?? it.itemCode ?? cur.id ?? it.id).toString().trim() || cur.itemCode,
              }
            } else {
              merged.push({ ...it, itemCode: (it.itemCode ?? it.id).toString().trim() || it.itemCode })
            }
          }
          if (merged.length === items.length) return state
          return { items: merged }
        }),

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
          const sid = (it.supplierId ?? "").toString().trim()
          if (!sid) continue
          const g =
            groups.get(sid) ??
            {
              supplierId: sid,
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
          groups.set(sid, g)
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