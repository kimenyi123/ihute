"use client"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Search, Store, XCircle } from "lucide-react"
import { useTableCommandStore } from "@/lib/table-command-store"
import { Header } from "@/components/header"

export default function JoinTablePage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get("token")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tableInfo, setTableInfo] = useState<{
    tableName: string
    locationId: string
    locationName: string
    sellerInfo?: {
      name: string
      phone?: string
      location?: string
    }
  } | null>(null)
  const { joinTableCommand } = useTableCommandStore()

  useEffect(() => {
    if (!token) {
      setError("Token parameter is required")
      setLoading(false)
      return
    }

    // Decode token to get table info (legacy table command)
    try {
      let decoded: string
      try {
        decoded = atob(token!.replace(/-/g, "+").replace(/_/g, "/"))
      } catch {
        decoded = decodeURIComponent(escape(atob(token!.replace(/-/g, "+").replace(/_/g, "/"))))
      }

      const parts = decoded.split("|")

      if (parts.length < 2) {
        setError("Invalid token format")
        setLoading(false)
        return
      }

      const tableName = parts[0]
      const locationId = parts[1]

      // Verify table exists and is active
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://ihute.rw/Trading"
      const url = new URL(`${API_BASE}/OrdersServlet`)
      url.searchParams.set("action", "checkTableStatus")
      url.searchParams.set("tableName", tableName)
      url.searchParams.set("locationId", locationId)

      fetch(url.toString())
        .then((res) => {
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`)
          }
          return res.json()
        })
        .then(async (data) => {
          console.log("Table status check response:", data)
          if (data.ok && (data.status === "ACTIVE" || data.status === "NOT_FOUND")) {
            // Get seller information
            const sellerInfo = await getSellerInfo(locationId)

            setTableInfo({
              tableName,
              locationId,
              locationName: data.locationName || sellerInfo.name || locationId,
              sellerInfo,
            })
          } else {
            setError(data.message || data.error || "Table not found or no longer active")
          }
        })
        .catch((err) => {
          console.error("Error checking table:", err)
          setError(`Failed to verify table: ${err.message || "Network error"}`)
        })
        .finally(() => setLoading(false))
    } catch (err) {
      console.error("Error decoding token:", err)
      setError("Invalid token encoding")
      setLoading(false)
    }
  }, [token])

  const getSellerInfo = async (sellerAccount: string) => {
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://ihute.rw/Trading"
      const url = new URL(`${API_BASE}/OrdersServlet`)
      url.searchParams.set("action", "getSellerInfo")
      url.searchParams.set("sellerAccount", sellerAccount)

      const res = await fetch(url.toString())
      if (res.ok) {
        const data = await res.json()
        if (data.ok) {
          return {
            name: data.name,
            phone: data.phone,
            location: data.location
          }
        }
      }
    } catch (error) {
      console.error("Error fetching seller info:", error)
    }
    
    return { name: sellerAccount }
  }

  const handleBrowseSellerProducts = () => {
    if (!tableInfo) return

    // Join the table command session (store table context)
    joinTableCommand(
      tableInfo.tableName,
      tableInfo.locationId,
      tableInfo.locationName,
      "Guest User",
      `guest_${Date.now()}@ihute.rw`
    )

    // Redirect to search page for this seller with table context
    const params = new URLSearchParams()
    params.set("supplier", tableInfo.locationId)
    params.set("supplierName", tableInfo.locationName)
    if (token) {
      params.set("tableToken", token)
    }
    
    router.push(`/search?${params.toString()}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-500 to-purple-700">
        <Header />
        <div className="flex items-center justify-center pt-8">
          <Card className="w-full max-w-md mx-4">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-12 w-12 animate-spin text-purple-600 mb-4" />
              <p className="text-muted-foreground">Loading table information...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-500 to-purple-700">
        <Header />
        <div className="flex items-center justify-center pt-8">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <XCircle className="h-5 w-5" />
                Error
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">{error}</p>
              <div className="space-y-2">
                <Button onClick={() => router.push("/")} className="w-full">
                  Go to Home
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => router.push("/search")}
                  className="w-full"
                >
                  Browse All Sellers
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500 to-purple-700">
      <Header />
      <div className="flex items-center justify-center p-4 pt-8">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <Store className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl">Join Table Order</CardTitle>
            <p className="text-muted-foreground mt-2">
              You've been invited to join a table order at{" "}
              <span className="font-semibold">{tableInfo?.locationName}</span>
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {tableInfo && (
              <div className="bg-muted rounded-lg p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Table Name:</span>
                  <span className="font-semibold">{tableInfo.tableName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Seller:</span>
                  <span className="font-semibold">{tableInfo.locationName}</span>
                </div>
                {tableInfo.sellerInfo?.location && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Location:</span>
                    <span className="font-medium">{tableInfo.sellerInfo.location}</span>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-3">
              <p className="text-sm text-muted-foreground text-center">
                Click below to browse {tableInfo?.locationName}'s products and add items to your table order
              </p>
              
              <div className="space-y-2">
                <Button 
                  onClick={handleBrowseSellerProducts} 
                  className="w-full" 
                  size="lg"
                >
                  <Search className="mr-2 h-4 w-4" />
                  Browse Seller's Products
                </Button>
                
                <Button
                  variant="ghost"
                  onClick={() => router.push("/")}
                  className="w-full"
                >
                  Cancel
                </Button>
              </div>
              
              <div className="mt-4 pt-4 border-t text-xs text-muted-foreground">
                <p className="font-medium">How table orders work:</p>
                <ul className="mt-1 space-y-1">
                  <li>• Browse and add items from {tableInfo?.locationName}</li>
                  <li>• Only you can see your own items in the cart</li>
                  <li>• Your order will be grouped with others at the same table</li>
                  <li>• The table creator will send all orders together</li>
                  <li>• You'll pay for your own items individually</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}