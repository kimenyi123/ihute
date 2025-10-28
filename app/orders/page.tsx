// app/orders/page.tsx
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
  CREATED_AT?: number | string   // ← heure aliased as CREATED_AT (epoch ms or ISO)
  ITEM_COUNT?: number            // some endpoints
  ITEMS_COUNT?: number           // others
  items?: Array<unknown>
}

function mapPaymentToStatus(name?: string): Order["status"] {
  const s = (name || "").toLowerCase().replace(/[\s_]+/g, " ")
  if (/(pay on delivery|pay-on-delivery|pay on delivery|cod)/.test(s)) return "pending"
  if (s.includes("delivered") || s.includes("completed")) return "delivered"
  if (s.includes("transit") || s.includes("shipped") || s.includes("out")) return "in-transit"
  if (s.includes("pending")) return "pending"
  if (s.includes("paid") || s.includes("success") || s.includes("processing") || s.includes("mtn momo")) return "processing"
  return "processing"
}

function statusIcon(status: Order["status"]) {
  switch (status) {
    case "delivered":  return <CheckCircle className="h-5 w-5 text-green-600" />
    case "in-transit": return <Truck className="h-5 w-5 text-blue-600" />
    default:           return <Clock className="h-5 w-5 text-yellow-600" />
  }
}

function statusBadge(status: Order["status"]) {
  const variant = status === "delivered" ? "default" : status === "in-transit" ? "secondary" : "outline"
  return <Badge variant={variant as any} className="capitalize">{status.replace("-", " ")}</Badge>
}

function buildTracking(status: Order["status"]) {
  return [
    { label: "Order Placed", completed: true },
    { label: "Processing", completed: status !== "pending" },
    { label: "Out for Delivery", completed: status === "in-transit" || status === "delivered" },
    { label: "Delivered", completed: status === "delivered" },
  ]
}

// Robustly convert CREATED_AT (epoch ms number OR ISO/epoch string) → ISO
function toIso(v?: number | string): string {
  if (v == null) return new Date().toISOString()
  if (typeof v === "number") return new Date(v).toISOString()
  const maybeNum = Number(v)
  if (Number.isFinite(maybeNum) && v.trim() !== "") return new Date(maybeNum).toISOString() // epoch ms in string
  const d = new Date(v)
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
}

