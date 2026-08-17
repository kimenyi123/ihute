"use client"

import { useState, useEffect, useCallback } from "react"
import { usePathname } from "next/navigation"
import { Bell, X, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { subscribeToPushNotifications } from "@/lib/notification-service"

const VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""

/**
 * Notification Prompt Component
 *
 * Shows a prompt to enable push notifications after user interaction.
 * Silently hides when push infrastructure is unavailable (no VAPID key,
 * dev mode without SW, unsupported browser) — never shows error alerts.
 */
export function NotificationPrompt() {
  const pathname = usePathname()
  const [showPrompt, setShowPrompt] = useState(false)
  const [isSubscribing, setIsSubscribing] = useState(false)
  const [showBlockedHint, setShowBlockedHint] = useState(false)
  const [successMsg, setSuccessMsg] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return

    if (!VAPID_KEY) return
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) return
    if (Notification.permission === "granted" || Notification.permission === "denied") return

    const dismissedAt = localStorage.getItem("notification_prompt_dismissed")
    if (dismissedAt) {
      const daysSinceDismissed = (Date.now() - parseInt(dismissedAt)) / (1000 * 60 * 60 * 24)
      if (daysSinceDismissed < 7) return
    }

    if (pathname === "/login" || pathname === "/grandma/login") return

    const timer = setTimeout(() => setShowPrompt(true), 120_000)
    return () => clearTimeout(timer)
  }, [pathname])

  const handleDismiss = useCallback(() => {
    setShowPrompt(false)
    setShowBlockedHint(false)
    localStorage.setItem("notification_prompt_dismissed", Date.now().toString())
  }, [])

  async function handleEnable() {
    setIsSubscribing(true)
    try {
      if (!("serviceWorker" in navigator)) { handleDismiss(); return }

      try {
        let reg = await navigator.serviceWorker.getRegistration()
        if (!reg) reg = await navigator.serviceWorker.register("/sw.js")
        await navigator.serviceWorker.ready
      } catch {
        console.warn("[Notifications] SW registration skipped")
        handleDismiss()
        return
      }

      const subscription = await subscribeToPushNotifications()

      if (subscription) {
        setSuccessMsg(true)
        setTimeout(() => { setShowPrompt(false); setSuccessMsg(false) }, 2500)
        return
      }

      if (Notification.permission === "denied") {
        setShowBlockedHint(true)
        return
      }

      handleDismiss()
    } catch {
      console.warn("[Notifications] Subscription failed silently")
      handleDismiss()
    } finally {
      setIsSubscribing(false)
    }
  }

  if (!showPrompt) return null

  if (successMsg) {
    return (
      <div className="fixed bottom-4 right-4 z-50 animate-slide-up">
        <div className="bg-white rounded-lg shadow-lg border border-green-200 p-4 max-w-sm flex items-center gap-3">
          <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
          <span className="text-sm font-semibold text-green-800">Notifications enabled!</span>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-slide-up">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4 max-w-sm">
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
            <Bell className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
              {showBlockedHint ? "Notifications blocked" : "Stay Updated"}
            </h3>

            {showBlockedHint ? (
              <>
                <p className="text-gray-600 dark:text-gray-300 text-xs mt-1">
                  To enable: click the <strong>lock or info icon</strong> in the address bar &rarr; <strong>Site settings</strong> &rarr; set <strong>Notifications</strong> to Allow.
                </p>
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    onClick={() => window.location.reload()}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
                  >
                    Refresh &amp; try again
                  </Button>
                  <Button size="sm" variant="ghost" onClick={handleDismiss} className="text-gray-500 text-xs">
                    Not now
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-gray-600 dark:text-gray-300 text-xs mt-1">
                  Get notified when products you&apos;re interested in are available,
                  on sale, or back in stock.
                </p>
                <ul className="text-xs text-gray-500 dark:text-gray-400 mt-2 space-y-1">
                  <li>&#10003; Price drop alerts</li>
                  <li>&#10003; New products matching your searches</li>
                  <li>&#10003; Updates from favorite suppliers</li>
                </ul>
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    onClick={handleEnable}
                    disabled={isSubscribing}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
                  >
                    {isSubscribing ? "Enabling..." : "Enable Notifications"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={handleDismiss} className="text-gray-500 text-xs">
                    Not now
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Inline notification toggle for settings pages.
 * Silently degrades when push infra is unavailable.
 */
export function NotificationToggle() {
  const [isEnabled, setIsEnabled] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setIsLoading(false)
      return
    }
    setIsEnabled(Notification.permission === "granted")
    setIsLoading(false)
  }, [])

  async function handleToggle() {
    if (isEnabled) {
      setStatusMsg("To disable, use browser settings for this site.")
      setTimeout(() => setStatusMsg(null), 4000)
      return
    }

    setIsLoading(true)
    setStatusMsg(null)
    try {
      const subscription = await subscribeToPushNotifications()
      if (subscription) {
        setIsEnabled(true)
        setStatusMsg("Notifications enabled!")
        setTimeout(() => setStatusMsg(null), 3000)
      } else {
        setStatusMsg("Not available right now. Try again later.")
        setTimeout(() => setStatusMsg(null), 4000)
      }
    } catch {
      console.warn("[Notifications] Toggle failed silently")
      setStatusMsg("Not available right now.")
      setTimeout(() => setStatusMsg(null), 4000)
    } finally {
      setIsLoading(false)
    }
  }

  if (typeof window === "undefined" || !("Notification" in window)) {
    return null
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-medium text-gray-900 dark:text-white">Push Notifications</h4>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Receive alerts for price drops, new products, and more
          </p>
        </div>
        <button
          onClick={handleToggle}
          disabled={isLoading}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            isEnabled ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              isEnabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>
      {statusMsg && (
        <p className="mt-1 text-xs font-medium text-blue-600">{statusMsg}</p>
      )}
    </div>
  )
}











