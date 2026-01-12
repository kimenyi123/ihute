"use client"

import { useEffect } from 'react'
import { useSession } from '@/hooks/use-session'
import { useAuthStore } from '@/lib/auth-store'

interface SessionProviderProps {
  children: React.ReactNode
}

/**
 * SessionProvider component that manages user session lifecycle
 * Tracks user activity and maintains inactivity-based session timeout
 */
export function SessionProvider({ children }: SessionProviderProps) {
  const { isAuthenticated, checkSession } = useSession()
  const updateActivity = useAuthStore((state) => state.updateActivity)

  useEffect(() => {
    // Check session on app initialization
    if (isAuthenticated) {
      checkSession()
    }
  }, [isAuthenticated, checkSession])

  // Track user activity to prevent inactivity timeout
  useEffect(() => {
    if (!isAuthenticated) return

    // Events that indicate user activity
    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click']

    // Throttle activity updates to avoid excessive state changes
    let lastUpdate = 0
    const THROTTLE_MS = 30000 // Update at most once per 30 seconds

    const handleActivity = () => {
      const now = Date.now()
      if (now - lastUpdate > THROTTLE_MS) {
        updateActivity()
        lastUpdate = now
      }
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
  }, [isAuthenticated, updateActivity])

  return <>{children}</>
}
