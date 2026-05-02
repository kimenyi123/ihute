"use client"

import { useEffect, useRef } from 'react'
import { useSession } from '@/hooks/use-session'
import { useAuthStore } from '@/lib/auth-store'
import { useFavoritesStore } from "@/lib/favorites-store"
import { fetchFavorites, flattenFavoriteGroups, mergeFavoritesApi } from "@/lib/favorites-api"
import { CartSyncEffect } from "@/components/cart-sync-effect"

interface SessionProviderProps {
  children: React.ReactNode
}

/**
 * SessionProvider component that manages user session lifecycle
 * Tracks user activity and maintains inactivity-based session timeout
 */
export function SessionProvider({ children }: SessionProviderProps) {
  const { isAuthenticated, checkSession } = useSession()
  const user = useAuthStore((state) => state.user)
  const hasHydrated = useAuthStore((state) => state.hasHydrated)
  const favorites = useFavoritesStore((state) => state.favorites)
  const setFavorites = useFavoritesStore((state) => state.setFavorites)
  const lastSyncedUserRef = useRef<string | null>(null)

  useEffect(() => {
    // Check session on app initialization
    if (isAuthenticated) {
      checkSession()
    }
  }, [isAuthenticated, checkSession])

  useEffect(() => {
    if (!isAuthenticated || !user?.email || !hasHydrated) return
    if (lastSyncedUserRef.current === user.email) return
    lastSyncedUserRef.current = user.email

    const mergeKey = `favorites-merged-${user.email}`

    const run = async () => {
      try {
        if (typeof window !== "undefined" && !sessionStorage.getItem(mergeKey)) {
          const items = favorites
            .filter((f) => !!f.supplierId)
            .map((f) => ({
              productId: f.id,
              supplierId: f.supplierId as string,
              addedAt: f.addedAt,
              lastSeenPrice: f.price,
            }))
          await mergeFavoritesApi(items)
          sessionStorage.setItem(mergeKey, "1")
        }
      } catch (err) {
        console.warn("[Favorites] Merge failed:", err)
      }

      try {
        const groups = await fetchFavorites()
        setFavorites(flattenFavoriteGroups(groups))
      } catch (err) {
        console.warn("[Favorites] Fetch failed:", err)
      }
    }

    run()
  }, [isAuthenticated, user?.email, hasHydrated, favorites, setFavorites])

  // Extend sliding session window on real user activity (60 min from last activity)
  useEffect(() => {
    if (!isAuthenticated) return

    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click']

    const handleActivity = () => {
      useAuthStore.getState().touchSession()
    }

    // Add event listeners
    activityEvents.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true })
    })

    // Cleanup
    return () => {
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleActivity)
      })
    }
  }, [isAuthenticated])

  return (
    <>
      <CartSyncEffect />
      {children}
    </>
  )
}
