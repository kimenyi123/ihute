"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import {
  ChevronDown,
  ChevronUp,
  Eye,
  Loader2,
  RefreshCw,
  Search,
  SlidersHorizontal,
} from "lucide-react"
import { postAdminApi, postAdminEbmRequest } from "@/lib/admin-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  attentionReasonLabel,
  buyerTrackHref,
  formatAdminCurrency,
  formatOrderTime,
  formatOrderTimeRelative,
  getOrderAttentionReasons,
  getPaymentBadgeClass,
  getStatusBadgeClass,
  getStatusLabel,
  normalizeOrderStatus,
  orderNeedsAttention,
  deriveSellerFulfillment,
  sellerFulfillmentHint,
  sellerFulfillmentLabel,
  type AdminMonitorOrder,
  type SellerFulfillment,
} from "@/lib/admin-order-monitor"
import { fetchOrderMonitorStats, type OrderMonitorStats } from "@/lib/admin-order-stats"
import { OrderMonitorCharts } from "@/components/admin/order-monitor-charts"
import { downloadExcel } from "@/lib/grandma-excel-export"

const PAGE_SIZE = 20
const AUTO_REFRESH_MS = 30_000

type Filters = {
  sector: string
  sellerAccount: string
  status: string
  paymentStatus: string
  buyerSearch: string
  dateFrom: string
  dateTo: string
  attentionOnly: boolean
  fulfillment: string
}

