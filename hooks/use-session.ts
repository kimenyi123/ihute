import { useEffect, useRef } from "react"
import { useAuthStore } from "@/lib/auth-store"

/**
 * Polls session expiry (idle + absolute) while authenticated.
 */
export function useSession() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const checkSession = useAuthStore((s) => s.checkSession)
  const logout = useAuthStore((s) => s.logout)
  const touchSession = useAuthStore((s) => s.touchSession)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (isAuthenticated) {
      if (!checkSession()) {
        return
      }

      // Check every 30s so idle logout feels timely
      intervalRef.current = setInterval(() => {
        checkSession()
      }, 30_000)

      const handleVisibilityChange = () => {
        if (document.visibilityState !== "visible") return
        if (!checkSession()) return
        // Returning to tab counts as activity (debounced elsewhere too)
        touchSession()
      }

      document.addEventListener("visibilitychange", handleVisibilityChange)

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
        }
        document.removeEventListener("visibilitychange", handleVisibilityChange)
      }
    }

    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [isAuthenticated, checkSession, touchSession])

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  return {
    isAuthenticated,
    logout,
    checkSession,
    touchSession,
  }
}
