/**
 * Order Status Monitor - Real-time order status tracking with rating popup triggers
 * 
 * This service monitors order status changes and automatically shows rating popups
 * when orders are marked as DELIVERED by suppliers.
 */

import { mapBackendOrderStatusToTrack, statusIndicatesDelivered } from "@/lib/order-status-map"
import { sellerAccountFromOrder, sellerNameFromOrder } from "@/lib/order-seller-account"

const FETCH_TIMEOUT_MS = 20_000
const MAX_STATUS_RETRIES = 2
const RETRY_DELAY_MS = 1_500

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isTransientNetworkError(err: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true
  if (err instanceof DOMException && err.name === "AbortError") return true
  if (err instanceof Error && err.name === "AbortError") return true
  if (err instanceof TypeError && /failed to fetch|networkerror|load failed/i.test(err.message)) {
    return true
  }
  return false
}

async function fetchWithTimeout(url: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { cache: "no-store", signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

interface OrderStatusUpdate {
  orderId: string
  oldStatus: string
  newStatus: string
  timestamp: number
}

interface RatingTriggerData {
  orderId: string
  sellerAccount: string
  sellerName: string
  items: Array<{ code: string; name: string }>
}

type StatusChangeCallback = (update: OrderStatusUpdate) => void
type RatingTriggerCallback = (data: RatingTriggerData) => void

class OrderStatusMonitor {
  private statusCallbacks: StatusChangeCallback[] = []
  private ratingCallbacks: RatingTriggerCallback[] = []
  private monitoredOrders: Set<string> = new Set()
  private pollingInterval: NodeJS.Timeout | null = null
  private lastCheckedStatuses: Map<string, string> = new Map()
  private inFlightChecks: Map<string, Promise<string | null>> = new Map()
  private isPolling = false
  
  private readonly POLL_INTERVAL = 10000 // 10 seconds
  private readonly MAX_MONITORED_ORDERS = 50 // Prevent memory leaks

  /**
   * Start monitoring an order for status changes
   */
  startMonitoring(orderId: string, currentStatus?: string) {
    console.log(`[OrderStatusMonitor] Starting monitoring for order ${orderId}`)
    
    this.monitoredOrders.add(orderId)
    
    if (currentStatus) {
      this.lastCheckedStatuses.set(orderId, mapBackendOrderStatusToTrack(currentStatus, undefined))
    }
    
    // Limit monitored orders to prevent memory issues
    if (this.monitoredOrders.size > this.MAX_MONITORED_ORDERS) {
      const firstOrder = this.monitoredOrders.values().next().value
      if (firstOrder) {
        this.stopMonitoring(firstOrder)
      }
    }
    
    this.ensurePollingActive()
  }

  /**
   * Stop monitoring an order
   */
  stopMonitoring(orderId: string) {
    console.log(`[OrderStatusMonitor] Stopping monitoring for order ${orderId}`)
    this.monitoredOrders.delete(orderId)
    this.lastCheckedStatuses.delete(orderId)
    
    if (this.monitoredOrders.size === 0) {
      this.stopPolling()
    }
  }

  /**
   * Subscribe to status change notifications
   */
  onStatusChange(callback: StatusChangeCallback) {
    this.statusCallbacks.push(callback)
    return () => {
      const index = this.statusCallbacks.indexOf(callback)
      if (index > -1) {
        this.statusCallbacks.splice(index, 1)
      }
    }
  }

  /**
   * Subscribe to rating trigger notifications
   */
  onRatingTrigger(callback: RatingTriggerCallback) {
    this.ratingCallbacks.push(callback)
    return () => {
      const index = this.ratingCallbacks.indexOf(callback)
      if (index > -1) {
        this.ratingCallbacks.splice(index, 1)
      }
    }
  }

  /**
   * Manually check order status (for immediate checks).
   * Deduplicates concurrent checks for the same orderId.
   */
  async checkOrderStatus(orderId: string): Promise<string | null> {
    const inFlight = this.inFlightChecks.get(orderId)
    if (inFlight) return inFlight

    const promise = this.checkOrderStatusOnce(orderId)
    this.inFlightChecks.set(orderId, promise)
    try {
      return await promise
    } finally {
      this.inFlightChecks.delete(orderId)
    }
  }

  private async checkOrderStatusOnce(orderId: string, attempt = 0): Promise<string | null> {
    let controller: AbortController | undefined
    try {
      controller = new AbortController()
      const timer = setTimeout(() => controller!.abort(), FETCH_TIMEOUT_MS)

      let response: Response
      try {
        response = await fetch(`/api/order-status?orderId=${orderId}`, {
          cache: "no-store",
          signal: controller.signal,
        })
      } finally {
        clearTimeout(timer)
      }

      if (!response.ok) {
        if (response.status >= 500 && attempt < MAX_STATUS_RETRIES) {
          await delay(RETRY_DELAY_MS * (attempt + 1))
          return this.checkOrderStatusOnce(orderId, attempt + 1)
        }
        console.warn(`[OrderStatusMonitor] Status check HTTP ${response.status} for order ${orderId}`)
        return null
      }

      const data = await response.json()

      if (data.ok) {
        const rawOrder = String(data.ORDER_STATUS ?? "").trim()
        const rawPayment = String(data.paymentStatus ?? data.payment_status ?? "").trim()
        const newStatus = mapBackendOrderStatusToTrack(
          rawOrder || String(data.status ?? "").trim() || undefined,
          rawPayment || undefined,
        )
        const oldStatus = this.lastCheckedStatuses.get(orderId)

        if (oldStatus && oldStatus !== newStatus) {
          this.handleStatusChange(orderId, oldStatus, newStatus)
        }

        this.lastCheckedStatuses.set(orderId, newStatus)
        return newStatus
      }

      return null
    } catch (error) {
      if (isTransientNetworkError(error, controller?.signal) && attempt < MAX_STATUS_RETRIES) {
        await delay(RETRY_DELAY_MS * (attempt + 1))
        return this.checkOrderStatusOnce(orderId, attempt + 1)
      }

      if (isTransientNetworkError(error, controller?.signal)) {
        console.warn(
          `[OrderStatusMonitor] Transient network error for order ${orderId} (route may still be compiling)`,
        )
      } else {
        console.error(`[OrderStatusMonitor] Error checking status for order ${orderId}:`, error)
      }
      return null
    }
  }

  /**
   * Force check for rating popup (for immediate delivery notifications)
   */
  async triggerRatingCheck(orderId: string) {
    console.log(`[OrderStatusMonitor] Force checking rating for order ${orderId}`)

    try {
      const response = await fetchWithTimeout(`/api/ratings?action=shouldShowPopup&orderId=${orderId}`)

      if (!response.ok) {
        console.warn(`[OrderStatusMonitor] Rating check HTTP ${response.status} for order ${orderId}`)
        return
      }

      const data = await response.json()

      if (data.ok && data.shouldShow) {
        const ratingData: RatingTriggerData = {
          orderId,
          sellerAccount: sellerAccountFromOrder(data.orderDetails as Record<string, unknown> | undefined),
          sellerName: sellerNameFromOrder(data.orderDetails as Record<string, unknown> | undefined),
          items: data.orderDetails?.items || [],
        }

        this.notifyRatingTrigger(ratingData)
      }
    } catch (error) {
      if (isTransientNetworkError(error)) {
        console.warn(`[OrderStatusMonitor] Transient error checking rating for order ${orderId}`)
      } else {
        console.error(`[OrderStatusMonitor] Error checking rating for order ${orderId}:`, error)
      }
    }
  }

  private ensurePollingActive() {
    if (!this.pollingInterval && this.monitoredOrders.size > 0) {
      console.log('[OrderStatusMonitor] Starting polling')
      this.pollingInterval = setInterval(() => {
        this.pollOrderStatuses()
      }, this.POLL_INTERVAL)
    }
  }

  private stopPolling() {
    if (this.pollingInterval) {
      console.log('[OrderStatusMonitor] Stopping polling')
      clearInterval(this.pollingInterval)
      this.pollingInterval = null
    }
  }

  private async pollOrderStatuses() {
    if (this.monitoredOrders.size === 0) {
      this.stopPolling()
      return
    }
    if (this.isPolling) return

    this.isPolling = true
    try {
      for (const orderId of this.monitoredOrders) {
        await this.checkOrderStatus(orderId)
      }
    } catch (error) {
      console.warn("[OrderStatusMonitor] Error during polling:", error)
    } finally {
      this.isPolling = false
    }
  }

  private handleStatusChange(orderId: string, oldStatus: string, newStatus: string) {
    console.log(`[OrderStatusMonitor] Status change detected for order ${orderId}: ${oldStatus} -> ${newStatus}`)
    
    const update: OrderStatusUpdate = {
      orderId,
      oldStatus,
      newStatus,
      timestamp: Date.now()
    }
    
    // Notify status change subscribers
    this.statusCallbacks.forEach(callback => {
      try {
        callback(update)
      } catch (error) {
        console.error('[OrderStatusMonitor] Error in status callback:', error)
      }
    })
    
    // Check if this is a delivery status change that should trigger rating
    if (statusIndicatesDelivered(newStatus) && !statusIndicatesDelivered(oldStatus)) {
      console.log(`[OrderStatusMonitor] Order ${orderId} delivered - triggering rating check`)
      this.triggerRatingCheck(orderId)
    }
  }

  private notifyRatingTrigger(data: RatingTriggerData) {
    console.log(`[OrderStatusMonitor] Triggering rating popup for order ${data.orderId}`)
    
    this.ratingCallbacks.forEach(callback => {
      try {
        callback(data)
      } catch (error) {
        console.error('[OrderStatusMonitor] Error in rating callback:', error)
      }
    })
  }

  /**
   * Cleanup all monitoring
   */
  cleanup() {
    console.log("[OrderStatusMonitor] Cleaning up")
    this.stopPolling()
    this.monitoredOrders.clear()
    this.lastCheckedStatuses.clear()
    this.inFlightChecks.clear()
    this.isPolling = false
    this.statusCallbacks.length = 0
    this.ratingCallbacks.length = 0
  }
}

// Global singleton instance
export const orderStatusMonitor = new OrderStatusMonitor()

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    orderStatusMonitor.cleanup()
  })
}