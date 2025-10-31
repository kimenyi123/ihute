// app/supplier/orders/page.tsx
"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/lib/auth-store"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ChevronLeft, ChevronRight, RotateCw, CheckCircle, Truck, Clock, ChevronDown } from "lucide-react"
import { useOrdersStore, type Order } from "@/lib/orders-store"

type RawTxn = {
  ID_ORDER?: string
  SELLER_NAMES?: string
  SELLER_OWNER?: string
  SELLER_ISHYIGA_ACCOUNT?: string
  AMOUNT?: number
  PAYMENT_NAME?: string
  PAYMENT_STATUS?: string
  BUYER_ISHYIGA_ACCOUNT?: string
  BUYER_OWNER?: string
  BUYER_NAME?: string
  BUYER_EMAIL?: string
  momo?: string
  CREATED_AT?: string
}

// Supplier-facing statuses
const SUPPLIER_STATUS = [
  { key: "pending", label: "Pending" },
  { key: "processing", label: "Processing" },
  { key: "invoice", label: "Invoice" },
  { key: "delivered", label: "Delivered" },
] as const
export type SupplierStatusKey = typeof SUPPLIER_STATUS[number]["key"]

function toBadgeStatus(key: SupplierStatusKey): Order["status"] {
  switch (key) {
    case "delivered": return "delivered"
    case "processing": return "processing"
    case "invoice": return "processing"
    case "pending":
    default: return "pending"
  }
}
function statusIcon(status: Order["status"]) {
  switch (status) {
    case "delivered": return <CheckCircle className="h-4 w-4" />
    case "in-transit": return <Truck className="h-4 w-4" />
    default: return <Clock className="h-4 w-4" />
  }
}
function inferSupplierStatus(o: Order): SupplierStatusKey {
  if (o.status === "delivered") return "delivered"
  if (String(o.paymentStatus).toLowerCase() === "paid") return "invoice"
  if (o.status === "processing") return "processing"
  return "pending"
}
const pillClass = (key: SupplierStatusKey) => {
  switch (key) {
    case "delivered": return "bg-green-50 text-green-700 border-green-300 hover:bg-green-100"
    case "processing": return "bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100"
    case "invoice": return "bg-indigo-50 text-indigo-700 border-indigo-300 hover:bg-indigo-100"
    case "pending":
    default: return "bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100"
  }
}
const dotClass = (key: SupplierStatusKey) => {
  switch (key) {
    case "delivered": return "bg-green-600"
    case "processing": return "bg-blue-600"
    case "invoice": return "bg-indigo-600"
    case "pending": default: return "bg-slate-400"
  }
}
const supplierOrderLink = (orderId: string) => `/supplier/orders/${orderId}`

