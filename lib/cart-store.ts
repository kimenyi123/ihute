"use client"

import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import { trackClick, trackInteraction } from "./interaction-tracker"

// Use environment variable for backend URL (client-side needs NEXT_PUBLIC_ prefix)
const BACKEND_URL = process.env.NEXT_PUBLIC_JAVA_BACKEND_BASE || "http://localhost:8080/Trading"

export type CartItem = {
  id: string
  name: string
  price: number
  unit?: string
  image?: string

  // seller info
  supplierId: string
  supplierName: string
  supplierLocation?: string
  momo?: string              // seller MoMo (for USSD)
  sellerPhone?: string       // WhatsApp phone from account_signup.TEL

  // variant key
  selectedUnit?: string

  qty: number
}

export type SellerGroup = {
  supplierId: string
  supplierName: string
  supplierLocation?: string
  momo?: string
  phone?: string
  items: CartItem[]
  subtotal: number
}

type PayState = "unpaid" | "pending" | "paid" | "failed"

type CartState = {
  items: CartItem[]
  payment: Record<string, PayState>

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

      addItem: (item, qty = 1) => {
        set((state) => {
          const selectedUnit = item.selectedUnit ?? item.unit
          const keyMatch = (x: CartItem) => x.id === item.id && x.selectedUnit === selectedUnit
          const existing = state.items.find(keyMatch)

          // Track add-to-cart as a preference (best-effort)
          try {
            trackClick("product", item.id, item.name)
            // Also track a dedicated add_to_cart interaction for personalization / abandoned cart
            trackInteraction("add_to_cart", "product", item.id, {
              entityName: item.name,
              metadata: {
                supplierId: item.supplierId,
                supplierName: item.supplierName,
              },
            })
          } catch {
            // ignore tracking errors
          }

          if (existing) {
            return {
              items: state.items.map((x) => (keyMatch(x) ? { ...x, qty: x.qty + qty } : x)),
            }
          }
          return { items: [...state.items, { ...item, selectedUnit, qty }] }
        })

        // Track cart activity for abandoned cart reminders
        try {
          // Get email from auth store
          let userEmail: string | null = null
          try {
            const authStorage = localStorage.getItem('auth-storage')
            if (authStorage) {
              const authData = JSON.parse(authStorage)
              userEmail = authData?.state?.user?.email || null
            }
          } catch (e) {
            console.error('[Abandoned Cart] Error reading auth storage:', e)
          }

          console.log('[Abandoned Cart] Tracking attempt:', {
            email: userEmail,
            hasEmail: !!userEmail,
            itemId: item.id,
            itemName: item.name
          })

          if (userEmail && typeof window !== 'undefined') {
            // Get current cart state
            const currentItems = get().items
            const cartTotal = currentItems.reduce((sum, i) => sum + (i.price * i.qty), 0)

            console.log('[Abandoned Cart] Calling trackCartActivity for:', userEmail)

            fetch(`${BACKEND_URL}/OrdersServlet?action=trackCartActivity`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                buyerEmail: userEmail,
                itemCount: currentItems.length.toString(),
                cartValue: cartTotal.toString(),
                currency: 'RWF'
              })
            })
              .then(response => {
                console.log('[Abandoned Cart] Response status:', response.status)
                return response.json()
              })
              .then(data => {
                console.log('[Abandoned Cart] Success:', data)
              })
              .catch(error => {
                console.error('[Abandoned Cart] Error:', error)
              })
          } else {
            console.warn('[Abandoned Cart] No user email found in storage')
          }
        } catch (error) {
          console.error('[Abandoned Cart] Exception:', error)
        }
      },

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

      clear: () => set({ items: [], payment: {} }),

      // ✅ Alias for clear() to match checkout form usage
      clearCart: () => {
        set({ items: [], payment: {} })
      },

      removeGroupBySeller: (supplierId) =>
        set((s) => ({
          items: s.items.filter((x) => x.supplierId !== supplierId),
          payment: { ...s.payment, [supplierId]: "paid" },
        })),

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
            }
          g.items.push(it)
          g.subtotal += it.price * it.qty
          // Update momo/phone from any item that has it (not just first item)
          if (it.momo && it.momo.trim()) g.momo = it.momo
          if (it.sellerPhone && it.sellerPhone.trim()) g.phone = it.sellerPhone
          groups.set(it.supplierId, g)
        }
        return Array.from(groups.values()).map((g) => ({
          ...g,
          subtotal: Math.max(0, Math.round(g.subtotal)), // USSD-friendly
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