"use client"

import { useState, useEffect } from "react"
import { Bell, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { subscribeToPushNotifications } from "@/lib/notification-service"

/**
 * Notification Prompt Component
 * 
 * Shows a prompt to enable push notifications after user interaction.
 * Only appears:
 * - After user has browsed for a bit (not immediately)
 * - If notifications are not already enabled
 * - If user hasn't dismissed the prompt recently
 */
export function NotificationPrompt() {
  const [showPrompt, setShowPrompt] = useState(false)
  const [isSubscribing, setIsSubscribing] = useState(false)

  useEffect(() => {
    // Check if we should show the prompt
    if (typeof window === "undefined") return
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return
    
    // Don't show if already granted or denied
    if (Notification.permission === "granted" || Notification.permission === "denied") {
      return
    }

    // Don't show if dismissed recently (within 7 days)
    const dismissedAt = localStorage.getItem("notification_prompt_dismissed")
    if (dismissedAt) {
      const daysSinceDismissed = (Date.now() - parseInt(dismissedAt)) / (1000 * 60 * 60 * 24)
      if (daysSinceDismissed < 7) return
    }

    // Show prompt 2 minutes (120 seconds) after page load to avoid conflict with location popup
    const timer = setTimeout(() => {
      setShowPrompt(true)
    }, 120000) // 2 minutes = 120,000ms

    return () => clearTimeout(timer)
  }, [])

  async function handleEnable() {
    setIsSubscribing(true)
    try {
      console.log("[Notifications] Starting subscription process...")
      
      // Check if service worker is supported
      if (!("serviceWorker" in navigator)) {
        alert("Push notifications are not supported in this browser. Please use a modern browser like Chrome, Firefox, or Edge.")
        setIsSubscribing(false)
        return
      }
      
      // Check if service worker is registered
      let registration: ServiceWorkerRegistration | null = null
      try {
        registration = (await navigator.serviceWorker.getRegistration()) ?? null
        if (!registration) {
          console.log("[Notifications] Service worker not registered, registering now...")
          registration = await navigator.serviceWorker.register("/sw.js")
          console.log("[Notifications] Service worker registered, waiting for activation...")
          // Wait for service worker to be ready
          await navigator.serviceWorker.ready
          console.log("[Notifications] Service worker is ready")
        } else {
          console.log("[Notifications] Service worker already registered")
          // Ensure it's ready
          await navigator.serviceWorker.ready
        }
      } catch (swError) {
        console.error("[Notifications] Service worker error:", swError)
        alert("Failed to register service worker. Please check your browser settings and try again.")
        setIsSubscribing(false)
        return
      }
      
      // Now subscribe
      const subscription = await subscribeToPushNotifications()
      if (subscription) {
        console.log("[Notifications] ✅ Subscribed successfully!")
        setShowPrompt(false)
        // Show success message
        alert("✅ Notifications enabled! You'll now receive alerts for price drops, new products, and more.")
      } else {
        console.warn("[Notifications] Subscription returned null")
        alert("Failed to enable notifications. Please check your browser settings and try again.")
      }
    } catch (error: any) {
      console.error("[Notifications] Error subscribing:", error)
      alert(`Failed to enable notifications: ${error?.message || "Unknown error"}. Please try again.`)
    } finally {
      setIsSubscribing(false)
    }
  }

  function handleDismiss() {
    setShowPrompt(false)
    localStorage.setItem("notification_prompt_dismissed", Date.now().toString())
  }

  if (!showPrompt) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-slide-up">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4 max-w-sm">
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Content */}
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
            <Bell className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
              Stay Updated
            </h3>
            <p className="text-gray-600 dark:text-gray-300 text-xs mt-1">
              Get notified when products you&apos;re interested in are available, 
              on sale, or back in stock.
            </p>
            
            {/* Benefits list */}
            <ul className="text-xs text-gray-500 dark:text-gray-400 mt-2 space-y-1">
              <li>✓ Price drop alerts</li>
              <li>✓ New products matching your searches</li>
              <li>✓ Updates from favorite suppliers</li>
            </ul>

            {/* Buttons */}
            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                onClick={handleEnable}
                disabled={isSubscribing}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
              >
                {isSubscribing ? "Enabling..." : "Enable Notifications"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDismiss}
                className="text-gray-500 text-xs"
              >
                Not now
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Inline notification toggle for settings pages
 */
export function NotificationToggle() {
  const [isEnabled, setIsEnabled] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (typeof window === "undefined") {
      setIsLoading(false)
      return
    }
    
    if (!("Notification" in window)) {
      setIsLoading(false)
      return
    }

    setIsEnabled(Notification.permission === "granted")
    setIsLoading(false)
  }, [])

  async function handleToggle() {
    if (isEnabled) {
      // Can't programmatically revoke - show instructions
      alert("To disable notifications, go to your browser settings and block notifications for this site.")
      return
    }

    setIsLoading(true)
    try {
      const subscription = await subscribeToPushNotifications()
      setIsEnabled(!!subscription)
    } catch (error) {
      console.error("[Notifications] Error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  if (typeof window === "undefined" || !("Notification" in window)) {
    return (
      <div className="text-gray-500 text-sm">
        Notifications not supported in this browser
      </div>
    )
  }

  return (
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
  )
}