export default function SupplierOrdersPage() {
  const router = useRouter()
  const { user, isAuthenticated } = useAuthStore()
  const { orders, setOrders } = useOrdersStore()

  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState<number | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  useEffect(() => { if (!isAuthenticated) router.push("/login") }, [isAuthenticated, router])

  const loadOrders = useCallback(async () => {
    if (!user?.ishyigaAccount) return
    setLoading(true)
    setErr(null)
    try {
      const res = await fetch("/api/seller-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sellerAccount: user.ishyigaAccount, page, pageSize }),
        cache: "no-store",
      })
      const json = await res.json()
      if (!res.ok || json?.ok === false) throw new Error(json?.error || "Failed to load orders")

      const txns: RawTxn[] = Array.isArray(json?.orders) ? json.orders : []
      const mapped: Order[] = txns.map((t) => {
        const isCOD = /(pay[_\s-]*on[_\s-]*delivery|cod)/i.test(t.PAYMENT_NAME || "")
        const buyerEmail = t.BUYER_EMAIL || ""
        const isGuestBuyer = buyerEmail.startsWith("guest_") || !t.BUYER_ISHYIGA_ACCOUNT

        const o: Order = {
          id: String(t.ID_ORDER ?? ""),
          sellerId: String(t.SELLER_ISHYIGA_ACCOUNT ?? ""),
          sellerName: t.SELLER_NAMES || t.SELLER_OWNER || t.SELLER_ISHYIGA_ACCOUNT || "Supplier",
          sellerLocation: undefined,
          momo: t.momo ?? undefined,
          items: [],
          itemsCount: undefined,
          subtotal: Number(t.AMOUNT ?? 0),
          status: (t.PAYMENT_STATUS === "paid" ? "processing" : "pending") as Order["status"],
          paymentStatus: isCOD ? "unpaid" : "paid",
          createdAt: t.CREATED_AT || new Date().toISOString(),
        }
        // @ts-ignore
        o.buyerId = t.BUYER_ISHYIGA_ACCOUNT ?? undefined
        // @ts-ignore
        o.buyerName = t.BUYER_OWNER ?? t.BUYER_NAME ?? t.BUYER_ISHYIGA_ACCOUNT ?? "Guest Buyer"
        // @ts-ignore
        o.isGuest = isGuestBuyer
        return o
      })

      setOrders(mapped)
      setTotal(Number.isFinite(json?.total) ? Number(json.total) : null)
      setLastRefresh(new Date())
    } catch (e: any) {
      setErr(e?.message || "Failed to load orders")
    } finally {
      setLoading(false)
    }
  }, [user?.ishyigaAccount, page, pageSize, setOrders])

  useEffect(() => { loadOrders() }, [loadOrders])

  useEffect(() => {
    const interval = setInterval(() => { loadOrders() }, 30000)
    return () => clearInterval(interval)
  }, [loadOrders])

  const totalPages = useMemo(() => (total != null ? Math.max(1, Math.ceil(total / pageSize)) : null), [total, pageSize])
  const hasPrev = page > 1
  const hasNext = totalPages != null ? page < totalPages : orders.length === pageSize
  const goPrev = () => hasPrev && setPage((p) => p - 1)
  const goNext = () => hasNext && setPage((p) => p + 1)
  const goto = (p: number) => p >= 1 && (totalPages == null || p <= totalPages) && setPage(p)

  function InlineStatusPicker({ order }: { order: Order }) {
    const current: SupplierStatusKey = inferSupplierStatus(order)

    async function setStatus(next: SupplierStatusKey) {
      if (next === current) return
      // optimistic update
      const prevBadge = order.status
      const nextBadge = toBadgeStatus(next)
      setOrders(orders.map(o => (o.id === order.id ? { ...o, status: nextBadge } : o)))

      try {
        const res = await fetch("/Trading/OrderStatusServlet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: Number(order.id), status: next }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok || json?.ok === false) {
          throw new Error(json?.error || `HTTP ${res.status}`)
        }
      } catch (e) {
        console.error("Failed to update status", e)
        // rollback on error
        setOrders(orders.map(o => (o.id === order.id ? { ...o, status: prevBadge } : o)))
        // Optional: show a toast or banner with the specific error (e.g., 409 invalid transition)
      }
    }

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition ${pillClass(current)}`}
            onClick={(e) => e.stopPropagation()}
          >
            <span className={`h-2.5 w-2.5 rounded-full ${dotClass(current)}`} />
            {SUPPLIER_STATUS.find((s) => s.key === current)?.label}
            <ChevronDown className="h-4 w-4 opacity-70" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {SUPPLIER_STATUS.map((opt) => (
            <DropdownMenuItem key={opt.key} onClick={() => setStatus(opt.key)} className="cursor-pointer">
              <span className={`mr-2 inline-block h-2.5 w-2.5 rounded-full ${dotClass(opt.key)}`} />
              {opt.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="container mx-auto px-4 py-8">
        {/* header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">My Orders</h1>
            <p className="text-slate-600">
              Track and manage orders for your shop
              {lastRefresh && (<span className="ml-2 text-xs text-slate-500">• Last updated: {lastRefresh.toLocaleTimeString()}</span>)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={loadOrders} disabled={loading} className="gap-2">
              <RotateCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">Rows:</span>
              <select className="border rounded-md px-2 py-1 text-sm bg-white" value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}>
                {[10, 20, 50, 100].map((n) => (<option key={n} value={n}>{n}</option>))}
              </select>
            </div>
          </div>
        </div>

        {err && (
          <div className="mb-3 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            Couldn’t load orders: {err}
          </div>
        )}

        {/* table */}
        <div className="rounded-lg border bg-white">
          <div className="overflow-x-auto">
            <Table className="min-w-[1050px]">
              <TableHeader className="bg-slate-50/70">
                <TableRow>
                  <TableHead className="w-[160px]">Order Number</TableHead>
                  <TableHead className="w-[260px]">Customer</TableHead>
                  <TableHead className="w-[180px]">Date</TableHead>
                  <TableHead className="text-right w-[150px]">Total</TableHead>
                  <TableHead className="w-[160px]">Payment Status</TableHead>
                  <TableHead className="w-[210px]">Order Status</TableHead>
                  <TableHead className="text-right w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-sm text-slate-500">Loading orders…</TableCell>
                  </TableRow>
                )}
                {!loading && orders.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-sm text-slate-500">No orders yet. Your orders will appear here.</TableCell>
                  </TableRow>
                )}
                {!loading && orders.map((order) => {
                  const createdStr = order.createdAt ? new Date(order.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : ""
                  // @ts-ignore
                  const buyerName = (order as any).buyerName ?? "—"
                  const buyerEmail = ""
                  const itemsCount = order.itemsCount ?? order.items?.length ?? 0

                  return (
                    <TableRow key={order.id} className="hover:bg-slate-50/60">
                      <TableCell>
                        <button onClick={() => router.push(supplierOrderLink(order.id))} className="font-medium underline-offset-2 hover:underline">
                          {order.id || "—"}
                        </button>
                      </TableCell>
                      <TableCell className="truncate max-w-[260px]" title={buyerName}>
                        <div className="flex flex-col">
                          <span className="font-medium">{buyerName}</span>
                          {buyerEmail && <span className="text-xs text-slate-500">{buyerEmail}</span>}
                        </div>
                      </TableCell>
                      <TableCell>{createdStr}</TableCell>
                      <TableCell className="text-right font-semibold">{order.subtotal.toLocaleString()} RWF</TableCell>
                      <TableCell className="capitalize">{order.paymentStatus}</TableCell>
                      <TableCell><InlineStatusPicker order={order} /></TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => router.push(supplierOrderLink(order.id))}>View</Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between border-t px-3 py-3">
            <div className="text-sm text-slate-600">
              {total != null ? (<>Page <span className="font-medium">{page}</span> of <span className="font-medium">{totalPages}</span> • {total} total</>)
                : (<>Page <span className="font-medium">{page}</span></>)}
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={goPrev} disabled={!hasPrev} className="gap-1">
                <ChevronLeft className="h-4 w-4" /> Prev
              </Button>
              {/* simple pager numbers */}
              {(() => {
                if (totalPages == null) return null
                const maxToShow = 5
                const start = Math.max(1, page - Math.floor(maxToShow / 2))
                const end = Math.min(totalPages, start + maxToShow - 1)
                const first = Math.max(1, end - maxToShow + 1)
                return Array.from({ length: end - first + 1 }, (_, i) => first + i).map((p) => (
                  <Button key={p} variant={p === page ? "default" : "outline"} size="sm" onClick={() => (p >= 1 && setPage(p))}>
                    {p}
                  </Button>
                ))
              })()}
              <Button variant="outline" size="sm" onClick={goNext} disabled={!hasNext} className="gap-1">
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
