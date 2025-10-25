"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/lib/auth-store"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, PackageSearch, AlertCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"

type SellerOrder = {
  ID_ORDER: number
  BUYER_OWNER: string
  BUYER_PHONE: string
  DELIVERY_LOCATION: string
  AMOUNT: number
  STATUS: string
  CURRENCY: string
}

export default function SellerOrdersPage() {
  const router = useRouter()
  const { user, isAuthenticated } = useAuthStore()
  const [orders, setOrders] = useState<SellerOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated) router.push("/login")
  }, [isAuthenticated, router])

  useEffect(() => {
    async function loadOrders() {
      if (!user?.ishyigaAccount) return
      try {
        setLoading(true)
        const res = await fetch("/api/seller-orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sellerAccount: user.ishyigaAccount }),
        })
        const data = await res.json()
        if (!res.ok || data.ok === false) throw new Error(data.error || "Failed to fetch orders")
        setOrders(data.orders || [])
      } catch (error: any) {
        setErr(error.message)
      } finally {
        setLoading(false)
      }
    }
    loadOrders()
  }, [user?.ishyigaAccount])

  if (loading)
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <Loader2 className="h-5 w-5 mr-2 animate-spin" /> Loading orders...
      </div>
    )

  if (err)
    return (
      <div className="flex flex-col items-center justify-center h-64 text-red-600">
        <AlertCircle className="h-6 w-6 mb-2" /> {err}
      </div>
    )

  if (!orders.length)
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <PackageSearch className="h-6 w-6 mb-2" /> No orders found for your account.
      </div>
    )

  return (
    <div className="max-w-5xl mx-auto p-4">
      <h1 className="text-2xl font-semibold mb-6">My Orders</h1>
      <div className="grid gap-4">
        {orders.map((o) => (
          <Card key={o.ID_ORDER} className="shadow-sm border border-slate-200">
            <CardHeader className="flex justify-between items-center">
              <CardTitle className="text-lg font-semibold">Order #{o.ID_ORDER}</CardTitle>
              <Badge
                variant={
                  o.STATUS?.toLowerCase() === "delivered"
                    ? "default"
                    : o.STATUS?.toLowerCase().includes("pending")
                    ? "outline"
                    : "secondary"
                }
              >
                {o.STATUS || "PENDING"}
              </Badge>
            </CardHeader>

            <CardContent className="space-y-2 text-sm text-slate-700">
              <p><strong>Buyer:</strong> {o.BUYER_OWNER || "Guest"}</p>
              <p><strong>Phone:</strong> {o.BUYER_PHONE || "N/A"}</p>
              <p><strong>Location:</strong> {o.DELIVERY_LOCATION || "N/A"}</p>
              <p>
                <strong>Total:</strong> {Number(o.AMOUNT || 0).toLocaleString()}{" "}
                {o.CURRENCY || "RWF"}
              </p>

              <Button
                size="sm"
                className="mt-3"
                onClick={() => router.push(`/seller/orders/${o.ID_ORDER}`)}
              >
                View Details
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
