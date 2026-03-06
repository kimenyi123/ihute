// app/supplier/orders/page.tsx
"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
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
// Supplier Orders Page
// ===========================================
export default function SupplierOrdersPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const accountFromUrl = searchParams?.get("account")?.trim() ?? ""
  const { user, isAuthenticated } = useAuthStore()
  const { orders, setOrders } = useOrdersStore()

  const [hydrated, setHydrated] = useState(false)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  // Wait for persisted auth (localStorage) so link-with-account can "auto" show orders when already logged in on this device
  useEffect(() => {
    const setNow = () => setHydrated(true)
    setHydrated(!!(useAuthStore as any).persist?.hasHydrated?.())
    const unsub = (useAuthStore as any).persist?.onFinishHydration?.(setNow)
    return () => { unsub?.() }
  }, [])

  // Link is for one seller (e.g. from QR). If logged-in user doesn't match, show message.
  const isWrongSeller = accountFromUrl.length > 0 && isAuthenticated && user?.ishyigaAccount && accountFromUrl !== user.ishyigaAccount

  // When URL has ?account= and we're not logged in: treat account as identity and create a session so they see orders (no login page).
  useEffect(() => {
    if (!hydrated || isAuthenticated || !accountFromUrl) return
    const login = useAuthStore.getState().login
    const minimalUser = {
      id: accountFromUrl,
      email: `${accountFromUrl}@supplier`,
      name: accountFromUrl,
      role: "supplier" as const,
      phone: "",
      location: "",
      ishyigaAccount: accountFromUrl,
    }
    login(minimalUser)
  }, [hydrated, isAuthenticated, accountFromUrl])

  // After hydration: if still not logged in (and no account in URL), send to login with return URL
  useEffect(() => {
    if (!hydrated) return
    if (isAuthenticated) return
    if (accountFromUrl) return // session-from-account effect above will run; don't redirect
    const returnTo = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : "")
    const safe = returnTo.startsWith("/") && !returnTo.startsWith("//")
    router.push(safe ? `/login?redirect=${encodeURIComponent(returnTo)}` : "/login")
  }, [hydrated, isAuthenticated, accountFromUrl, router, pathname, searchParams])

  const loadOrders = useCallback(async () => {
    const sellerAccount = user?.ishyigaAccount?.trim()
    if (!sellerAccount) {
      setErr("No supplier account found. Please log out and log in again so your supplier account (ishyigaAccount) is loaded.")
      setLoading(false)
      return
    }
    setLoading(true)
    setErr(null)

    const payload = { action: "listSellerOrders", sellerAccount }
    console.log("[Supplier Orders] 📤 Fetching orders — sellerAccount:", sellerAccount)
    try {
      const res = await fetch("/api/seller-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        cache: "no-store"
      })
      const json = await res.json()
      console.log("[Supplier Orders] 📥 Response — ok:", res.ok, "status:", res.status, "orders count:", (json.orders ?? json.data ?? []).length, "error:", json?.error ?? null)
      if (!res.ok) throw new Error(json?.error || "Failed to load orders")

      const rawOrders = json.orders ?? json.data ?? []
      const mapped: Order[] = (Array.isArray(rawOrders) ? rawOrders : []).map((t: any) => ({
        id: String(t.ID_ORDER ?? t.id_order ?? t.id ?? ""),
        sellerId: String(t.SELLER_ISHYIGA_ACCOUNT ?? t.seller_ishyiga_account ?? ""),
        sellerName: t.SELLER_NAMES ?? t.SELLER_OWNER ?? t.seller_names ?? "Supplier",
        items: [],
        itemsCount: undefined,
        subtotal: Number(t.AMOUNT ?? t.amount ?? 0),
        status: (t.ORDER_STATUS ?? t.order_status ?? "open")?.toLowerCase() || "open",
        supplierStatus: (t.ORDER_STATUS ?? t.order_status ?? "open")?.toLowerCase() || "open",
        createdAt: t.CREATED_AT ?? t.created_at ?? t.heure ?? new Date().toISOString(),
        buyerTIN: t.BUYER_TIN ?? t.buyer_tin ?? "",
        SUPPLIER_TIN: t.SELLER_TIN ?? t.seller_tin ?? "",
        buyerName: (t.BUYER_NAME ?? t.BUYER_OWNER_NAME ?? t.BUYER_OWNER ?? t.BUYER_ISHYIGA_ACCOUNT ?? t.buyer_name ?? "").toString().trim() || "Guest Buyer",
        paymentStatus: /(pay[_\s-]*on[_\s-]*delivery|cod)/i.test(String(t.PAYMENT_NAME ?? t.payment_name ?? "")) ? "unpaid" : "paid"
      }))

      setOrders(mapped)
      setLastRefresh(new Date())
    } catch (e: any) {
      setErr(e.message || "Failed to load orders")
    } finally {
      setLoading(false)
    }
  }, [user?.ishyigaAccount, setOrders])

  useEffect(() => {
    if (!isAuthenticated || !user) return
    // When link is for another seller (?account=X), don't load; show banner and "View my orders"
    if (isWrongSeller) {
      setOrders([])
      return
    }
    if (user.ishyigaAccount) {
      setErr(null)
      loadOrders()
    } else {
      setErr("No supplier account found. Please log out and log in again so your supplier account is loaded.")
    }
  }, [isAuthenticated, user, user?.ishyigaAccount, loadOrders, isWrongSeller, setOrders])

  useEffect(() => {
    if (!user?.ishyigaAccount) return
    const timer = setInterval(() => loadOrders(), 30000)
    return () => clearInterval(timer)
  }, [loadOrders, user?.ishyigaAccount])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(orders.length / pageSize)), [orders.length, pageSize])
  const pagedOrders = useMemo(() => orders.slice((page - 1) * pageSize, page * pageSize), [orders, page, pageSize])
  const supplierOrderLink = (orderId: number | string) => `/supplier/orders/${orderId}`

  // Wait for auth to hydrate from localStorage so existing session counts as "logged in"
  if (!hydrated) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center text-slate-600">
          <RotateCw className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p>Checking session…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      <main className="container mx-auto px-4 py-8">
        {isWrongSeller && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-amber-800">
              This link is for another seller. You’re logged in as <strong>{user?.ishyigaAccount}</strong>.
            </p>
            <Button variant="outline" size="sm" onClick={() => router.push("/supplier/orders")}>
              View my orders
            </Button>
          </div>
        )}

        <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
          <h1 className="text-2xl font-bold">My Orders</h1>
          {user?.ishyigaAccount && (
            <Button variant="outline" size="sm" onClick={() => loadOrders()} disabled={loading} className="gap-2">
              <RotateCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          )}
        </div>

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
              {!loading && !err && pagedOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No orders yet. Orders from customers will appear here.
                  </TableCell>
                </TableRow>
              ) : (
                pagedOrders.map(order => (
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
                      <Button variant="outline" size="sm" onClick={() => router.push(supplierOrderLink(order.id))}>
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
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