export default function OrdersPage() {
  const router = useRouter()
  const { user, isAuthenticated } = useAuthStore()
  const { orders, setOrders } = useOrdersStore()
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // pagination UI state
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState<number | null>(null)

  useEffect(() => {
    if (!isAuthenticated) router.push("/login")
  }, [isAuthenticated, router])

  const load = useCallback(async () => {
    if (!user?.email) return
    setLoading(true)
    setErr(null)
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email, page, pageSize }),
        cache: "no-store",
      })
      const json = await res.json()
      if (!res.ok || json?.ok === false) throw new Error(json?.error || "Failed to load orders")

      const txns: RawTxn[] = Array.isArray(json?.transactions)
        ? json.transactions
        : (Array.isArray(json?.orders) ? json.orders : [])

      const mapped: Order[] = txns.map((t) => {
        const itemsCount =
          typeof t.ITEMS_COUNT === "number" ? t.ITEMS_COUNT :
          typeof t.ITEM_COUNT === "number" ? t.ITEM_COUNT :
          Array.isArray(t.items) ? t.items.length : 0

        return {
          id: String(t.ID_ORDER ?? ""),
          sellerId: String(t.SELLER_ISHYIGA_ACCOUNT ?? ""),
          sellerName: t.SELLER_NAMES || t.SELLER_OWNER || t.SELLER_ISHYIGA_ACCOUNT || "Supplier",
          sellerLocation: undefined,
          momo: t.momo ?? undefined,
          items: [],
          itemsCount,
          subtotal: Number(t.AMOUNT ?? 0),
          status: mapPaymentToStatus(t.PAYMENT_NAME),
          paymentStatus: String(t.PAYMENT_NAME || "").toLowerCase().includes("pay on delivery") ? "unpaid" : "paid",
          createdAt: toIso(t.CREATED_AT), // ← use heure from backend
        }
      })

      setOrders(mapped)
      setTotal(Number.isFinite(json?.total) ? Number(json.total) : null)
    } catch (e: any) {
      setErr(e?.message || "Failed to load orders")
    } finally {
      setLoading(false)
    }
  }, [user?.email, page, pageSize, setOrders])

  useEffect(() => { load() }, [load])

  const totalPages = useMemo(() => (total == null ? null : Math.max(1, Math.ceil(total / pageSize))), [total, pageSize])
  const hasPrev = page > 1
  const hasNext = totalPages != null ? page < totalPages : orders.length === pageSize
  const goPrev = () => { if (hasPrev) setPage((p) => p - 1) }
  const goNext = () => { if (hasNext) setPage((p) => p + 1) }
  const goto = (p: number) => { if (p >= 1 && (totalPages == null || p <= totalPages)) setPage(p) }

  const pageButtons = useMemo(() => {
    if (totalPages == null) return null
    const maxToShow = 5
    const start = Math.max(1, page - Math.floor(maxToShow / 2))
    const end = Math.min(totalPages, start + maxToShow - 1)
    const first = Math.max(1, end - maxToShow + 1)
    const arr: number[] = []
    for (let i = first; i <= end; i++) arr.push(i)
    return arr
  }, [page, totalPages])

  const headerBar = (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Orders</h1>
        <p className="text-slate-600">Track and manage your orders</p>
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
  )

  const paginationBar = (
    <div className="flex items-center justify-between mt-6">
      <div className="text-sm text-slate-600">
        {total != null
          ? <>Page <span className="font-medium">{page}</span> of <span className="font-medium">{totalPages}</span> • {total} total</>
          : <>Page <span className="font-medium">{page}</span></>}
      </div>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" onClick={goPrev} disabled={!hasPrev} className="gap-1">
          <ChevronLeft className="h-4 w-4" /> Prev
        </Button>
        {pageButtons && pageButtons.map((p) => (
          <Button key={p} variant={p === page ? "default" : "outline"} size="sm" onClick={() => goto(p)}>
            {p}
          </Button>
        ))}
        <Button variant="outline" size="sm" onClick={goNext} disabled={!hasNext} className="gap-1">
          Next <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )

  const content = useMemo(() => {
    if (loading) {
      return (
        <Card>
          <CardHeader><CardTitle className="text-lg">Loading orders…</CardTitle></CardHeader>
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
      <>
        <div className="space-y-6">
          {orders.map((order) => {
            const steps = buildTracking(order.status)
            const createdStr = order.createdAt ? new Date(order.createdAt).toLocaleString() : ""
            const count = order.itemsCount ?? order.items.length
            return (
              <Card key={order.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        <button onClick={() => router.push(`/orders/${order.id}`)} className="text-left hover:underline">
                          {order.id}
                        </button>
                      </CardTitle>
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
                    <div className="relative">
                      <div className="space-y-4">
                        {steps.map((step, index) => (
                          <div key={index} className="flex items-start gap-3">
                            <div className="relative">
                              <div className={`h-8 w-8 rounded-full flex items-center justify-center ${step.completed ? "bg-green-600" : "bg-slate-200"}`}>
                                {step.completed ? <CheckCircle className="h-5 w-5 text-white" /> : <Clock className="h-5 w-5 text-slate-400" />}
                              </div>
                              {index < steps.length - 1 && (
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
                      <Button variant="outline" size="sm" onClick={() => router.push(`/orders/${order.id}`)}>
                        View Details
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
        {paginationBar}
      </>
    )
  }, [orders, loading, err, page, pageSize, total, totalPages])

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="container mx-auto px-4 py-8">
        {headerBar}
        {content}
      </main>
      <Footer />
    </div>
  )
}
