// app/supplier/orders/page.tsx
"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useAuthStore } from "@/lib/auth-store"
import { useOrdersStore, type Order } from "@/lib/orders-store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, RotateCw, Calendar } from "lucide-react"
import { SdcInfoCell, sdcRaw } from "@/components/sdc-info-cell"

// ===========================================
// Constants
// ===========================================
const SUPPLIER_STATUS = [
  { key: "open", label: "Open" },
  { key: "processing", label: "Processing" },
  { key: "invoice", label: "Invoice" },
  { key: "in-transit", label: "Out for Delivery" },
  { key: "delivered", label: "Delivered" },
] as const

type SupplierStatusKey = typeof SUPPLIER_STATUS[number]["key"]

const ORDER_STATUS_URL = "/api/orders/update-status"

/** Display timestamp as YYYY-MM-DD HH:mm:ss (no ISO T/Z or milliseconds). */
function formatOrderDate(value: unknown): string {
  if (value == null || value === "") return "—"
  const s = String(value).trim()
  if (!s) return "—"
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(s)) return s.replace(/\.\d+Z?$/i, "").slice(0, 19)
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  const h = String(d.getHours()).padStart(2, "0")
  const min = String(d.getMinutes()).padStart(2, "0")
  const sec = String(d.getSeconds()).padStart(2, "0")
  return `${y}-${m}-${day} ${h}:${min}:${sec}`
}

/**
 * Calendar date for date-range filters.
 * - MySQL DATETIME from `order_transaction.heure` (e.g. `2026-03-19 08:43:34`): use the **stored** YYYY-MM-DD
 *   so it matches what you see in the DB (no `Date()` parse quirks / UTC shift).
 * - ISO strings with Z: use local calendar day.
 */
function toLocalDateKey(value: unknown): string {
  if (value == null || value === "") return ""
  const s = String(value).trim()
  if (!s) return ""
  // MySQL DATETIME or "YYYY-MM-DD HH:mm:ss" / "YYYY-MM-DDTHH:mm:ss"
  const mysqlLike = /^(\d{4}-\d{2}-\d{2})[\sT]\d/.exec(s)
  if (mysqlLike) return mysqlLike[1]
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) {
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
    return ""
  }
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function localTodayKey(): string {
  return toLocalDateKey(new Date())
}

function localDateKeysLastNDays(n: number): { from: string; to: string } {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - (n - 1))
  return { from: toLocalDateKey(start), to: toLocalDateKey(end) }
}

function pickAnyStr(row: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k]
    if (v != null && String(v).trim() !== "") return String(v).trim()
  }
  return ""
}

