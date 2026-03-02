/**
 * WebSocket Notifications for Real-time Rating Popups
 * 
 * This service establishes a WebSocket connection to receive real-time
 * notifications when orders are delivered, triggering immediate rating popups.
 */

interface WebSocketMessage {
  type: string
  orderId: number
  sellerAccount: string
  sellerName: string
  timestamp: number
}

interface RatingNotificationData {
  orderId: string
  sellerAccount: string
  sellerName: string
  items: Array<{ code: string; name: string }>
}

type NotificationCallback = (data: RatingNotificationData) => void

class WebSocketNotificationService {
  private ws: WebSocket | null = null
  private callbacks: NotificationCallback[] = []
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000 // Start with 1 second
  private userEmail: string | null = null
  
  /**
   * Initialize WebSocket connection for a user
   */
  connect(userEmail: string) {
    if (!userEmail) {
      console.warn('[WebSocketNotifications] No user email provided')
      return
    }
    
    this.userEmail = userEmail
    this.establishConnection()
  }
  
  /**
   * Establish WebSocket connection
   */
  private establishConnection() {
    if (!this.userEmail) return
    
    try {
      // Use secure WebSocket in production
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsUrl = `${protocol}//${window.location.host}/ws/notifications?email=${encodeURIComponent(this.userEmail)}`
      
      console.log('[WebSocketNotifications] Connecting to:', wsUrl)
      
      this.ws = new WebSocket(wsUrl)
      
      this.ws.onopen = () => {
        console.log('[WebSocketNotifications] Connected successfully')
        this.reconnectAttempts = 0
        this.reconnectDelay = 1000
      }
      
      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data)
          this.handleMessage(message)
        } catch (error) {
          console.error('[WebSocketNotifications] Failed to parse message:', error)
        }
      }
      
      this.ws.onclose = (event) => {
        console.log('[WebSocketNotifications] Connection closed:', event.code, event.reason)
        this.handleReconnect()
      }
      
      this.ws.onerror = (error) => {
        console.error('[WebSocketNotifications] WebSocket error:', error)
      }
      
    } catch (error) {
      console.error('[WebSocketNotifications] Failed to establish connection:', error)
      this.handleReconnect()
    }
  }
  
  /**
   * Handle incoming WebSocket messages
   */
  private async handleMessage(message: WebSocketMessage) {
    console.log('[WebSocketNotifications] Received message:', message)
    
    if (message.type === 'RATING_NOTIFICATION') {
      // Get order details for the rating popup
      try {
        const response = await fetch(`/api/ratings?action=shouldShowPopup&orderId=${message.orderId}`)
        const data = await response.json()
        
        if (data.ok && data.shouldShow) {
          const notificationData: RatingNotificationData = {
            orderId: message.orderId.toString(),
            sellerAccount: message.sellerAccount,
            sellerName: message.sellerName,
            items: data.orderDetails?.items || []
          }
          
          // Trigger rating popup immediately
          this.notifyCallbacks(notificationData)
        }
      } catch (error) {
        console.error('[WebSocketNotifications] Failed to fetch order details:', error)
      }
    }
  }
  
  /**
   * Handle reconnection logic
   */
  private handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WebSocketNotifications] Max reconnection attempts reached')
      return
    }
    
    this.reconnectAttempts++
    
    console.log(`[WebSocketNotifications] Reconnecting in ${this.reconnectDelay}ms (attempt ${this.reconnectAttempts})`)
    
    setTimeout(() => {
      this.establishConnection()
    }, this.reconnectDelay)
    
    // Exponential backoff
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000) // Max 30 seconds
  }
  
  /**
   * Subscribe to rating notifications
   */
  onRatingNotification(callback: NotificationCallback) {
    this.callbacks.push(callback)
    
    return () => {
      const index = this.callbacks.indexOf(callback)
      if (index > -1) {
        this.callbacks.splice(index, 1)
      }
    }
  }
  
  /**
   * Notify all callbacks
   */
  private notifyCallbacks(data: RatingNotificationData) {
    this.callbacks.forEach(callback => {
      try {
        callback(data)
      } catch (error) {
        console.error('[WebSocketNotifications] Error in callback:', error)
      }
    })
  }
  
  /**
   * Disconnect WebSocket
   */
  disconnect() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.callbacks = []
    this.userEmail = null
  }
  
  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }
}

// Global singleton instance
export const webSocketNotifications = new WebSocketNotificationService()

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    webSocketNotifications.disconnect()
  })
}