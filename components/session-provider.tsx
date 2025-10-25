"use client"

import { useEffect } from 'react'
import { useSession } from '@/hooks/use-session'

interface SessionProviderProps {
  children: React.ReactNode
}

/**
 * SessionProvider component that manages user session lifecycle
 * This ensures sessions are properly managed across the application
 */
export function SessionProvider({ children }: SessionProviderProps) {
  const { isAuthenticated, checkSession } = useSession()

  useEffect(() => {
    // Check session on app initialization
    if (isAuthenticated) {
      checkSession()
    }
  }, [isAuthenticated, checkSession])

  return <>{children}</>
}
