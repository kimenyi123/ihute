"use client"

import { useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/lib/auth-store"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { LayoutDashboard, ShoppingBag } from "lucide-react"

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
export default function SellerDashboardPage() {
  const router = useRouter()
  const { user, isAuthenticated } = useAuthStore()

  const totalSales = orders.reduce((sum, order) => sum + Number(order.AMOUNT || 0), 0)
  const deliveredOrders = orders.filter((order) =>
    String(order.STATUS || order.ORDER_STATUS || "").toLowerCase().includes("delivered")
  ).length

  useEffect(() => {
    if (!isAuthenticated) router.push("/login")
  }, [isAuthenticated, router])

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <LayoutDashboard className="h-7 w-7" />
          Seller dashboard
        </h1>
        <p className="text-muted-foreground mt-2">
          Welcome
          {user?.ishyigaAccount ? (
            <>
              , <span className="text-foreground font-medium">{user.name || user.ishyigaAccount}</span>
            </>
          ) : null}
          . Use the links below to manage your shop.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-1">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ShoppingBag className="h-5 w-5" />
              Orders
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              See orders placed with your seller account. The list may be empty until customers order from your shop.
            </p>
            <Button asChild>
              <Link href="/seller/orders">View orders</Link>
            </Button>
          </CardContent>
        </Card>
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
