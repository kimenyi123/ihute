/**
 * Rating Test Button - For testing the rating popup functionality
 * This component allows testing the rating system without waiting for actual deliveries
 */

"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { orderStatusMonitor } from "@/lib/order-status-monitor"

export function RatingTestButton() {
  const [isLoading, setIsLoading] = useState(false)

  const triggerTestRating = async () => {
    setIsLoading(true)
    
    try {
      // Simulate a delivered order rating trigger
      const testRatingData = {
        orderId: "TEST_" + Date.now(),
        sellerAccount: "TEST_SELLER_001",
        sellerName: "Test Supplier Store",
        items: [
          { code: "ITEM001", name: "Test Product 1" },
          { code: "ITEM002", name: "Test Product 2" }
        ]
      }

      console.log('[RatingTestButton] Triggering test rating:', testRatingData)
      
      // Trigger the rating popup through the order status monitor
      orderStatusMonitor.onRatingTrigger((data) => {
        console.log('[RatingTestButton] Rating callback triggered:', data)
      })

      // Manually trigger the rating notification
      const callbacks = (orderStatusMonitor as any).ratingCallbacks || []
      callbacks.forEach((callback: any) => {
        try {
          callback(testRatingData)
        } catch (error) {
          console.error('[RatingTestButton] Error in callback:', error)
        }
      })

    } catch (error) {
      console.error('[RatingTestButton] Error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button 
      onClick={triggerTestRating}
      disabled={isLoading}
      variant="outline"
      size="sm"
    >
      {isLoading ? "Triggering..." : "🧪 Test Rating Popup"}
    </Button>
  )
}