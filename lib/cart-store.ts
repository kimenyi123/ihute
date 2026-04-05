"use client"

import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import { trackClick } from "./interaction-tracker"
import { getPublicApiUrl } from "./backend-config"
import type { ErxPrescription } from "./erx-prescription"
import { prescriptionLineKey } from "./erx-prescription"

export type CartItem = {
  id: string
  name: string
  price: number
  unit?: string
  image?: string
  /** Free text or JSON (e.g. ihute_erx_v1) for DB / order APIs */
  notes?: string
  /** Structured eRx when added from pharmacy flow */
  erx?: ErxPrescription
  /** Distinguishes lines with same product code but different prescriptions */
  lineSignature?: string

  /** Item code / NIKI code (e.g. item_key_words) — sent in order transaction */
  itemCode?: string

  // seller info
  supplierId: string
  supplierName: string
  supplierLocation?: string
  momo?: string              // seller MoMo (for USSD)
  /** MTN MoMo Pay merchant code when known (e.g. from API or shop config) */
  momoCode?: string
  /** Backend account for /api/account/profile when it differs from supplierId */
  supplierProfileAccount?: string
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
  momoCode?: string
  /** Prefer this for profile API when set */
  supplierProfileAccount?: string
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
  inc: (id: string, selectedUnit?: string, lineSignature?: string) => void
  dec: (id: string, selectedUnit?: string, lineSignature?: string) => void
  remove: (id: string, selectedUnit?: string, lineSignature?: string) => void
  clear: () => void
  clearCart: () => void
  /** Replace cart with items from sync API (account-based cart sync). */
  replaceItemsFromSync: (items: CartItem[]) => void
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
      addItem: (item, qty = 1) => {
        set((state) => {
          const selectedUnit = item.selectedUnit ?? item.unit
          const productCode = (item.itemCode ?? item.id).toString().trim()
          const nameKey = (item.name ?? "").toString().trim().toLowerCase()
          const incomingSig = prescriptionLineKey({ erx: item.erx, notes: item.notes })
          const sid = (item.supplierId ?? "").toString().trim()

          const sigOf = (x: CartItem) => x.lineSignature ?? prescriptionLineKey({ erx: x.erx, notes: x.notes })

          const matchExact = (x: CartItem) => {
            const xCode = (x.itemCode ?? x.id).toString().trim()
            return (
              (x.supplierId ?? "").toString().trim() === sid &&
              xCode === productCode &&
              (x.selectedUnit ?? x.unit) === selectedUnit &&
              sigOf(x) === incomingSig
            )
          }
          const matchByCode = (x: CartItem) => {
            const xCode = (x.itemCode ?? x.id).toString().trim()
            return (x.supplierId ?? "").toString().trim() === sid && xCode === productCode && sigOf(x) === incomingSig
          }
          const matchByName = (x: CartItem) => {
            const xName = (x.name ?? "").toString().trim().toLowerCase()
            return (x.supplierId ?? "").toString().trim() === sid && xName === nameKey && nameKey !== "" && sigOf(x) === incomingSig
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
            // Keep the highest price among matching lines when merging (in case one had 0 and another had real price)
            const bestPrice = matching.reduce((best, x) => {
              const p = typeof x.price === "number" && Number.isFinite(x.price) ? x.price : 0
              return p > best ? p : best
            }, typeof first.price === "number" && Number.isFinite(first.price) ? first.price : 0)
            const mergedLine: CartItem = {
              ...first,
              qty: totalQty,
              price: bestPrice,
              itemCode: (first.itemCode ?? item.itemCode ?? first.id ?? item.id).toString().trim() || first.itemCode,
              momoCode: first.momoCode ?? item.momoCode,
              supplierProfileAccount: first.supplierProfileAccount ?? item.supplierProfileAccount,
              notes: first.notes ?? item.notes,
              erx: first.erx ?? item.erx,
              lineSignature: first.lineSignature ?? incomingSig,
            }
            return {
              items: state.items.filter((x) => !keyMatch(x)).concat([mergedLine]),
            }
          }
          // Ensure price is always a number (API may send string or omit)
          const rawPrice = item.price
          const priceNum = typeof rawPrice === "number" && Number.isFinite(rawPrice) ? rawPrice : Number(String(rawPrice ?? "").replace(/[^\d.-]/g, "")) || 0
          const withCode: CartItem = {
            ...item,
            price: priceNum,
            selectedUnit,
            qty,
            itemCode: (item.itemCode ?? item.id).toString().trim() || undefined,
            lineSignature: incomingSig,
          }
          return { items: [...state.items, withCode] }
        })

        // Track cart activity for abandoned cart reminders (throttled: max once per 10s to avoid load)
        try {
          if (typeof window === 'undefined') return
          const throttleKey = 'abandoned-cart-last-track'
          const throttleMs = 10_000
          const last = parseInt(sessionStorage.getItem(throttleKey) || '0', 10)
          if (Date.now() - last < throttleMs) return

          let userEmail: string | null = null
          try {
            const authStorage = localStorage.getItem('auth-storage')
            if (authStorage) {
              const authData = JSON.parse(authStorage)
              userEmail = authData?.state?.user?.email || null
            }
          } catch {
            // ignore
          }

          if (!userEmail) return

          sessionStorage.setItem(throttleKey, String(Date.now()))
          const currentItems = get().items
          const cartTotal = currentItems.reduce((sum, i) => sum + (i.price * i.qty), 0)
          const base = getPublicApiUrl()
          const url = `${base}/Kaos/OrdersServlet?action=trackCartActivity`
          fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              buyerEmail: userEmail,
              itemCount: currentItems.length.toString(),
              cartValue: cartTotal.toString(),
              currency: 'RWF'
            })
          }).catch(() => { /* fire-and-forget */ })
        } catch {
          // avoid breaking add-to-cart
        }
      },

      add: (item, qty = 1) => get().addItem(item, qty),

      // Add or increment: same supplier + (same code or same name) = one line (quantity added up)
      addOrInc: (item, qty = 1) =>
        set((state) => {
          const selectedUnit = item.selectedUnit ?? item.unit
          const productCode = (item.itemCode ?? item.id).toString().trim()
          const nameKey = (item.name ?? "").toString().trim().toLowerCase()
          const incomingSig = prescriptionLineKey({ erx: item.erx, notes: item.notes })
          const sid = (item.supplierId ?? "").toString().trim()

          const sigOf = (x: CartItem) => x.lineSignature ?? prescriptionLineKey({ erx: x.erx, notes: x.notes })

          const matchExact = (x: CartItem) => {
            const xCode = (x.itemCode ?? x.id).toString().trim()
            return (
              (x.supplierId ?? "").toString().trim() === sid &&
              xCode === productCode &&
              (x.selectedUnit ?? x.unit) === selectedUnit &&
              sigOf(x) === incomingSig
            )
          }
          const matchByCode = (x: CartItem) => {
            const xCode = (x.itemCode ?? x.id).toString().trim()
            return (x.supplierId ?? "").toString().trim() === sid && xCode === productCode && sigOf(x) === incomingSig
          }
          const matchByName = (x: CartItem) => {
            const xName = (x.name ?? "").toString().trim().toLowerCase()
            return (x.supplierId ?? "").toString().trim() === sid && xName === nameKey && nameKey !== "" && sigOf(x) === incomingSig
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
              notes: first.notes ?? item.notes,
              erx: first.erx ?? item.erx,
              lineSignature: first.lineSignature ?? incomingSig,
            }
            return {
              items: state.items.filter((x) => !keyMatch(x)).concat([mergedLine]),
            }
          }
          const withCode: CartItem = {
            ...item,
            selectedUnit,
            qty,
            itemCode: (item.itemCode ?? item.id).toString().trim() || undefined,
            lineSignature: incomingSig,
          }
          return { items: [...state.items, withCode] }
        }),

      inc: (id, selectedUnit, lineSignature) =>
        set((s) => ({
          items: s.items.map((x) => {
            const sig = x.lineSignature ?? prescriptionLineKey({ erx: x.erx, notes: x.notes })
            const matchSig = (lineSignature ?? "") === (sig || "")
            if (x.id === id && x.selectedUnit === selectedUnit && matchSig) {
              return { ...x, qty: x.qty + 1 }
            }
            return x
          }),
        })),

      dec: (id, selectedUnit, lineSignature) =>
        set((s) => ({
          items: s.items.map((x) => {
            const sig = x.lineSignature ?? prescriptionLineKey({ erx: x.erx, notes: x.notes })
            const matchSig = (lineSignature ?? "") === (sig || "")
            if (x.id === id && x.selectedUnit === selectedUnit && matchSig) {
              return { ...x, qty: Math.max(1, x.qty - 1) } // clamp at 1; use remove() to drop
            }
            return x
          }),
        })),

      remove: (id, selectedUnit, lineSignature) =>
        set((s) => ({
          items: s.items.filter((x) => {
            const sig = x.lineSignature ?? prescriptionLineKey({ erx: x.erx, notes: x.notes })
            const matchSig = (lineSignature ?? "") === (sig || "")
            return !(x.id === id && x.selectedUnit === selectedUnit && matchSig)
          }),
        })),

      clear: () => set({ items: [], payment: {}, tableInfo: null }),  // ✅ Clear table info too
      replaceItemsFromSync: (items) => set({ items: Array.isArray(items) ? items : [] }),

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
              const mSig = m.lineSignature ?? prescriptionLineKey({ erx: m.erx, notes: m.notes })
              const itSig = it.lineSignature ?? prescriptionLineKey({ erx: it.erx, notes: it.notes })
              if (mSig !== itSig) return false
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
                erx: cur.erx ?? it.erx,
                notes: cur.notes ?? it.notes,
                lineSignature: cur.lineSignature ?? it.lineSignature,
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
              momoCode: it.momoCode,
              supplierProfileAccount: it.supplierProfileAccount,
              phone: it.sellerPhone,
              items: [],
              subtotal: 0,
              isBarResto: false,
            }
          g.items.push(it)
          g.subtotal += it.price * it.qty
          if (it.momo && it.momo.trim()) g.momo = it.momo
          if (it.momoCode && it.momoCode.trim()) g.momoCode = it.momoCode.trim()
          if (it.supplierProfileAccount?.trim()) g.supplierProfileAccount = it.supplierProfileAccount.trim()
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