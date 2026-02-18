/**
 * Order Tracking Hook - Easy integration for components that need order monitoring
 * 
 * This hook provides a simple interface for components to monitor specific orders
 * and get notified of status changes.
 */

"use client"

import { useEffect, useState, useCallback } from "react"
import { orderStatusMonitor } from "@/lib/order-status-monitor"

interface UseOrderTrackingOptions {
  orderId: string
  initialStatus?: string
  autoStart?: boolean
}

interface OrderTrackingState {
  currentStatus: string | null
  isMonitoring: boolean
  lastUpdate: number | null
}

export function useOrderTracking({ 
  orderId, 
  initialStatus, 
  autoStart = true 
}: UseOrderTrackingOptions) {
  const [state, setState] = useState<OrderTrackingState>({
    currentStatus: initialStatus || null,
    isMonitoring: false,
    lastUpdate: null
  })

  // Start monitoring
  const startMonitoring = useCallback(() => {
    if (!orderId || state.isMonitoring) return

    console.log(`[useOrderTracking] Starting monitoring for order ${orderId}`)
    
    orderStatusMonitor.startMonitoring(orderId, state.currentStatus || undefined)
    
    setState(prev => ({
      ...prev,
      isMonitoring: true
    }))
  }, [orderId, state.currentStatus, state.isMonitoring])

  // Stop monitoring
  const stopMonitoring = useCallback(() => {
    if (!orderId || !state.isMonitoring) return

    console.log(`[useOrderTracking] Stopping monitoring for order ${orderId}`)
    
    orderStatusMonitor.stopMonitoring(orderId)
    
    setState(prev => ({
      ...prev,
      isMonitoring: false
    }))
  }, [orderId, state.isMonitoring])

  // Manual status check
  const checkStatus = useCallback(async () => {
    if (!orderId) return null

    const status = await orderStatusMonitor.checkOrderStatus(orderId)
    
    if (status) {
      setState(prev => ({
        ...prev,
        currentStatus: status,
        lastUpdate: Date.now()
      }))
    }
    
    return status
  }, [orderId])

  // Force rating check (useful for testing or manual triggers)
  const triggerRatingCheck = useCallback(() => {
    if (!orderId) return

    orderStatusMonitor.triggerRatingCheck(orderId)
  }, [orderId])

  // Subscribe to status changes for this specific order
  useEffect(() => {
    if (!orderId) return

    const unsubscribe = orderStatusMonitor.onStatusChange((update) => {
      if (update.orderId === orderId) {
        console.log(`[useOrderTracking] Status update for order ${orderId}:`, update)
        
        setState(prev => ({
          ...prev,
          currentStatus: update.newStatus,
          lastUpdate: update.timestamp
        }))
      }
    })

    return unsubscribe
  }, [orderId])

  // Auto-start monitoring if enabled
  useEffect(() => {
    if (autoStart && orderId && !state.isMonitoring) {
      startMonitoring()
    }

    // Cleanup on unmount
    return () => {
      if (state.isMonitoring) {
        stopMonitoring()
      }
    }
  }, [autoStart, orderId, startMonitoring, stopMonitoring, state.isMonitoring])

  return {
    // State
    currentStatus: state.currentStatus,
    isMonitoring: state.isMonitoring,
    lastUpdate: state.lastUpdate,
    
    // Actions
    startMonitoring,
    stopMonitoring,
    checkStatus,
    triggerRatingCheck,
    
    // Computed
    isDelivered: state.currentStatus === 'delivered',
    isPending: state.currentStatus === 'pending',
    isProcessing: state.currentStatus === 'processing',
    isInvoiced: state.currentStatus === 'invoice'
  }
}