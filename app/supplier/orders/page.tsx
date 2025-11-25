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

  function InlineStatusPicker({ order }: { order: Order }) {
    const current: SupplierStatusKey = inferSupplierStatus(order)

    async function setStatus(next: SupplierStatusKey) {
      if (next === current) return
      const prevBadge = order.status
      const nextBadge = toBadgeStatus(next)
      setOrders(orders.map(o => (o.id === order.id ? { ...o, status: nextBadge } : o)))

      try {
        const res = await fetch("/Trading/Kaos/OrderStatusServlet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: Number(order.id), status: next }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok || json?.ok === false) throw new Error(json?.error || `HTTP ${res.status}`)
      } catch (e) {
        console.error("Failed to update status", e)
        setOrders(orders.map(o => (o.id === order.id ? { ...o, status: prevBadge } : o)))
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
        {/* Header bar */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">My Orders</h1>
            <p className="text-sm sm:text-base text-slate-600">
              Track and manage orders for your shop
              {lastRefresh && (
                <span className="ml-2 text-xs text-slate-500 block sm:inline mt-1 sm:mt-0">
                  • Last updated: {lastRefresh.toLocaleTimeString()}
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadOrders}
              disabled={loading}
              className="gap-2 w-full sm:w-auto"
            >
              <RotateCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">Rows:</span>
              <select
                className="border rounded-md px-2 py-1 text-sm flex-1 sm:flex-none"
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}
              >
                {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="py-8 text-center text-sm text-slate-500">Loading orders…</div>
        ) : err ? (
          <div className="mb-3 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            Couldn’t load orders: {err}
          </div>
        ) : !orders.length ? (
          <div className="py-8 text-center text-sm text-slate-500">No orders yet. Your orders will appear here.</div>
        ) : (
          <div className="space-y-6">
            {orders.map((order) => (
              <div key={order.id} className="border rounded p-4 bg-white">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">{order.id}</span>
                  <InlineStatusPicker order={order} />
                </div>
                <div className="text-sm text-slate-600">{order.buyerName}</div>
                <div className="text-sm font-semibold">{order.subtotal.toLocaleString()} RWF</div>
              </div>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}
