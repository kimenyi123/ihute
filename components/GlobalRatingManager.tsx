/**
 * Global Rating Manager - Handles rating popups across the entire application
 * 
 * This component should be included in the root layout to provide global
 * rating popup functionality when orders are delivered.
 */

"use client"

import { useEffect, useState } from "react"
import { orderStatusMonitor } from "@/lib/order-status-monitor"
import { RatingModal } from "@/components/RatingModal"
import { sellerAccountFromOrder, sellerNameFromOrder } from "@/lib/order-seller-account"

interface RatingData {
  orderId: string
  sellerAccount: string
  sellerName: string
  items: Array<{ code: string; name: string }>
}

interface NotificationData extends RatingData {
  createdAt: number
}

async function enrichRatingData(data: RatingData): Promise<RatingData> {
  if (data.sellerAccount.trim()) return data
  try {
    const res = await fetch(`/api/orders/details?orderId=${encodeURIComponent(data.orderId)}`, {
      cache: "no-store",
    })
    const json = await res.json()
    if (json.ok && json.order) {
      const seller = json.seller as Record<string, unknown> | undefined
      const account = sellerAccountFromOrder(json.order, seller)
      if (account) {
        return {
          ...data,
          sellerAccount: account,
          sellerName: sellerNameFromOrder(json.order, seller) || data.sellerName,
        }
      }
    }
  } catch (error) {
    console.warn("[GlobalRatingManager] Failed to enrich rating data:", error)
  }
  return data
}

export function GlobalRatingManager() {
  const [activeRating, setActiveRating] = useState<RatingData | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  // Get user email from session/auth
  useEffect(() => {
    // Try to get user email from various sources
    const getUserEmail = () => {
      // Check localStorage for user session
      try {
        const authData = localStorage.getItem('auth')
        if (authData) {
          const parsed = JSON.parse(authData)
          return parsed.email || parsed.user?.email
        }
      } catch (e) {
        console.warn('[GlobalRatingManager] Failed to parse auth data')
      }

      // Check sessionStorage
      try {
        const sessionData = sessionStorage.getItem('user')
        if (sessionData) {
          const parsed = JSON.parse(sessionData)
          return parsed.email
        }
      } catch (e) {
        console.warn('[GlobalRatingManager] Failed to parse session data')
      }

      return null
    }

    const email = getUserEmail()
    setUserEmail(email)
    console.log('[GlobalRatingManager] User email:', email)
  }, [])

  // Poll for rating notifications
  useEffect(() => {
    if (!userEmail) return

    console.log('[GlobalRatingManager] Starting notification polling for:', userEmail)

    const pollNotifications = async () => {
      try {
        // Poll both browser notifications (immediate) and rating notifications (persistent)
        const [browserResponse, ratingResponse] = await Promise.all([
          fetch(`/api/browser-notifications?buyerEmail=${encodeURIComponent(userEmail)}`, {
            cache: 'no-store'
          }),
          fetch(`/api/rating-notifications?buyerEmail=${encodeURIComponent(userEmail)}`, {
            cache: 'no-store'
          })
        ])

        // Check browser notifications first (immediate)
        if (browserResponse.ok) {
          const browserData = await browserResponse.json()
          
          if (browserData.ok && browserData.notifications && browserData.notifications.length > 0) {
            const notification = browserData.notifications[0]
            
            console.log('[GlobalRatingManager] New browser notification:', notification)
            
            const rating = await enrichRatingData({
              orderId: notification.data.orderId.toString(),
              sellerAccount: sellerAccountFromOrder(notification.data as Record<string, unknown>),
              sellerName: sellerNameFromOrder(notification.data as Record<string, unknown>),
              items: notification.data.items
            })
            setActiveRating(rating)
            setShowModal(true)
            return // Don't check rating notifications if we have browser notifications
          }
        }

        // Check rating notifications (persistent)
        if (ratingResponse.ok) {
          const ratingData = await ratingResponse.json()
          
          if (ratingData.ok && ratingData.notifications && ratingData.notifications.length > 0) {
            const notification: NotificationData = ratingData.notifications[0]
            
            console.log('[GlobalRatingManager] New rating notification:', notification)
            
            const rating = await enrichRatingData({
              orderId: notification.orderId.toString(),
              sellerAccount: sellerAccountFromOrder(notification as unknown as Record<string, unknown>),
              sellerName: sellerNameFromOrder(notification as unknown as Record<string, unknown>),
              items: notification.items
            })
            setActiveRating(rating)
            setShowModal(true)

            // Mark as processed
            await fetch('/api/rating-notifications', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'markProcessed',
                orderId: notification.orderId,
                buyerEmail: userEmail
              })
            })
          }
        }
      } catch (error) {
        console.error('[GlobalRatingManager] Polling error:', error)
      }
    }

    // Initial poll
    pollNotifications()

    // Set up polling interval (every 10 seconds for immediate notifications)
    const interval = setInterval(pollNotifications, 10000)

    return () => {
      console.log('[GlobalRatingManager] Stopping notification polling')
      clearInterval(interval)
    }
  }, [userEmail])

  // Subscribe to rating triggers from the order status monitor (for immediate updates)
  useEffect(() => {
    console.log('[GlobalRatingManager] Initializing order status monitor')

    const unsubscribe = orderStatusMonitor.onRatingTrigger(async (data) => {
      console.log('[GlobalRatingManager] Rating triggered for order:', data.orderId)
      
      const rating = await enrichRatingData(data)
      setActiveRating(rating)
      setShowModal(true)
    })

    return () => {
      console.log('[GlobalRatingManager] Cleaning up order status monitor')
      unsubscribe()
    }
  }, [])

  const handleClose = () => {
    console.log('[GlobalRatingManager] Closing rating modal')
    setShowModal(false)
    setActiveRating(null)
  }

  const handleSuccess = () => {
    console.log('[GlobalRatingManager] Rating submitted successfully')
    setShowModal(false)
    setActiveRating(null)
  }

  if (!activeRating) {
    return null
  }

  return (
    <RatingModal
      orderId={activeRating.orderId}
      sellerId={activeRating.sellerAccount}
      sellerName={activeRating.sellerName}
      buyerPhone=""
      items={activeRating.items}
      open={showModal}
      onClose={handleClose}
      onSuccess={handleSuccess}
    />
  )
}