const defaultFilters: Filters = {
  sector: "",
  sellerAccount: "",
  status: "",
  paymentStatus: "",
  buyerSearch: "",
  dateFrom: "",
  dateTo: "",
  attentionOnly: false,
  fulfillment: "",
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<AdminMonitorOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filters, setFilters] = useState<Filters>(defaultFilters)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [sectors, setSectors] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [ebmLoadingId, setEbmLoadingId] = useState<number | null>(null)
  const [ebmMessage, setEbmMessage] = useState<string | null>(null)
  const [attentionCount, setAttentionCount] = useState(0)
  const [awaitingSellerCount, setAwaitingSellerCount] = useState(0)
  const [sellerServingCount, setSellerServingCount] = useState(0)
  const [completedCount, setCompletedCount] = useState(0)
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [chartStats, setChartStats] = useState<OrderMonitorStats | null>(null)
  const [chartsLoading, setChartsLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [notifyingId, setNotifyingId] = useState<number | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState("")
  const requestIdRef = useRef(0)

  const updateFilters = (next: Partial<Filters>) => {
    setFilters((current) => ({ ...current, ...next }))
    setPage(1)
  }

  // Debounce search so typing does not race / drop requests mid-flight.
  useEffect(() => {
    const t = window.setTimeout(() => {
      setFilters((current) => {
        if (current.buyerSearch === searchInput) return current
        return { ...current, buyerSearch: searchInput }
      })
      setPage(1)
    }, 300)
    return () => window.clearTimeout(t)
  }, [searchInput])

  const loadSectors = useCallback(async () => {
    try {
      const res = await postAdminApi({ action: "getSectors" })
      const data = await res.json()
      if (data.ok) {
        setSectors((data.sectors || []).map((s: { name: string }) => s.name))
      }
    } catch (error) {
      console.error("Error loading sectors:", error)
    }
  }, [])

  const loadChartStats = useCallback(async () => {
    try {
      setChartsLoading(true)
      const stats = await fetchOrderMonitorStats()
      setChartStats(stats)
    } finally {
      setChartsLoading(false)
    }
  }, [])

  const loadOrders = useCallback(
    async (silent = false) => {
      const requestId = ++requestIdRef.current
      try {
        if (silent) setRefreshing(true)
        else setLoading(true)

        const res = await postAdminApi({
          action: "getAllOrders",
          ...filters,
          buyerSearch: filters.buyerSearch.trim(),
          attentionOnly: filters.attentionOnly ? "true" : "",
          limit: PAGE_SIZE,
          page,
          ...(silent ? { includeStats: "false" } : {}),
        })
        const data = await res.json()
        // Ignore stale responses when filters/search changed mid-flight.
        if (requestId !== requestIdRef.current) return

        if (data.ok) {
          setLoadError(null)
          setOrders(data.orders || [])
          const count = Number(data.totalCount ?? data.totalOrders ?? 0) || 0
          if (count > 0 || !silent) {
            setTotalCount(count)
            setTotalPages(count > 0 ? Math.max(1, Math.ceil(count / PAGE_SIZE)) : 1)
          }
          if (!silent || data.attentionCount != null) {
            setAttentionCount(Number(data.attentionCount ?? 0) || 0)
          }
          if (!silent || data.awaitingSellerCount != null) {
            setAwaitingSellerCount(Number(data.awaitingSellerCount ?? 0) || 0)
            setSellerServingCount(Number(data.sellerServingCount ?? 0) || 0)
            setCompletedCount(Number(data.completedCount ?? 0) || 0)
          }
          if (!silent || data.totalRevenue != null) {
            setTotalRevenue(Number(data.totalRevenue ?? 0) || 0)
          }
          setLastUpdated(new Date())
        } else {
          setLoadError(data.error || "Could not load orders")
        }
      } catch (error) {
        if (requestId !== requestIdRef.current) return
        console.error("Error loading orders:", error)
        setLoadError("Could not reach order service — showing last loaded data")
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    },
    [filters, page],
  )

  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    if (params.get("attentionOnly") === "1") {
      setFilters((f) => ({ ...f, attentionOnly: true }))
      setFiltersOpen(true)
    }
    const seller = params.get("sellerAccount")
    if (seller) {
      setFilters((f) => ({ ...f, sellerAccount: seller }))
      setFiltersOpen(true)
    }
  }, [])

  useEffect(() => {
    loadSectors()
    loadChartStats()
  }, [loadSectors, loadChartStats])

  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  useEffect(() => {
    if (!autoRefresh) return
    const id = window.setInterval(() => {
      loadOrders(true)
      loadChartStats()
    }, AUTO_REFRESH_MS)
    return () => window.clearInterval(id)
  }, [autoRefresh, loadOrders, loadChartStats])

  useEffect(() => {
    const onNew = () => {
      loadOrders(true)
      loadChartStats()
    }
    window.addEventListener("ihute:admin-new-orders", onNew)
    return () => window.removeEventListener("ihute:admin-new-orders", onNew)
  }, [loadOrders, loadChartStats])

  const handleNotifySeller = async (order: AdminMonitorOrder) => {
    setNotifyingId(order.id)
    setToast(null)
    try {
      const res = await postAdminApi({ action: "notifySellerOrder", orderId: order.id })
      const data = await res.json()
      setToast(data.ok ? data.message || "Seller notified." : data.error || "Notify failed")
    } catch {
      setToast("Network error")
    } finally {
      setNotifyingId(null)
      window.setTimeout(() => setToast(null), 5000)
    }
  }

  const requestEbm = async (orderId: number) => {
    setEbmMessage(null)
    setEbmLoadingId(orderId)
    try {
      const res = await postAdminEbmRequest(orderId)
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setEbmMessage(data.error || "EBM request failed")
        return
      }
      setEbmMessage(
        data.duplicate
          ? `Order #${orderId} already fiscalized (receipt ${data.receiptNumber || "—"})`
          : `EBM OK for order #${orderId}${data.receiptNumber ? ` — receipt ${data.receiptNumber}` : ""}`,
      )
    } catch (e) {
      setEbmMessage(e instanceof Error ? e.message : "EBM request failed")
    } finally {
      setEbmLoadingId(null)
    }
  }

  const activeFilterCount = [
    filters.sector,
    filters.sellerAccount,
    filters.status,
    filters.paymentStatus,
    filters.dateFrom,
    filters.dateTo,
    filters.attentionOnly,
    filters.fulfillment,
    filters.buyerSearch.trim(),
  ].filter(Boolean).length

  const exportToExcel = () => {
    const rows = orders.map((order) => ({
      "Order #": order.orderNumber || `#${order.id}`,
      Seller: order.sellerName || "",
      Buyer: order.buyerName || "",
      Amount: order.amount ?? 0,
      Status: getStatusLabel(normalizeOrderStatus(order)),
      "Payment status": order.paymentStatus || "OPEN",
      Payment: order.paymentName || "",
      Time: order.timestamp ? new Date(order.timestamp).toLocaleString() : "",
      "Delivery location": order.deliveryLocation || "",
    }))
    const ok = downloadExcel(rows, "Orders", "admin_order_monitor")
    if (!ok) window.alert("No orders to export.")
  }

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-8 border-b border-slate-200 pb-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-slate-500">Operations</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Order Monitor</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
              Every buyer order across IHUTE shops. When payment is confirmed but the seller never moved the order,
              use <span className="font-medium text-slate-800">Notify seller</span> — the header bell also alerts you to new orders.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600">
              <span
                className={`h-1.5 w-1.5 rounded-full ${autoRefresh ? "bg-slate-900" : "bg-slate-300"}`}
                aria-hidden
              />
              {lastUpdated ? `Updated ${formatOrderTimeRelative(lastUpdated.toISOString())}` : "Connecting…"}
            </span>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-slate-300"
              />
              Live
            </label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                loadOrders(true)
                loadChartStats()
              }}
              disabled={refreshing}
              className="h-8 border-slate-200 text-slate-700"
            >
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={exportToExcel}
              disabled={loading || orders.length === 0}
              className="h-8 bg-emerald-600 text-white hover:bg-emerald-700"
            >
              Export to Excel
            </Button>
          </div>
        </div>
      </header>

      {toast ? (
        <div className="mb-6 rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800">{toast}</div>
      ) : null}

      {loadError ? (
        <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {loadError}
        </div>
      ) : null}

      {ebmMessage ? (
        <div className="mb-6 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          {ebmMessage}
          <button type="button" className="ml-3 underline" onClick={() => setEbmMessage(null)}>
            Dismiss
          </button>
        </div>
      ) : null}

      <OrderMonitorCharts
        stats={chartStats}
        loading={chartsLoading}
        totalRevenue={totalRevenue}
        filteredCount={totalCount}
      />

      <div className="mb-6 flex items-center justify-between gap-4 border-b border-slate-200 pb-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Order feed</h2>
          <p className="text-xs text-slate-500">
            {totalCount.toLocaleString()} orders · {awaitingSellerCount.toLocaleString()} not served ·{" "}
            {sellerServingCount.toLocaleString()} serving · {completedCount.toLocaleString()} completed
          </p>
        </div>
        <p className="text-xs text-slate-500">
          Page {page} of {totalPages}
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            { key: "", label: "All fulfillment" },
            { key: "awaiting_seller", label: `Not served (${awaitingSellerCount})` },
            { key: "seller_serving", label: `Serving (${sellerServingCount})` },
            { key: "completed", label: `Completed (${completedCount})` },
          ] as const
        ).map((chip) => (
          <Button
            key={chip.key || "all"}
            type="button"
            variant="outline"
            size="sm"
            className={`h-8 border-slate-200 text-xs ${
              filters.fulfillment === chip.key ? "border-slate-900 bg-slate-900 text-white hover:bg-slate-800" : "text-slate-700"
            }`}
            onClick={() => updateFilters({ fulfillment: chip.key })}
          >
            {chip.label}
          </Button>
        ))}
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search order #, buyer, phone, email, seller, LIV / payment ref…"
            className="h-10 border-slate-200 bg-white pl-9 text-sm"
          />
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10 border-slate-200 text-slate-700"
            onClick={() => updateFilters({ attentionOnly: !filters.attentionOnly })}
          >
            {filters.attentionOnly ? "All orders" : "Follow-up only"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10 border-slate-200 text-slate-700"
            onClick={() => setFiltersOpen((o) => !o)}
          >
            <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />
            Filters
            {activeFilterCount > 0 ? (
              <span className="ml-1.5 rounded border border-slate-300 px-1.5 text-[10px]">{activeFilterCount}</span>
            ) : null}
            {filtersOpen ? (
              <ChevronUp className="ml-1 h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="ml-1 h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>

      {filtersOpen ? (
        <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Seller account">
              <Input
                value={filters.sellerAccount}
                onChange={(e) => updateFilters({ sellerAccount: e.target.value })}
                placeholder="supplier_…"
                className="h-9 border-slate-200 text-sm"
              />
            </Field>
            <Field label="Sector">
              <select
                value={filters.sector}
                onChange={(e) => updateFilters({ sector: e.target.value })}
                className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800"
              >
                <option value="">All sectors</option>
                {sectors.map((sector) => (
                  <option key={sector} value={sector}>
                    {sector}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Order status">
              <select
                value={filters.status}
                onChange={(e) => updateFilters({ status: e.target.value })}
                className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800"
              >
                <option value="">All (excl. cancelled)</option>
                <option value="OPEN">Open</option>
                <option value="INVOICE">Invoice</option>
                <option value="IN-TRANSIT">Out for delivery</option>
                <option value="DELIVERED">Delivered</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </Field>
            <Field label="Payment">
              <select
                value={filters.paymentStatus}
                onChange={(e) => updateFilters({ paymentStatus: e.target.value })}
                className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800"
              >
                <option value="">All</option>
                <option value="PAID">Paid</option>
                <option value="PENDING">Pending</option>
                <option value="UNPAID">Unpaid</option>
              </select>
            </Field>
            <Field label="Seller fulfillment">
              <select
                value={filters.fulfillment}
                onChange={(e) => updateFilters({ fulfillment: e.target.value })}
                className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800"
              >
                <option value="">All</option>
                <option value="awaiting_seller">Not served yet</option>
                <option value="seller_serving">Seller serving</option>
                <option value="completed">Completed</option>
              </select>
            </Field>
            <Field label="From">
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => updateFilters({ dateFrom: e.target.value })}
                className="h-9 border-slate-200 text-sm"
              />
            </Field>
            <Field label="To">
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => updateFilters({ dateTo: e.target.value })}
                className="h-9 border-slate-200 text-sm"
              />
            </Field>
            <div className="flex items-end sm:col-span-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-slate-600"
                onClick={() => {
                  setSearchInput("")
                  setFilters(defaultFilters)
                  setPage(1)
                }}
              >
                Reset filters
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading orders…
          </div>
        ) : orders.length === 0 ? (
          <div className="py-20 text-center text-sm text-slate-500">No orders match these filters.</div>
        ) : (
          <>
            <div className="hidden lg:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    <th className="w-12 px-3 py-3 text-center">#</th>
                    <th className="px-4 py-3">Order</th>
                    <th className="px-4 py-3">Seller</th>
                    <th className="px-4 py-3">Buyer</th>
                    <th className="px-4 py-3 text-right whitespace-nowrap">Amount</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Seller served?</th>
                    <th className="px-4 py-3">Payment</th>
                    <th className="px-4 py-3">When</th>
                    <th className="px-4 py-3 text-right"> </th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order, index) => (
                    <OrderTableRow
                      key={order.id}
                      order={order}
                      rowNumber={(page - 1) * PAGE_SIZE + index + 1}
                      notifyingId={notifyingId}
                      ebmLoadingId={ebmLoadingId}
                      onNotify={handleNotifySeller}
                      onRequestEbm={requestEbm}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-slate-100 lg:hidden">
              {orders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  notifyingId={notifyingId}
                  ebmLoadingId={ebmLoadingId}
                  onNotify={handleNotifySeller}
                  onRequestEbm={requestEbm}
                />
              ))}
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">
                {orders.length} of {totalCount.toLocaleString()} orders
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="h-8 border-slate-200"
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="h-8 border-slate-200"
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      {children}
    </div>
  )
}

function OrderTableRow({
  order,
  rowNumber,
  notifyingId,
  ebmLoadingId,
  onNotify,
  onRequestEbm,
}: {
  order: AdminMonitorOrder
  rowNumber: number
  notifyingId: number | null
  ebmLoadingId: number | null
  onNotify: (o: AdminMonitorOrder) => void
  onRequestEbm: (orderId: number) => void
}) {
  const normalizedStatus = normalizeOrderStatus(order)
  const attention = orderNeedsAttention(order)
  const reasons = getOrderAttentionReasons(order)
  const fulfillment = deriveSellerFulfillment(order)

  return (
    <tr
      className={`border-b border-slate-100 last:border-0 cursor-pointer transition-colors hover:bg-slate-50 ${
        attention ? "border-l-2 border-l-slate-900" : ""
      }`}
    >
      <td className="w-12 px-3 py-3 text-center text-slate-500">{rowNumber}</td>
      <td className="px-4 py-3">
        <Link href={`/admin/orders/${order.id}`} className="font-medium text-slate-900 hover:underline">
          {order.orderNumber || `#${order.id}`}
        </Link>
        {attention ? (
          <p className="mt-1 text-[11px] text-slate-500">{reasons.map(attentionReasonLabel).join(" · ")}</p>
        ) : null}
      </td>
      <td className="px-4 py-3">
        <p className="text-slate-800">{order.sellerName}</p>
        {order.sellerIshyigaAccount ? (
          <p className="font-mono text-[11px] text-slate-500">{order.sellerIshyigaAccount}</p>
        ) : null}
      </td>
      <td className="px-4 py-3">
        <p className="text-slate-800">{order.buyerName || "Guest"}</p>
        <p className="text-xs text-slate-500">{order.buyerPhone || "—"}</p>
      </td>
      <td className="px-4 py-3 text-right font-medium tabular-nums text-slate-900 whitespace-nowrap">
        {formatAdminCurrency(order.amount)}
      </td>
      <td className="px-4 py-3">
        <span className={getStatusBadgeClass(normalizedStatus)}>{getStatusLabel(normalizedStatus)}</span>
      </td>
      <td className="px-4 py-3">
        <FulfillmentCell order={order} fulfillment={fulfillment} />
      </td>
      <td className="px-4 py-3">
        <span className={getPaymentBadgeClass(order.paymentStatus === "PAID")}>
          {order.paymentStatus || "—"}
        </span>
        {order.paymentId ? (
          <p className="mt-1 max-w-[120px] truncate font-mono text-[10px] text-slate-400" title={order.paymentId}>
            {order.paymentId}
          </p>
        ) : null}
      </td>
      <td className="px-4 py-3 text-xs text-slate-500">
        <p>{formatOrderTimeRelative(order.timestamp)}</p>
        <p className="mt-0.5 text-[10px] text-slate-400">{formatOrderTime(order.timestamp)}</p>
      </td>
      <td className="px-4 py-3 text-right">
        <OrderActions
          order={order}
          notifyingId={notifyingId}
          ebmLoadingId={ebmLoadingId}
          onNotify={onNotify}
          onRequestEbm={onRequestEbm}
        />
      </td>
    </tr>
  )
}

function OrderCard({
  order,
  notifyingId,
  ebmLoadingId,
  onNotify,
  onRequestEbm,
}: {
  order: AdminMonitorOrder
  notifyingId: number | null
  ebmLoadingId: number | null
  onNotify: (o: AdminMonitorOrder) => void
  onRequestEbm: (orderId: number) => void
}) {
  const attention = orderNeedsAttention(order)
  const normalizedStatus = normalizeOrderStatus(order)
  const fulfillment = deriveSellerFulfillment(order)

  return (
    <div className={`p-4 ${attention ? "border-l-2 border-l-slate-900" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <Link href={`/admin/orders/${order.id}`} className="font-medium text-slate-900">
            {order.orderNumber || `#${order.id}`}
          </Link>
          <p className="mt-1 text-xs text-slate-500">{formatOrderTimeRelative(order.timestamp)}</p>
        </div>
        <p className="font-semibold tabular-nums text-slate-900">{formatAdminCurrency(order.amount)}</p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
        <div>
          <span className="text-slate-400">Seller</span>
          <p className="text-slate-800">{order.sellerName}</p>
        </div>
        <div>
          <span className="text-slate-400">Buyer</span>
          <p className="text-slate-800">{order.buyerName || "Guest"}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className={getStatusBadgeClass(normalizedStatus)}>{getStatusLabel(normalizedStatus)}</span>
        <span className={getPaymentBadgeClass(order.paymentStatus === "PAID")}>
          {order.paymentStatus || "—"}
        </span>
        <span className={getStatusBadgeClass()} title={sellerFulfillmentHint(fulfillment)}>
          {sellerFulfillmentLabel(fulfillment)}
        </span>
      </div>
      <div className="mt-3 flex justify-end">
        <OrderActions
          order={order}
          notifyingId={notifyingId}
          ebmLoadingId={ebmLoadingId}
          onNotify={onNotify}
          onRequestEbm={onRequestEbm}
        />
      </div>
    </div>
  )
}

function FulfillmentCell({
  order,
  fulfillment,
}: {
  order: AdminMonitorOrder
  fulfillment: SellerFulfillment
}) {
  const servedAmt = Number(order.servedAmount ?? 0)
  const servedQty = Number(order.servedQtyTotal ?? 0)
  return (
    <div>
      <span className={getStatusBadgeClass()} title={sellerFulfillmentHint(fulfillment)}>
        {sellerFulfillmentLabel(fulfillment)}
      </span>
      {fulfillment === "seller_serving" || servedAmt > 0 || servedQty > 0 ? (
        <p className="mt-1 text-[10px] text-slate-500">
          {servedAmt > 0 ? formatAdminCurrency(servedAmt) : null}
          {servedAmt > 0 && servedQty > 0 ? " · " : null}
          {servedQty > 0 ? `${servedQty} qty served` : null}
        </p>
      ) : fulfillment === "awaiting_seller" ? (
        <p className="mt-1 text-[10px] text-slate-500">No served amount</p>
      ) : null}
    </div>
  )
}

function OrderActions({
  order,
}: {
  order: AdminMonitorOrder
  notifyingId: number | null
  ebmLoadingId: number | null
  onNotify: (o: AdminMonitorOrder) => void
  onRequestEbm: (orderId: number) => void
}) {
  return (
    <Link
      href={`/admin/orders/${order.id}`}
      className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-700 whitespace-nowrap"
    >
      <Eye className="h-4 w-4" />
      View
    </Link>
  )
}
