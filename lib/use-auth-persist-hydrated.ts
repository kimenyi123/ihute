"use client"

import { useEffect, useState } from "react"
import { useAuthStore } from "@/lib/auth-store"

/**
 * True after zustand `persist` has rehydrated auth from localStorage.
 * Use before redirecting unauthenticated users, so a refresh does not flash `false` and log them out.
 */
export function useAuthPersistHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const store = useAuthStore as unknown as {
      persist?: { hasHydrated?: () => boolean; onFinishHydration?: (fn: () => void) => () => void }
    }
    const done = () => setHydrated(true)
    setHydrated(!!store.persist?.hasHydrated?.())
    const unsub = store.persist?.onFinishHydration?.(done)
    return () => {
      unsub?.()
    }
  }, [])

  return hydrated
}
