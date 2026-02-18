"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function TestRatingPage() {
  const [orderId, setOrderId] = useState("2865")
  const [buyerEmail, setBuyerEmail] = useState("")
  const [results, setResults] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const testOrder = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/debug-rating?action=testOrder&orderId=${orderId}`)
      const data = await response.json()
      setResults(data)
    } catch (error) {
      setResults({ error: error.message })
    } finally {
      setLoading(false)
    }
  }

  const checkNotifications = async () => {
    if (!buyerEmail) {
      alert("Please enter buyer email")
      return
    }
    
    setLoading(true)
    try {
      const response = await fetch(`/api/debug-rating?action=checkNotifications&buyerEmail=${encodeURIComponent(buyerEmail)}`)
      const data = await response.json()
      setResults(data)
    } catch (error) {
      setResults({ error: error.message })
    } finally {
      setLoading(false)
    }
  }

  const checkColumns = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/debug-rating?action=checkColumns`)
      const data = await response.json()
      setResults(data)
    } catch (error) {
      setResults({ error: error.message })
    } finally {
      setLoading(false)
    }
  }

  const triggerTestRating = () => {
    // Manually trigger rating popup for testing
    const testData = {
      orderId: orderId,
      sellerAccount: "TEST_SELLER",
      sellerName: "Test Seller Store",
      items: [
        { code: "ITEM001", name: "Test Product 1" },
        { code: "ITEM002", name: "Test Product 2" }
      ]
    }

    // Trigger through the global rating manager
    window.dispatchEvent(new CustomEvent('test-rating-trigger', { detail: testData }))
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Rating System Debug Tool</h1>
      
      <div className="grid gap-6">
        {/* Test Order */}
        <Card>
          <CardHeader>
            <CardTitle>Test Order Rating Trigger</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-2">Order ID</label>
                <Input
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  placeholder="Enter order ID (e.g., 2865)"
                />
              </div>
              <Button onClick={testOrder} disabled={loading}>
                {loading ? "Testing..." : "Test Order"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Check Notifications */}
        <Card>
          <CardHeader>
            <CardTitle>Check Buyer Notifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-2">Buyer Email</label>
                <Input
                  value={buyerEmail}
                  onChange={(e) => setBuyerEmail(e.target.value)}
                  placeholder="Enter buyer email"
                />
              </div>
              <Button onClick={checkNotifications} disabled={loading}>
                {loading ? "Checking..." : "Check Notifications"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Other Tests */}
        <Card>
          <CardHeader>
            <CardTitle>System Tests</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Button onClick={checkColumns} disabled={loading} variant="outline">
                Check Database Columns
              </Button>
              <Button onClick={triggerTestRating} variant="outline">
                Trigger Test Rating Popup
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {results && (
          <Card>
            <CardHeader>
              <CardTitle>Results</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-slate-100 p-4 rounded-lg overflow-auto text-sm">
                {JSON.stringify(results, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}