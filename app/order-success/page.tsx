// app/orders/page.tsx
"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/lib/auth-store"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Truck, CheckCircle, Clock } from "lucide-react"
import { useOrdersStore, type Order } from "@/lib/orders-store"

type RawTxn = {
  ID_ORDER?: string
  SELLER_NAMES?: string
  SELLER_OWNER?: string
  SELLER_ISHYIGA_ACCOUNT?: string
  AMOUNT?: number
  PAYMENT_NAME?: string
  BUYER_ISHYIGA_ACCOUNT?: string
  BUYER_OWNER?: string
  momo?: string
  CREATED_AT?: string           // backend timestamp (ISO or parseable)
  ITEMS_COUNT?: number          // backend item count (optional)
  items?: Array<unknown>        // optional: if you also return an array of items
}

function mapPaymentToStatus(name?: string): Order["status"] {
  const s = (name || "").toLowerCase()
  if (s.includes("delivered") || s.includes("completed")) return "delivered"
  if (s.includes("transit") || s.includes("shipped") || s.includes("out")) return "in-transit"
  if (s.includes("pending")) return "pending"
  if (s.includes("paid") || s.includes("success") || s.includes("processing")) return "processing"
  return "processing"
}

function statusIcon(status: Order["status"]) {
  switch (status) {
    case "delivered":
      return <CheckCircle className="h-5 w-5 text-green-600" />
    case "in-transit":
      return <Truck className="h-5 w-5 text-blue-600" />
    default:
      return <Clock className="h-5 w-5 text-yellow-600" />
  }
}

function statusBadge(status: Order["status"]) {
  const variant = status === "delivered" ? "default" : status === "in-transit" ? "secondary" : "outline"
  return (
    <Badge variant={variant as any} className="capitalize">
      {status.replace("-", " ")}
    </Badge>
  )
}

function buildTracking(status: Order["status"]) {
  return [
    { label: "Order Placed", completed: true, date: "" },
    { label: "Processing", completed: status !== "pending", date: "" },
    { label: "Out for Delivery", completed: status === "in-transit" || status === "delivered", date: "" },
    { label: "Delivered", completed: status === "delivered", date: "" },
  ]
}

export default function OrdersPage() {
  const router = useRouter()
  const { user, isAuthenticated } = useAuthStore()
  const { orders, setOrders } = useOrdersStore()
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated) router.push("/login")
  }, [isAuthenticated, router])

  useEffect(() => {
    let cancel = false
    async function load() {
      if (!user?.email) return
      setLoading(true)
      setErr(null)
      try {
        const res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: user.email }),
          cache: "no-store",
        })
        const json = await res.json()
        if (!res.ok || json?.ok === false) throw new Error(json?.error || "Failed to load orders")

        const txns: RawTxn[] = Array.isArray(json?.transactions) ? json.transactions : []

        const mapped: Order[] = txns.map((t) => {
          const itemsCount =
            typeof t.ITEMS_COUNT === "number"
              ? t.ITEMS_COUNT
              : Array.isArray(t.items)
              ? t.items.length
              : 0

          return {
            id: String(t.ID_ORDER ?? ""),
            sellerId: String(t.SELLER_ISHYIGA_ACCOUNT ?? ""),
            sellerName: t.SELLER_NAMES || t.SELLER_OWNER || t.SELLER_ISHYIGA_ACCOUNT || "Supplier",
            sellerLocation: undefined,
            momo: t.momo ?? undefined,
            items: [], // you can load detail items in a future call
            itemsCount,                         // 👈 show count from backend
            subtotal: Number(t.AMOUNT ?? 0),
            status: mapPaymentToStatus(t.PAYMENT_NAME),
            paymentStatus: "paid",              // or map a separate field if you return it
            createdAt: t.CREATED_AT || new Date().toISOString(), // 👈 real timestamp
          }
        })

        if (!cancel) setOrders(mapped)
      } catch (e: any) {
        if (!cancel) setErr(e?.message || "Failed to load orders")
      } finally {
        if (!cancel) setLoading(false)
      }
    }
    load()
    return () => {
      cancel = true
    }
  }, [user?.email, setOrders])

  const content = useMemo(() => {
    if (loading) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Loading orders…</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Please wait.</CardContent>
        </Card>
      )
    }
    if (err) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Couldn’t load orders</CardTitle>
            <CardDescription className="text-destructive">{err}</CardDescription>
          </CardHeader>
        </Card>
      )
    }
    if (!orders.length) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">No orders yet</CardTitle>
            <CardDescription>Your placed orders will appear here.</CardDescription>
          </CardHeader>
        </Card>
      )
    }
    return (
      <div className="space-y-6">
        {orders.map((order) => {
          const steps = buildTracking(order.status)
          const created = order.createdAt ? new Date(order.createdAt) : null
          const createdStr = created ? created.toLocaleString() : ""
          const count = order.itemsCount ?? order.items.length
          return (
            <Card key={order.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{order.id}</CardTitle>
                    <CardDescription>
                      {createdStr} {createdStr ? "• " : ""}
                      {count ? `${count} item${count === 1 ? "" : "s"} • ` : ""}
                      {order.sellerName}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {statusIcon(order.status)}
                    {statusBadge(order.status)}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Tracking Steps */}
                  <div className="relative">
                    <div className="space-y-4">
                      {steps.map((step, index) => (
                        <div key={index} className="flex items-start gap-3">
                          <div className="relative">
                            <div
                              className={`h-8 w-8 rounded-full flex items-center justify-center ${
                                step.completed ? "bg-green-600" : "bg-slate-200"
                              }`}
                            >
                              {step.completed ? (
                                <CheckCircle className="h-5 w-5 text-white" />
                              ) : (
                                <Clock className="h-5 w-5 text-slate-400" />
                              )}
                            </div>
                            {index < steps.length - 1 && (
                              <div
                                className={`absolute left-4 top-8 w-0.5 h-8 ${
                                  step.completed ? "bg-green-600" : "bg-slate-200"
                                }`}
                              />
                            )}
                          </div>
                          <div className="flex-1 pt-1">
                            <p className={`font-medium ${step.completed ? "text-slate-900" : "text-slate-500"}`}>
                              {step.label}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t">
                    <div>
                      <p className="text-sm text-slate-600">Total Amount</p>
                      <p className="text-lg font-bold text-slate-900">{order.subtotal.toLocaleString()} RWF</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => { /* router.push(`/orders/${order.id}`) */ }}>
                      View Details
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    )
  }, [orders, loading, err])

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">My Orders</h1>
          <p className="text-slate-600">Track and manage your orders</p>
        </div>
        {content}
      </main>
      <Footer />
    </div>
  )
}
