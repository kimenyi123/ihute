"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
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
      if (!user?.ishyigaAccount) {
        setLoading(false)
        return
      }
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
      <div className="max-w-5xl mx-auto space-y-6">
        <h1 className="text-2xl font-semibold">Orders</h1>
        <div className="flex items-center justify-center h-48 text-muted-foreground rounded-lg border border-dashed">
          <Loader2 className="h-5 w-5 mr-2 animate-spin" /> Loading orders...
        </div>
      </div>
    )

  if (isAuthenticated && !user?.ishyigaAccount)
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <h1 className="text-2xl font-semibold">Orders</h1>
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground">
            <p className="text-foreground font-medium">No seller account on this session</p>
            <p className="mt-2 text-sm max-w-md mx-auto">
              Log in with a supplier/seller Ishyiga account to load orders. If you just registered, try logging out and
              back in.
            </p>
          </CardContent>
        </Card>
      </div>
    )

  if (err)
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <h1 className="text-2xl font-semibold">Orders</h1>
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="flex flex-col items-center justify-center py-12 text-red-700">
            <AlertCircle className="h-8 w-8 mb-2" />
            <p className="text-center">{err}</p>
          </CardContent>
        </Card>
      </div>
    )

  if (!orders.length)
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Orders</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Incoming orders for your seller account appear here.
          </p>
        </div>
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
            <PackageSearch className="h-10 w-10 mb-4 opacity-60" />
            <p className="text-lg font-medium text-foreground">No orders yet</p>
            <p className="mt-2 max-w-md text-sm">
              When customers place orders with your shop, they will show up in this list. You can also use the full
              supplier workspace for filters and status updates.
            </p>
            <Button variant="outline" className="mt-6" asChild>
              <Link href="/supplier/orders">Open supplier orders (full view)</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Orders</h1>
        <p className="text-muted-foreground mt-1 text-sm">{orders.length} order{orders.length === 1 ? "" : "s"}</p>
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
              <p>
                <strong>Buyer:</strong> {o.BUYER_OWNER || "Guest"}
              </p>
              <p>
                <strong>Phone:</strong> {o.BUYER_PHONE || "N/A"}
              </p>
              <p>
                <strong>Location:</strong> {o.DELIVERY_LOCATION || "N/A"}
              </p>
              <p>
                <strong>Total:</strong> {Number(o.AMOUNT || 0).toLocaleString()} {o.CURRENCY || "RWF"}
              </p>

              <Button size="sm" className="mt-3" onClick={() => router.push(`/seller/orders/${o.ID_ORDER}`)}>
                View details
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
