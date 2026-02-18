/**
 * Order Status Monitor - Real-time order status tracking with rating popup triggers
 * 
 * This service monitors order status changes and automatically shows rating popups
 * when orders are marked as DELIVERED by suppliers.
 */

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
  
  private readonly POLL_INTERVAL = 10000 // 10 seconds
  private readonly MAX_MONITORED_ORDERS = 50 // Prevent memory leaks

  /**
   * Start monitoring an order for status changes
   */
  startMonitoring(orderId: string, currentStatus?: string) {
    console.log(`[OrderStatusMonitor] Starting monitoring for order ${orderId}`)
    
    this.monitoredOrders.add(orderId)
    
    if (currentStatus) {
      this.lastCheckedStatuses.set(orderId, currentStatus.toLowerCase())
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
   * Manually check order status (for immediate checks)
   */
  async checkOrderStatus(orderId: string): Promise<string | null> {
    try {
      const response = await fetch(`/api/order-status?orderId=${orderId}`, {
        cache: 'no-store'
      })
      
      if (!response.ok) {
        console.error(`[OrderStatusMonitor] Failed to check status for order ${orderId}`)
        return null
      }
      
      const data = await response.json()
      
      if (data.ok && data.status) {
        const newStatus = data.status.toLowerCase()
        const oldStatus = this.lastCheckedStatuses.get(orderId)
        
        if (oldStatus && oldStatus !== newStatus) {
          this.handleStatusChange(orderId, oldStatus, newStatus)
        }
        
        this.lastCheckedStatuses.set(orderId, newStatus)
        return newStatus
      }
      
      return null
    } catch (error) {
      console.error(`[OrderStatusMonitor] Error checking status for order ${orderId}:`, error)
      return null
    }
  }

  /**
   * Force check for rating popup (for immediate delivery notifications)
   */
  async triggerRatingCheck(orderId: string) {
    console.log(`[OrderStatusMonitor] Force checking rating for order ${orderId}`)
    
    try {
      const response = await fetch(`/api/ratings?action=shouldShowPopup&orderId=${orderId}`, {
        cache: 'no-store'
      })
      
      const data = await response.json()
      
      if (data.ok && data.shouldShow) {
        const ratingData: RatingTriggerData = {
          orderId,
          sellerAccount: data.orderDetails?.sellerAccount || '',
          sellerName: data.orderDetails?.sellerName || 'Unknown Seller',
          items: data.orderDetails?.items || []
        }
        
        this.notifyRatingTrigger(ratingData)
      }
    } catch (error) {
      console.error(`[OrderStatusMonitor] Error checking rating for order ${orderId}:`, error)
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

    console.log(`[OrderStatusMonitor] Polling ${this.monitoredOrders.size} orders`)

    const promises = Array.from(this.monitoredOrders).map(orderId => 
      this.checkOrderStatus(orderId)
    )

    try {
      await Promise.allSettled(promises)
    } catch (error) {
      console.error('[OrderStatusMonitor] Error during polling:', error)
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
    if (newStatus === 'delivered' && oldStatus !== 'delivered') {
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
    console.log('[OrderStatusMonitor] Cleaning up')
    this.stopPolling()
    this.monitoredOrders.clear()
    this.lastCheckedStatuses.clear()
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