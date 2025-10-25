import { useEffect, useRef } from 'react'
import { useAuthStore } from '@/lib/auth-store'

/**
 * Hook to manage user session with automatic timeout checking
 * This ensures users are logged out when their session expires
 */
export function useSession() {
  const { isAuthenticated, checkSession, logout } = useAuthStore()
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Only set up session checking if user is authenticated
    if (isAuthenticated) {
      // Check session immediately
      if (!checkSession()) {
        return
      }

      // Set up interval to check session every minute
      intervalRef.current = setInterval(() => {
        if (!checkSession()) {
          // Session expired, user will be logged out automatically
          console.log('Session expired, user logged out')
        }
      }, 60000) // Check every minute

      // Also check on page visibility change (when user comes back to tab)
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible' && !checkSession()) {
          console.log('Session expired on tab focus, user logged out')
        }
      }

      document.addEventListener('visibilitychange', handleVisibilityChange)

      // Cleanup function
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
        }
        document.removeEventListener('visibilitychange', handleVisibilityChange)
      }
    } else {
      // Clear any existing interval if user is not authenticated
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [isAuthenticated, checkSession])

  // Cleanup on unmount
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
  }
}
