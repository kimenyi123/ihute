"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { postAdminApi } from "@/lib/admin-client"
import type { AdminMonitorOrder } from "@/lib/admin-order-monitor"

const STORAGE_KEY = "ihute-admin-order-bell"
const POLL_MS = 25_000
const RECENT_LIMIT = 20

type BellStore = {
  lastSeenOrderId: number
}

function loadStore(): BellStore {
  if (typeof window === "undefined") return { lastSeenOrderId: 0 }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { lastSeenOrderId: 0 }
    const parsed = JSON.parse(raw) as BellStore
    return { lastSeenOrderId: Number(parsed.lastSeenOrderId) || 0 }
  } catch {
    return { lastSeenOrderId: 0 }
  }
}

function saveStore(store: BellStore) {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

export type AdminOrderFeedState = {
  recentOrders: AdminMonitorOrder[]
  unreadOrders: AdminMonitorOrder[]
  unreadCount: number
  attentionCount: number
  loading: boolean
  lastFetchedAt: Date | null
  markAllRead: () => void
  refresh: () => Promise<void>
}

export function useAdminOrderFeed(enabled = true): AdminOrderFeedState {
  const [recentOrders, setRecentOrders] = useState<AdminMonitorOrder[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [unreadOrders, setUnreadOrders] = useState<AdminMonitorOrder[]>([])
  const [attentionCount, setAttentionCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null)
  const initialized = useRef(false)
  const lastSeenRef = useRef(0)
  const prevMaxIdRef = useRef(0)

  const applyUnread = useCallback((orders: AdminMonitorOrder[]) => {
    const unread = orders.filter((o) => o.id > lastSeenRef.current)
    setUnreadOrders(unread)
    setUnreadCount(unread.length)
  }, [])

  const refresh = useCallback(async () => {
    if (!enabled) return
    try {
      const res = await postAdminApi({
        action: "getAllOrders",
        limit: RECENT_LIMIT,
        page: 1,
        light: "1",
      })
      const data = await res.json()
      if (!data.ok) return

      const orders = (data.orders ?? []) as AdminMonitorOrder[]
      const maxId = orders.length > 0 ? Math.max(...orders.map((o) => o.id)) : 0

      setRecentOrders(orders)
      if (data.attentionCount != null) {
        setAttentionCount(Number(data.attentionCount) || 0)
      }
      setLastFetchedAt(new Date())

      if (!initialized.current) {
        const store = loadStore()
        if (store.lastSeenOrderId > 0) {
          lastSeenRef.current = store.lastSeenOrderId
        } else if (maxId > 0) {
          lastSeenRef.current = maxId
          saveStore({ lastSeenOrderId: maxId })
        }
        initialized.current = true
        prevMaxIdRef.current = maxId
        applyUnread(orders)
        return
      }

      if (maxId > prevMaxIdRef.current) {
        window.dispatchEvent(
          new CustomEvent("ihute:admin-new-orders", {
            detail: { count: orders.filter((o) => o.id > prevMaxIdRef.current).length },
          }),
        )
      }
      prevMaxIdRef.current = maxId
      applyUnread(orders)
    } catch (e) {
      console.error("[useAdminOrderFeed]", e)
    } finally {
      setLoading(false)
    }
  }, [applyUnread, enabled])

  const markAllRead = useCallback(() => {
    if (recentOrders.length === 0) return
    const maxId = Math.max(...recentOrders.map((o) => o.id))
    lastSeenRef.current = maxId
    saveStore({ lastSeenOrderId: maxId })
    setUnreadOrders([])
    setUnreadCount(0)
  }, [recentOrders])

  useEffect(() => {
    const store = loadStore()
    lastSeenRef.current = store.lastSeenOrderId
  }, [])

  useEffect(() => {
    if (!enabled) return
    refresh()
    const id = window.setInterval(refresh, POLL_MS)
    return () => window.clearInterval(id)
  }, [enabled, refresh])

  return {
    recentOrders,
    unreadOrders,
    unreadCount,
    attentionCount,
    loading,
    lastFetchedAt,
    markAllRead,
    refresh,
  }
}
