"use client"

import { useEffect, useRef } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useSession } from "@/hooks/use-session"
import { useAuthStore } from "@/lib/auth-store"
import { useFavoritesStore } from "@/lib/favorites-store"
import { fetchFavorites, flattenFavoriteGroups, mergeFavoritesApi } from "@/lib/favorites-api"
import { CartSyncEffect } from "@/components/cart-sync-effect"

interface SessionProviderProps {
  children: React.ReactNode
}

const TOUCH_DEBOUNCE_MS = 60_000

/**
 * SessionProvider — inactivity + absolute session timeout.
 * Default: 30 min idle / 8 h absolute (15 min idle for admin).
 */
export function SessionProvider({ children }: SessionProviderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { isAuthenticated, checkSession } = useSession()
  const user = useAuthStore((state) => state.user)
  const hasHydrated = useAuthStore((state) => state.hasHydrated)
  const sessionExpiredReason = useAuthStore((state) => state.sessionExpiredReason)
  const favorites = useFavoritesStore((state) => state.favorites)
  const setFavorites = useFavoritesStore((state) => state.setFavorites)
  const lastSyncedUserRef = useRef<string | null>(null)
  const lastTouchRef = useRef(0)

  useEffect(() => {
    if (isAuthenticated) {
      checkSession()
    }
  }, [isAuthenticated, checkSession])

  // After forced logout, send user to login once
  useEffect(() => {
    if (!hasHydrated || isAuthenticated || !sessionExpiredReason) return
    const onLoginPage =
      pathname === "/login" ||
      pathname?.startsWith("/login/") ||
      pathname === "/grandma/login" ||
      pathname?.startsWith("/grandma/login")
    if (onLoginPage) return
    const redirect = pathname && pathname !== "/" ? `?redirect=${encodeURIComponent(pathname)}` : ""
    router.replace(`/login${redirect}`)
  }, [hasHydrated, isAuthenticated, sessionExpiredReason, pathname, router])

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

  // Debounced activity → sliding idle window (at most once per minute)
  useEffect(() => {
    if (!isAuthenticated) return

    const activityEvents = ["mousedown", "keydown", "scroll", "touchstart", "click"] as const

    const handleActivity = () => {
      const now = Date.now()
      if (now - lastTouchRef.current < TOUCH_DEBOUNCE_MS) return
      lastTouchRef.current = now
      useAuthStore.getState().touchSession()
    }

    activityEvents.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true })
    })

    return () => {
      activityEvents.forEach((event) => {
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
