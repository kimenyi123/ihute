"use client"

import { useEffect, useRef } from "react"
import { useAuthStore } from "@/lib/auth-store"
import { useCartStore } from "@/lib/cart-store"

const SAVE_DEBOUNCE_MS = 2000

/**
 * When user is logged in: load cart from API once if local cart is empty;
 * save cart to API when items change (debounced).
 */
export function CartSyncEffect() {
  const user = useAuthStore((s) => s.user)
  const items = useCartStore((s) => s.items)
  const replaceItemsFromSync = useCartStore((s) => s.replaceItemsFromSync)
  const hasLoaded = useRef(false)
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const userId = user?.email?.trim()

  // Load once when user is present and we haven't loaded yet
  useEffect(() => {
    if (!userId || hasLoaded.current) return
    hasLoaded.current = true
    fetch(`/api/cart/sync?userId=${encodeURIComponent(userId)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        const remote = Array.isArray(data?.items) ? data.items : []
        if (remote.length > 0) {
          const current = useCartStore.getState().items
          if (current.length === 0) replaceItemsFromSync(remote)
        }
      })
      .catch(() => {})
  }, [userId, replaceItemsFromSync])

  // Save when items change (debounced), including empty carts after checkout.
  useEffect(() => {
    if (!userId) return
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(() => {
      saveTimeout.current = null
      fetch("/api/cart/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, items }),
      }).catch(() => {})
    }, SAVE_DEBOUNCE_MS)
    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current)
    }
  }, [userId, items])

  return null
}
