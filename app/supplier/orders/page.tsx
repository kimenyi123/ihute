// app/supplier/orders/page.tsx
"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/lib/auth-store"
import { useOrdersStore, type Order } from "@/lib/orders-store"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ChevronDown, CheckCircle, Truck, Clock, RotateCw, Check, X } from "lucide-react"

// ===========================================
// Constants
// ===========================================
const SUPPLIER_STATUS = [
  { key: "open", label: "Open" },
  { key: "processing", label: "Processing" },
  { key: "invoice", label: "Invoice" },
  { key: "delivered", label: "Delivered" },
] as const

type SupplierStatusKey = typeof SUPPLIER_STATUS[number]["key"]

const ORDER_STATUS_URL = "/api/orders/update-status"

// ===========================================
// Inline Status Picker Component
// ===========================================
function InlineStatusPicker({ order, orders, setOrders }: { order: Order, orders: Order[], setOrders: (orders: Order[]) => void }) {
  const current = order.supplierStatus as SupplierStatusKey
  const [isUpdating, setIsUpdating] = useState(false)

  async function setStatus(next: SupplierStatusKey) {
    if (next === current) return
    setIsUpdating(true)

    const previousStatus = order.status
    setOrders(orders.map(o => o.id === order.id ? { ...o, status: next, supplierStatus: next } : o))

    try {
      const res = await fetch(ORDER_STATUS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: Number(order.id), status: next })
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || "Update failed")
    } catch (e: any) {
      setOrders(orders.map(o => o.id === order.id ? { ...o, status: previousStatus, supplierStatus: current } : o))
      alert(`Error updating order: ${e.message}`)
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition bg-slate-50 text-slate-700 border-slate-300`}>
          {current}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {SUPPLIER_STATUS.map(opt => (
          <DropdownMenuItem key={opt.key} onClick={() => setStatus(opt.key)}>
            {opt.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ===========================================
// Loan Request Function
// ===========================================
async function requestLoan(order: Order, sellerAccount: string) {
  if (!["open", "processing"].includes(order.supplierStatus || "")) {
    alert(`Financing not allowed for orders with status "${order.supplierStatus}"`)
    return
  }

  if (!confirm("You are about to request a loan from BPR for this order. Continue?")) return

  try {
    const res = await fetch("/api/request-loan-with-details", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: order.id,
        sellerAccount,
        buyerTIN: order.buyerTIN,
        supplierTIN: order.SUPPLIER_TIN,
        invoiceAmount: order.subtotal
      })
    })

    const result = await res.json()
    if (res.ok && result.success) {
      alert(
        `✅ Loan request submitted\n\n` +
        `Order #: ${order.id}\n` +
        `Product: ${result.itemName}\n` +
        `Product Code: ${result.itemCode}\n` +
        `Amount: ${order.subtotal.toLocaleString()} RWF`
      )
    } else {
      alert(`❌ Loan Request Failed\n\n${result.error || "Unknown error"}`)
    }
  } catch (err: any) {
    alert(`❌ Error\n\n${err.message || "Unknown error"}`)
  }
}

// ===========================================
// Supplier Orders Page
// ===========================================
export default function SupplierOrdersPage() {
  const router = useRouter()
  const { user, isAuthenticated } = useAuthStore()
  const { orders, setOrders } = useOrdersStore()

  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
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
        body: JSON.stringify({ action: "listSellerOrders", sellerAccount: user.ishyigaAccount }),
        cache: "no-store"
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || "Failed to load orders")

      const mapped: Order[] = (json.orders || []).map((t: any) => ({
        id: String(t.ID_ORDER ?? ""),
        sellerId: String(t.SELLER_ISHYIGA_ACCOUNT ?? ""),
        sellerName: t.SELLER_NAMES || t.SELLER_OWNER || "Supplier",
        items: [],
        itemsCount: undefined,
        subtotal: Number(t.AMOUNT ?? 0),
        status: t.ORDER_STATUS?.toLowerCase() || "open",
        supplierStatus: t.ORDER_STATUS?.toLowerCase() || "open",
        createdAt: t.CREATED_AT || new Date().toISOString(),
        buyerTIN: t.BUYER_TIN ?? "",
        SUPPLIER_TIN: t.SELLER_TIN ?? "",
        buyerName: t.BUYER_NAME?.trim() || t.BUYER_OWNER_NAME?.trim() || t.BUYER_OWNER?.trim() || t.BUYER_ISHYIGA_ACCOUNT || "Guest Buyer",
        paymentStatus: /(pay[_\s-]*on[_\s-]*delivery|cod)/i.test(t.PAYMENT_NAME || "") ? "unpaid" : "paid"
      }))

      setOrders(mapped)
      setLastRefresh(new Date())
    } catch (e: any) {
      setErr(e.message || "Failed to load orders")
    } finally {
      setLoading(false)
    }
  }, [user?.ishyigaAccount, setOrders])

  useEffect(() => { loadOrders() }, [loadOrders])
  useEffect(() => {
    const timer = setInterval(() => loadOrders(), 30000)
    return () => clearInterval(timer)
  }, [loadOrders])

  const totalPages = useMemo(() => Math.ceil(orders.length / pageSize), [orders.length, pageSize])
  const pagedOrders = useMemo(() => orders.slice((page - 1) * pageSize, page * pageSize), [orders, page, pageSize])
const supplierOrderLink = (orderId: number | string) => `/supplier/orders/${orderId}`
  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      <main className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-4">My Orders</h1>

        {err && <div className="mb-4 p-2 bg-red-50 border border-red-300 rounded text-sm">{err}</div>}
        {loading && <div className="mb-4 p-2 text-sm">Loading...</div>}

        <div className="rounded-lg border bg-white overflow-x-auto">
          <Table className="min-w-[1000px]">
            <TableHeader>
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedOrders.map(order => (
                <TableRow key={order.id}>
                  <TableCell>{order.id}</TableCell>
                  <TableCell>{order.buyerName}</TableCell>
                  <TableCell>{new Date(order.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>{order.subtotal.toLocaleString()} RWF</TableCell>
                  <TableCell>{order.paymentStatus}</TableCell>
                  <TableCell>
                    <InlineStatusPicker order={order} orders={orders} setOrders={setOrders} />
                  </TableCell>
                  <TableCell className="text-center flex gap-2 justify-center">
                    <Button
                      size="sm"
                      className={`bg-blue-600 hover:bg-blue-700 text-white ${!["open", "processing"].includes(order.supplierStatus || "") ? "opacity-50 cursor-not-allowed" : ""}`}
                      onClick={() => requestLoan(order, user?.ishyigaAccount || "")}
                      disabled={!["open", "processing"].includes(order.supplierStatus || "")}
                    >
                      Financing
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => router.push(supplierOrderLink(order.id))}>
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Controls */}
        <div className="flex justify-between mt-4">
          <Button disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
          <span>Page {page} of {totalPages}</span>
          <Button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      </main>

      <Footer />
    </div>
  )
}
