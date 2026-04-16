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
  // All possible status fields from database
  STATUS: string
  ORDER_STATUS: string
  INVOICE: string
  FACTURE: string
  INVOICE_LOADED: string
  CURRENCY: string
}

export default function SellerOrdersPage() {
  const router = useRouter()
  const { user, isAuthenticated } = useAuthStore()
  const [orders, setOrders] = useState<SellerOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const totalSales = orders.reduce((sum, order) => sum + Number(order.AMOUNT || 0), 0)
  const deliveredOrders = orders.filter((order) =>
    String(order.STATUS || order.ORDER_STATUS || "").toLowerCase().includes("delivered")
  ).length

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
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Total Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSales.toLocaleString()} RWF</div>
            <p className="text-xs text-slate-500 mt-1">From loaded seller orders</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{orders.length}</div>
            <p className="text-xs text-slate-500 mt-1">Visible in this seller view</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Delivered</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{deliveredOrders}</div>
            <p className="text-xs text-slate-500 mt-1">Completed orders</p>
          </CardContent>
        </Card>
      </div>
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
              
              {/* Display all status fields */}
              <div className="space-y-1">
                <p><strong>Status:</strong> {o.STATUS || "PENDING"}</p>
                {o.ORDER_STATUS && <p><strong>Order Status:</strong> <span className="font-mono">{o.ORDER_STATUS}</span></p>}
                {o.INVOICE && <p><strong>Invoice:</strong> <span className="font-mono">{o.INVOICE}</span></p>}
                {o.FACTURE && <p><strong>Facture:</strong> <span className="font-mono">{o.FACTURE}</span></p>}
                {o.INVOICE_LOADED && <p><strong>Invoice Loaded:</strong> <span className="font-mono">{o.INVOICE_LOADED}</span></p>}
              </div>

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
