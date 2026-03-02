/**
 * Rating Debug Panel - For testing and debugging the rating notification system
 * Add this component temporarily to test the rating system
 */

"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export function RatingDebugPanel() {
  const [orderId, setOrderId] = useState("2865")
  const [buyerEmail, setBuyerEmail] = useState("")
  const [results, setResults] = useState<string>("")
  const [loading, setLoading] = useState(false)

  const testRatingNotification = async () => {
    setLoading(true)
    setResults("Testing rating notification...\n")
    
    try {
      // 1. Test backend notification trigger
      const backendResponse = await fetch(`/api/order-status?action=testRatingNotification&orderId=${orderId}`, {
        cache: 'no-store'
      })
      
      const backendData = await backendResponse.json()
      setResults(prev => prev + `Backend Test: ${JSON.stringify(backendData, null, 2)}\n\n`)
      
      // 2. Test rating popup check
      const ratingResponse = await fetch(`/api/ratings?action=shouldShowPopup&orderId=${orderId}`, {
        cache: 'no-store'
      })
      
      const ratingData = await ratingResponse.json()
      setResults(prev => prev + `Rating Check: ${JSON.stringify(ratingData, null, 2)}\n\n`)
      
      // 3. Test notification polling
      if (buyerEmail) {
        const notificationResponse = await fetch(`/api/rating-notifications?buyerEmail=${encodeURIComponent(buyerEmail)}`, {
          cache: 'no-store'
        })
        
        const notificationData = await notificationResponse.json()
        setResults(prev => prev + `Notifications: ${JSON.stringify(notificationData, null, 2)}\n\n`)
      }
      
    } catch (error) {
      setResults(prev => prev + `Error: ${error}\n`)
    } finally {
      setLoading(false)
    }
  }

  const triggerTestPopup = () => {
    // Manually trigger the global rating manager
    const testData = {
      orderId: orderId,
      sellerAccount: "TEST_SELLER",
      sellerName: "Test Seller Store",
      items: [
        { code: "ITEM001", name: "Test Product 1" },
        { code: "ITEM002", name: "Test Product 2" }
      ]
    }

    // Dispatch a custom event that the GlobalRatingManager can listen to
    window.dispatchEvent(new CustomEvent('test-rating-popup', { detail: testData }))
    setResults(prev => prev + `Test popup triggered with data: ${JSON.stringify(testData, null, 2)}\n`)
  }

  const checkOrderStatus = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/order-status?orderId=${orderId}`, {
        cache: 'no-store'
      })
      
      const data = await response.json()
      setResults(prev => prev + `Order Status: ${JSON.stringify(data, null, 2)}\n\n`)
      
    } catch (error) {
      setResults(prev => prev + `Status Check Error: ${error}\n`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-2xl mx-auto mt-8 border-2 border-orange-200">
      <CardHeader>
        <CardTitle className="text-orange-600">🧪 Rating System Debug Panel</CardTitle>
        <CardDescription>
          Test and debug the rating notification system
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="orderId">Order ID</Label>
            <Input
              id="orderId"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              placeholder="Enter order ID"
            />
          </div>
          <div>
            <Label htmlFor="buyerEmail">Buyer Email (optional)</Label>
            <Input
              id="buyerEmail"
              value={buyerEmail}
              onChange={(e) => setBuyerEmail(e.target.value)}
              placeholder="buyer@example.com"
            />
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button 
            onClick={testRatingNotification} 
            disabled={loading || !orderId}
            variant="default"
          >
            {loading ? "Testing..." : "Test Full System"}
          </Button>
          
          <Button 
            onClick={triggerTestPopup} 
            disabled={!orderId}
            variant="outline"
          >
            Test Popup Only
          </Button>
          
          <Button 
            onClick={checkOrderStatus} 
            disabled={loading || !orderId}
            variant="secondary"
          >
            Check Order Status
          </Button>
        </div>

        <div>
          <Label htmlFor="results">Test Results</Label>
          <Textarea
            id="results"
            value={results}
            readOnly
            rows={15}
            className="font-mono text-sm"
            placeholder="Test results will appear here..."
          />
        </div>

        <div className="text-sm text-muted-foreground">
          <p><strong>Instructions:</strong></p>
          <ul className="list-disc list-inside space-y-1">
            <li>Enter the order ID you want to test (e.g., 2865)</li>
            <li>Optionally enter buyer email to test notifications</li>
            <li>Click "Test Full System" to test backend + frontend</li>
            <li>Click "Test Popup Only" to test just the popup display</li>
            <li>Check the results and browser console for debugging info</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}