function pickAnyNum(row: Record<string, unknown>, ...keys: string[]): number | null {
  for (const k of keys) {
    const v = row[k]
    if (v == null || String(v).trim() === "") continue
    const n = Number(v)
    if (!Number.isNaN(n)) return n
  }
  return null
}

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
        body: JSON.stringify({
          orderId: Number(order.id),
          status: next,
          publicSiteUrl: typeof window !== "undefined" ? window.location.origin : undefined,
        }),
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
  const [pageSize, setPageSize] = useState(25)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [loadPageSize, setLoadPageSize] = useState(500)
  const [searchQuery, setSearchQuery] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [paymentFilter, setPaymentFilter] = useState<"all" | "paid" | "unpaid">("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [sourceFilter, setSourceFilter] = useState<"all" | "kiosk">("all")

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

    const pageSizeCap = Math.min(500, Math.max(1, loadPageSize))
    console.log("[Supplier Orders] 📤 Fetching orders — sellerAccount:", sellerAccount, "pageSize:", pageSizeCap)
    try {
      const allRaw: any[] = []
      let reportedTotal = 0
      let pageNum = 1
      const maxPages = 40

      while (pageNum <= maxPages) {
        const criteria = statusFilter !== "all" ? statusFilter.toUpperCase() : undefined
        const res = await fetch("/api/seller-orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sellerAccount,
            buyerAccount: searchQuery.trim() || undefined,
            CLIENT: searchQuery.trim() || undefined,
            START: dateFrom ? `${dateFrom} 00:00:00` : undefined,
            END: dateTo ? `${dateTo} 23:59:59` : undefined,
            criteria,
            page: pageNum,
            pageSize: pageSizeCap,
          }),
          cache: "no-store",
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error || "Failed to load orders")

        const batch = json.orders ?? json.data ?? []
        // Helpful when debugging date issues: see exactly what the API sends.
        if (pageNum === 1 && Array.isArray(batch) && batch.length > 0) {
          console.log(
            "[Supplier Orders] 🔍 Sample raw order from API (page 1):",
            batch[0]
          )
        }
        reportedTotal = Number(json.total ?? 0)
        allRaw.push(...(Array.isArray(batch) ? batch : []))

        const got = batch.length
        if (got < pageSizeCap) break
        if (reportedTotal > 0 && allRaw.length >= reportedTotal) break
        pageNum += 1
      }

      console.log(
        "[Supplier Orders] 📥 Loaded pages — orders count:",
        allRaw.length,
        "reportedTotal:",
        reportedTotal || "n/a"
      )

      const rawOrders = allRaw
      const sortedRaw: any[] = (Array.isArray(rawOrders) ? [...rawOrders] : []).sort((a, b) => {
        const aId = Number(a.ID_ORDER ?? a.id_order ?? a.id ?? 0)
        const bId = Number(b.ID_ORDER ?? b.id_order ?? b.id ?? 0)
        return bId - aId
      })
      const mapped: Order[] = sortedRaw.map((t: any) => {
        const kioskCategoryRaw = String(t.KIOSK_CATEGORY ?? t.kiosk_category ?? "").trim()
        const internalDataRaw = String(t.INTERNAL_DATA ?? t.internal_data ?? "").trim()
        const orderNumberRaw = String(t.ORDER_NUMBER ?? t.order_number ?? "").trim()
        const orderTypeRaw = String(t.ORDER_TYPE ?? t.order_type ?? "").trim().toLowerCase()
        const internalUpper = internalDataRaw.toUpperCase()
        const orderNumberUpper = orderNumberRaw.toUpperCase()

        // Heuristic: kiosk orders usually carry KIOSK_* fields/tokens in INTERNAL_DATA.
        // This lets staff distinguish kiosk self-ordering from regular supplier orders.
        const isKioskOrder = !!(
          Boolean(kioskCategoryRaw) ||
          internalUpper.includes("KIOSK_LANES:") ||
          internalUpper.includes("KIOSK_PICKUP_DONE") ||
          internalUpper.includes("KIOSK_SPEAK_SEQ:") ||
          orderNumberUpper.startsWith("KIOSK") ||
          (Boolean(orderTypeRaw) &&
            (orderTypeRaw === "takeaway" || orderTypeRaw === "dine-in") &&
            internalUpper.includes("KIOSK"))
        )

        return {
          rawRow: t,
          id: String(t.ID_ORDER ?? t.id_order ?? t.id ?? ""),
          sellerId: String(t.SELLER_ISHYIGA_ACCOUNT ?? t.seller_ishyiga_account ?? ""),
          sellerName: t.SELLER_NAMES ?? t.SELLER_OWNER ?? t.seller_names ?? "Supplier",
          items: [],
          itemsCount: undefined,
          subtotal: Number(t.AMOUNT ?? t.amount ?? 0),
          status: (t.ORDER_STATUS ?? t.order_status ?? "open")?.toLowerCase() || "open",
          supplierStatus: (t.ORDER_STATUS ?? t.order_status ?? "open")?.toLowerCase() || "open",
          // DB: chaos_beta.order_transaction.heure — list API may send heure / HEURE / CREATED_AT
          createdAt: (() => {
            const raw =
              t.heure ??
              t.HEURE ??
              t.CREATED_AT ??
              t.created_at ??
              t.ORDER_DATE ??
              t.order_date
            const str = raw != null ? String(raw).trim() : ""
            return str || new Date().toISOString()
          })(),
          buyerTIN: t.BUYER_TIN ?? t.buyer_tin ?? "",
          SUPPLIER_TIN: t.SELLER_TIN ?? t.seller_tin ?? "",
          // Prefer account_signup OWNER-style fields over generic BUYER_OWNER labels.
          buyerOwner: t.OWNER ?? t.owner ?? t.BUYER_OWNER_NAME ?? t.BUYER_OWNER ?? t.buyer_owner_name ?? "",
          buyerName: (() => {
            if (isKioskOrder) {
              const kioskCustomerName = String(t.BUYER_NAMES ?? t.BUYER_NAME ?? t.CUSTOMER_NAME ?? t.customer_name ?? "").toString().trim()
              const kioskTable = String(t.TABLE_NUMBER ?? t.table_number ?? "").toString().trim()
              // For self-order, show the guest name they typed (fallback to table if present).
              if (kioskCustomerName) return kioskCustomerName
              if (kioskTable) return `Table: ${kioskTable}`
            }

            const raw =
              (t.BUYER_NAMES ?? t.BUYER_NAME ?? t.BUYER_OWNER_NAME ?? t.BUYER_OWNER ?? t.BUYER_ISHYIGA_ACCOUNT ?? t.buyer_name ?? "")
                .toString()
                .trim() || "Guest Buyer"
            const seller = (t.SELLER_NAMES ?? t.SELLER_OWNER ?? "").toString().trim()
            if (seller && raw && seller.toLowerCase() === raw.toLowerCase())
              return t.TABLE_NAME ? `Table: ${t.TABLE_NAME}` : "Guest Buyer"
            return raw
          })(),
          isKioskOrder,
          paymentStatus: /(pay[_\s-]*on[_\s-]*delivery|cod)/i.test(String(t.PAYMENT_NAME ?? t.payment_name ?? "")) ? "unpaid" : "paid",
          servedAmount:
            pickAnyNum(t, "SERVED_AMOUNT", "servedAmount", "AMOUNT_SERVED", "SERVED_TOTAL") ?? 0,
          servedQty:
            pickAnyNum(t, "CONFIRMED_RECEIVED_QTY", "SERVED_QTY", "servedQty", "SERVED_QUANTITY", "received_quantity") ?? 0,
          orderNote:
            pickAnyStr(t, "CONDITIONS", "ORDER_NOTE", "orderNote", "NOTE") || "",
          internalData: pickAnyStr(t, "INTERNAL_DATA", "internal_data"),
          timeSdc: pickAnyStr(t, "TIME_SDC", "time_sdc", "SDC_TIME", "sdc_time"),
          sdcId: pickAnyStr(t, "SDC_ID", "sdc_id"),
          receiptNumber: pickAnyStr(t, "RECEIPT_NUMBER", "receipt_number"),
          sdcInternalData: pickAnyStr(t, "SDC_INTERNAL_DATA", "sdc_internal_data"),
          receiptSignature: pickAnyStr(t, "RECEIPT_SIGNATURE", "receipt_signature"),
        }
      })

      setOrders(mapped)
      setLastRefresh(new Date())
    } catch (e: any) {
      setErr(e.message || "Failed to load orders")
    } finally {
      setLoading(false)
    }
  }, [user?.ishyigaAccount, setOrders, loadPageSize, searchQuery, dateFrom, dateTo, statusFilter])

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

  useEffect(() => {
    setPage(1)
  }, [searchQuery, dateFrom, dateTo, paymentFilter, statusFilter, sourceFilter])

  const filteredOrders = useMemo(() => {
    let list = orders
    const q = searchQuery.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (o) =>
          (o.id && o.id.toLowerCase().includes(q)) ||
          (o.buyerName && o.buyerName.toLowerCase().includes(q)) ||
          (o.createdAt && String(o.createdAt).toLowerCase().includes(q)) ||
          (o.subtotal != null && String(o.subtotal).includes(q)) ||
          (o.paymentStatus && o.paymentStatus.toLowerCase().includes(q)) ||
          (o.status && o.status.toLowerCase().includes(q))
      )
    }
    if (dateFrom) {
      const from = dateFrom.slice(0, 10)
      list = list.filter((o) => {
        const d = toLocalDateKey(o.createdAt)
        if (d === "") return false
        return d >= from
      })
    }
    if (dateTo) {
      const to = dateTo.slice(0, 10)
      list = list.filter((o) => {
        const d = toLocalDateKey(o.createdAt)
        if (d === "") return false
        return d <= to
      })
    }
    if (paymentFilter !== "all") {
      list = list.filter((o) => (o.paymentStatus || "").toLowerCase() === paymentFilter)
    }
    if (statusFilter !== "all") {
      list = list.filter((o) => (o.status || o.supplierStatus || "").toLowerCase() === statusFilter.toLowerCase())
    }
    if (sourceFilter === "kiosk") {
      list = list.filter((o) => !!o.isKioskOrder)
    }
    return list
  }, [orders, searchQuery, dateFrom, dateTo, paymentFilter, statusFilter, sourceFilter])

  const displayPageSize = pageSize === -1 ? filteredOrders.length : Math.max(1, pageSize)
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredOrders.length / displayPageSize)),
    [filteredOrders.length, displayPageSize]
  )
  const pagedOrders = useMemo(
    () => (pageSize === -1 ? filteredOrders : filteredOrders.slice((page - 1) * pageSize, page * pageSize)),
    [filteredOrders, page, pageSize]
  )
  const supplierOrderLink = (orderId: number | string) => `/supplier/orders/${orderId}`
  const exportOrderRowCsv = (order: any) => {
    const fields = [
      "Order ID",
      "Buyer",
      "Company",
      "Amount",
      "Served Amount",
      "Status",
      "Date",
      "TIME_SDC",
      "SDC_ID",
      "RECEIPT_NUMBER",
      "SDC_INTERNAL_DATA",
      "RECEIPT_SIGNATURE",
    ]
    const values = [
      String(order.id ?? ""),
      String(order.buyerName ?? ""),
      String(order.buyerOwner ?? ""),
      String(order.subtotal ?? 0),
      String(Number(order.servedAmount ?? 0)),
      String(order.status ?? ""),
      String(order.createdAt ?? ""),
      sdcRaw(order.timeSdc) === "N/A" ? "" : String(order.timeSdc).trim(),
      sdcRaw(order.sdcId) === "N/A" ? "" : String(order.sdcId).trim(),
      sdcRaw(order.receiptNumber) === "N/A" ? "" : String(order.receiptNumber).trim(),
      sdcRaw(order.sdcInternalData) === "N/A" ? "" : String(order.sdcInternalData).trim(),
      sdcRaw(order.receiptSignature) === "N/A" ? "" : String(order.receiptSignature).trim(),
    ]
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`
    const csv = `${fields.map(esc).join(",")}\n${values.map(esc).join(",")}\n`
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `order-${order.id}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

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
    <div className="min-h-0 bg-slate-50">
      <main className="w-full px-2 sm:px-4 py-4 sm:py-6">
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

        <div className="mb-4 flex flex-col gap-4 rounded-lg border bg-white p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:flex-1 sm:min-w-[200px] sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by order #, customer, date, total, payment, status..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm text-muted-foreground whitespace-nowrap">Search by dates</span>
              <Input
                type="date"
                aria-label="From date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full sm:w-[140px]"
              />
              <span className="text-muted-foreground">–</span>
              <Input
                type="date"
                aria-label="To date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full sm:w-[140px]"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-9"
                onClick={() => {
                  const t = localTodayKey()
                  setDateFrom(t)
                  setDateTo(t)
                }}
              >
                Today
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9"
                onClick={() => {
                  const { from, to } = localDateKeysLastNDays(7)
                  setDateFrom(from)
                  setDateTo(to)
                }}
              >
                Last 7 days
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9"
                onClick={() => {
                  setDateFrom("")
                  setDateTo("")
                }}
              >
                Clear dates
              </Button>
            </div>
            <Select value={paymentFilter} onValueChange={(v) => setPaymentFilter(v as "all" | "paid" | "unpaid")}>
              <SelectTrigger className="w-full sm:w-[130px]">
                <SelectValue placeholder="Payment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All payment</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[130px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                {SUPPLIER_STATUS.map((opt) => (
                  <SelectItem key={opt.key} value={opt.key}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as "all" | "kiosk")}>
              <SelectTrigger className="w-full sm:w-[170px]">
                <SelectValue placeholder="Order source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All orders</SelectItem>
                <SelectItem value="kiosk">Self Order (kiosk)</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={pageSize === -1 ? "all" : String(pageSize)}
              onValueChange={(v) => {
                setPageSize(v === "all" ? -1 : Number(v))
                setPage(1)
              }}
            >
              <SelectTrigger className="w-full sm:w-[110px]">
                <SelectValue placeholder="Per page" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 per page</SelectItem>
                <SelectItem value="25">25 per page</SelectItem>
                <SelectItem value="50">50 per page</SelectItem>
                <SelectItem value="100">100 per page</SelectItem>
                <SelectItem value="all">Show all</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setLoadPageSize(500)
                loadOrders()
              }}
              disabled={loading}
              className="gap-2"
            >
              <RotateCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Load all orders
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Showing{" "}
            {filteredOrders.length === 0
              ? "0"
              : pageSize === -1
                ? 1
                : (page - 1) * pageSize + 1}
            –
            {filteredOrders.length === 0 ? 0 : pageSize === -1 ? filteredOrders.length : Math.min(page * pageSize, filteredOrders.length)} of{" "}
            {filteredOrders.length} order{filteredOrders.length !== 1 ? "s" : ""}
            {orders.length > 0 && filteredOrders.length !== orders.length && " (filtered)"}
          </p>
        </div>

        <div className="rounded-lg border bg-white overflow-x-auto">
          <Table className="min-w-[1150px]">
            <TableHeader>
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Served Amount</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>SDC Info</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!loading && !err && pagedOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    {orders.length === 0
                      ? "No orders yet. Orders from customers will appear here."
                      : "No orders match your search or filters. Try different criteria."}
                  </TableCell>
                </TableRow>
              ) : (
                pagedOrders.map(order => (
                  <TableRow key={order.id}>
                    <TableCell>{order.id}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{order.buyerName}</span>
                        {order.isKioskOrder && (
                          <span className="text-xs font-semibold rounded-full bg-emerald-600/10 text-emerald-700 px-2 py-0.5">
                            Self Order (kiosk)
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{(order as any).buyerOwner || "—"}</TableCell>
                    <TableCell>{Number((order as any).servedAmount ?? 0).toLocaleString()} RWF</TableCell>
                    <TableCell>{formatOrderDate(order.createdAt)}</TableCell>
                    <TableCell className="align-middle">
                      <SdcInfoCell order={order} />
                    </TableCell>
                    <TableCell>{order.subtotal.toLocaleString()} RWF</TableCell>
                    <TableCell>{order.paymentStatus}</TableCell>
                    <TableCell>
                      <InlineStatusPicker order={order} orders={orders} setOrders={setOrders} />
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col sm:flex-row gap-2 justify-center sm:items-center">
                        <Button variant="outline" size="sm" onClick={() => router.push(supplierOrderLink(order.id))}>
                          View
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => exportOrderRowCsv(order)}>
                          Export
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
          <Button disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
          <span>Page {page} of {totalPages}</span>
          <Button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      </main>
    </div>
  )
}
