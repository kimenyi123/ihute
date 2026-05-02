"use client"

import { useEffect } from "react"

/**
 * Service Worker Registration Component
 * Registers the service worker for Web Push notifications
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return
    }

    async function registerServiceWorker() {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        })
        console.log("[SW] Service Worker registered:", registration.scope)
      } catch (error) {
        console.warn("[SW] Service Worker registration failed:", error)
      }
    }

    // Avoid SW on `next dev`: stale SW + changing chunk URLs → ChunkLoadError on layout.*.js
    if (process.env.NODE_ENV === "production") {
      registerServiceWorker()
    }
  }, [])

  return null
}

