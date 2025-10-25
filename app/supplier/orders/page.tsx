"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/lib/auth-store"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Truck, CheckCircle, Clock, ChevronLeft, ChevronRight } from "lucide-react"
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
  CREATED_AT?: string
}

// Map payment string to order status
function mapPaymentToStatus(name?: string): Order["status"] {
  const s = (name || "").toLowerCase().replace(/[\s_]+/g, " ")
  if (/(pay on delivery|pay-on-delivery|pay_on_delivery|cod)/.test(s)) return "pending"
  if (s.includes("delivered") || s.includes("completed")) return "delivered"
  if (s.includes("transit") || s.includes("shipped") || s.includes("out")) return "in-transit"
  if (s.includes("pending")) return "pending"
  if (s.includes("paid") || s.includes("success") || s.includes("processing") || s.includes("mtn momo")) return "processing"
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
    { label: "Order Placed", completed: true },
    { label: "Processing", completed: status !== "pending" },
    { label: "Out for Delivery", completed: status === "in-transit" || status === "delivered" },
    { label: "Delivered", completed: status === "delivered" },
  ]
}

export default function SupplierOrdersPage() {
  const router = useRouter()
  const { user, isAuthenticated } = useAuthStore()
  const { orders, setOrders } = useOrdersStore()
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState<number | null>(null)

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthenticated) router.push("/login")
  }, [isAuthenticated, router])

 const loadOrders = useCallback(async () => {
  if (!user?.ishyigaAccount) return
  setLoading(true)
  setErr(null)

  try {
    // ✅ Changed from /api/orders to /api/seller-orders
    // Use sellerAccount (not supplierId)
    const res = await fetch("/api/seller-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        sellerAccount: user.ishyigaAccount,  // ✅ Changed from supplierId
        page, 
        pageSize 
      }),
      cache: "no-store",
    })
    const json = await res.json()

    if (!res.ok || json?.ok === false) throw new Error(json?.error || "Failed to load orders")

    // ✅ Backend returns 'orders' directly (not 'transactions')
    const txns: RawTxn[] = Array.isArray(json?.orders)
      ? json.orders
      : []

    const mapped: Order[] = txns.map((t) => {
      const paymentName = t.PAYMENT_NAME || ""
      const isCOD = /(pay[_\s-]*on[_\s-]*delivery|cod)/i.test(paymentName)
      return {
        id: String(t.ID_ORDER ?? ""),
        sellerId: String(t.SELLER_ISHYIGA_ACCOUNT ?? ""),
        sellerName: t.SELLER_NAMES || t.SELLER_OWNER || t.SELLER_ISHYIGA_ACCOUNT || "Supplier",
        sellerLocation: undefined,
        momo: t.momo ?? undefined,
        items: [],
        subtotal: Number(t.AMOUNT ?? 0),
        status: mapPaymentToStatus(paymentName),
        paymentStatus: isCOD ? "unpaid" : "paid",
        createdAt: t.CREATED_AT || new Date().toISOString(),
        buyerId: t.BUYER_ISHYIGA_ACCOUNT ?? undefined,
        buyerName: t.BUYER_OWNER ?? t.BUYER_ISHYIGA_ACCOUNT ?? "Customer",
      }
    })

    setOrders(mapped)
    setTotal(Number.isFinite(json?.total) ? Number(json.total) : null)
  } catch (e: any) {
    setErr(e?.message || "Failed to load orders")
  } finally {
    setLoading(false)
  }
}, [user?.ishyigaAccount, page, pageSize, setOrders])

  useEffect(() => { loadOrders() }, [loadOrders])

  // Pagination helpers
  const totalPages = useMemo(() => (total != null ? Math.max(1, Math.ceil(total / pageSize)) : null), [total, pageSize])
  const hasPrev = page > 1
  const hasNext = totalPages != null ? page < totalPages : orders.length === pageSize
  const goPrev = () => hasPrev && setPage((p) => p - 1)
  const goNext = () => hasNext && setPage((p) => p + 1)
  const goto = (p: number) => p >= 1 && (totalPages == null || p <= totalPages) && setPage(p)

  const pageButtons = useMemo(() => {
    if (totalPages == null) return null
    const maxToShow = 5
    const start = Math.max(1, page - Math.floor(maxToShow / 2))
    const end = Math.min(totalPages, start + maxToShow - 1)
    const first = Math.max(1, end - maxToShow + 1)
    return Array.from({ length: end - first + 1 }, (_, i) => first + i)
  }, [page, totalPages])

  const supplierOrderLink = (orderId: string) => `/supplier/orders/${orderId}`

  // Render logic remains unchanged
  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="container mx-auto px-4 py-8">
        {/* Header bar */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">My Orders</h1>
            <p className="text-slate-600">Track and manage orders for your shop</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">Rows:</span>
            <select
              className="border rounded-md px-2 py-1 text-sm"
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}
            >
              {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <Card>
            <CardHeader><CardTitle>Loading orders…</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">Please wait.</CardContent>
          </Card>
        ) : err ? (
          <Card>
            <CardHeader>
              <CardTitle>Couldn’t load orders</CardTitle>
              <CardDescription className="text-destructive">{err}</CardDescription>
            </CardHeader>
          </Card>
        ) : !orders.length ? (
          <Card>
            <CardHeader>
              <CardTitle>No orders yet</CardTitle>
              <CardDescription>Your orders will appear here.</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <>
            <div className="space-y-6">
              {orders.map((order) => {
                const steps = buildTracking(order.status)
                const createdStr = order.createdAt ? new Date(order.createdAt).toLocaleString() : ""
                return (
                  <Card key={order.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">
                            <button onClick={() => router.push(supplierOrderLink(order.id))} className="text-left hover:underline">
                              {order.id}
                            </button>
                          </CardTitle>
                          <CardDescription>
                            {createdStr} {createdStr ? "• " : ""}{order.buyerName}
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
                        <div className="relative">
                          <div className="space-y-4">
                            {steps.map((step, idx) => (
                              <div key={idx} className="flex items-start gap-3">
                                <div className="relative">
                                  <div className={`h-8 w-8 rounded-full flex items-center justify-center ${step.completed ? "bg-green-600" : "bg-slate-200"}`}>
                                    {step.completed ? <CheckCircle className="h-5 w-5 text-white" /> : <Clock className="h-5 w-5 text-slate-400" />}
                                  </div>
                                  {idx < steps.length - 1 && (
                                    <div className={`absolute left-4 top-8 w-0.5 h-8 ${step.completed ? "bg-green-600" : "bg-slate-200"}`} />
                                  )}
                                </div>
                                <div className="flex-1 pt-1">
                                  <p className={`font-medium ${step.completed ? "text-slate-900" : "text-slate-500"}`}>{step.label}</p>
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
                          <Button variant="outline" size="sm" onClick={() => router.push(supplierOrderLink(order.id))}>View Details</Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
            {/* Pagination */}
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-slate-600">
                {total != null ? <>Page <span className="font-medium">{page}</span> of <span className="font-medium">{totalPages}</span> • {total} total</> : <>Page <span className="font-medium">{page}</span></>}
              </div>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" onClick={goPrev} disabled={!hasPrev} className="gap-1"><ChevronLeft className="h-4 w-4" /> Prev</Button>
                {pageButtons?.map((p) => (
                  <Button key={p} variant={p === page ? "default" : "outline"} size="sm" onClick={() => goto(p)}>{p}</Button>
                ))}
                <Button variant="outline" size="sm" onClick={goNext} disabled={!hasNext} className="gap-1">Next <ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  )
}
