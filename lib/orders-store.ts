// lib/orders-store.ts
"use client"

import { create } from "zustand"

export type OrderItem = {
  id: string
  name: string
  price: number
  unit?: string
  image?: string
  selectedUnit?: string
  qty: number
}

export type Order = {
  id: string
  sellerId: string
  sellerName: string
  sellerLocation?: string
  momo?: string
  items: OrderItem[]
  itemsCount?: number
  subtotal: number
  status: "pending" | "processing" | "in-transit" | "delivered" | "cancelled"
  paymentStatus: "paid" | "pending" | "failed" | "unpaid"
  createdAt: string

  // ✨ Supplier view fields
  buyerId?: string
  buyerName?: string
  isGuest?: boolean
}

type OrdersState = {
  orders: Order[]
  addOrder: (o: Omit<Order, "id" | "createdAt" | "status"> & Partial<Pick<Order, "status">>) => string
  updateStatus: (id: string, status: Order["status"]) => void
  getPendingCount: () => number

  // list ops
  setOrders: (list: Order[]) => void
  upsertOrder: (o: Order) => void
}

export const useOrdersStore = create<OrdersState>()((set, get) => ({
  orders: [],

  setOrders: (list) => set({ orders: list }),

  upsertOrder: (o) =>
    set((s) => {
      const i = s.orders.findIndex((x) => x.id === o.id)
      if (i === -1) return { orders: [o, ...s.orders] }
      const next = [...s.orders]
      next[i] = { ...next[i], ...o }
      return { orders: next }
    }),

  addOrder: (o) => {
    const id = `ORD-${Date.now()}-${Math.floor(Math.random() * 9999)
      .toString()
      .padStart(4, "0")}`
    const order: Order = {
      id,
      createdAt: new Date().toISOString(),
      status: o.status ?? "pending",
      ...o,
    }
    set((s) => ({ orders: [order, ...s.orders] }))
    return id
  },

  updateStatus: (id, status) =>
    set((s) => ({
      orders: s.orders.map((x) => (x.id === id ? { ...x, status } : x)),
    })),

  getPendingCount: () =>
    get().orders.filter((o) => o.status !== "delivered" && o.status !== "cancelled").length,
}))
