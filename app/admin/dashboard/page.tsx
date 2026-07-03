"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  DollarSign,
  ShoppingCart,
  Users,
  AlertCircle,
  TrendingUp,
  Package,
  FileText,
  Smartphone,
} from "lucide-react"
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { postAdminApi } from "@/lib/admin-client"
import { useAuthStore } from "@/lib/auth-store"
import { ResponsiveTable } from "@/components/ui/responsive-table"

type TopupPeriod = 30 | 90 | "all"

interface PlatformTopup {
  topupSalesTotal: number
  topupLineCount: number
  topupOrdersCount: number
  period: "all" | "range"
  rangeDays: number | null
  ordersScanned: number
  ordersAvailable: number
}

interface DashboardKPIs {
  totalRevenue: number
  platformCommission: number
  totalOrders: number
  activeSellers: number
  pendingSellers: number
  activeOrdersToday: number
}

interface SalesData {
  date: string
  revenue: number
  orderCount: number
}

function orderRowKey(order: Record<string, unknown>, idx: number): string {
  const id = order.id ?? order.ID_ORDER
  if (id != null && String(id) !== "") return `o-${id}`
  const num = order.orderNumber ?? order.order_number
  if (num != null && String(num) !== "") return `n-${num}`
  return `i-${idx}`
}

function formatOrderTime(order: Record<string, unknown>): string {
  const t = order.timestamp ?? order.heure ?? order.createdAt ?? order.CREATED_AT
  if (!t) return "—"
  const d = new Date(String(t))
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString()
}

export default function AdminDashboard() {
  const router = useRouter()
  const hasHydrated = useAuthStore((s) => s.hasHydrated)
  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  const [kpis, setKpis] = useState<DashboardKPIs | null>(null)
  const [salesData, setSalesData] = useState<SalesData[]>([])
  const [activeOrders, setActiveOrders] = useState<Record<string, unknown>[]>([])
  const [ordersTotal, setOrdersTotal] = useState(0)
  const [ordersPage, setOrdersPage] = useState(1)
  const pageSize = 10
  const [trendingSectors, setTrendingSectors] = useState<unknown[]>([])
  const [lowInventory, setLowInventory] = useState<unknown[]>([])
  const [complianceAlerts, setComplianceAlerts] = useState<unknown[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [topupPeriod, setTopupPeriod] = useState<TopupPeriod>("all")
  const [topup, setTopup] = useState<PlatformTopup | null>(null)
  const [topupLoading, setTopupLoading] = useState(false)
  const [topupErr, setTopupErr] = useState<string | null>(null)

  useEffect(() => {
    if (!hasHydrated) return
    if (!isAuthenticated || !user || user.role !== "admin") {
      router.replace("/login?redirect=" + encodeURIComponent("/admin/dashboard"))
      return
    }
    loadDashboardData()
  }, [hasHydrated, isAuthenticated, user?.email, user?.role, ordersPage, router])

  useEffect(() => {
    if (!hasHydrated || !isAuthenticated || !user || user.role !== "admin") return
    const email = user.email?.trim()
    if (!email) return

    let cancelled = false
    setTopupLoading(true)
    setTopupErr(null)
    const daysQ = topupPeriod === "all" ? "all" : String(topupPeriod)
    const tok = user.adminApiToken?.trim()

    fetch(`/api/admin/topup-sales?days=${encodeURIComponent(daysQ)}`, {
      credentials: "include",
      headers: {
        "x-admin-email": email,
        ...(tok ? { "x-admin-token": tok } : {}),
      },
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        if (!data?.ok) {
          setTopupErr(data?.error || "Could not load platform top-up totals")
          setTopup(null)
          return
        }
        const period = data.period === "all" ? "all" : "range"
        const rangeDays =
          period === "all"
            ? null
            : typeof data.rangeDays === "number" && !Number.isNaN(data.rangeDays)
              ? data.rangeDays
              : Number(data.days) || 30
        setTopup({
          topupSalesTotal: Number(data.topupSalesTotal) || 0,
          topupLineCount: Number(data.topupLineCount) || 0,
          topupOrdersCount: Number(data.topupOrdersCount) || 0,
          period,
          rangeDays,
          ordersScanned: Number(data.ordersScanned) || 0,
          ordersAvailable: Number(data.ordersAvailable) || 0,
        })
      })
      .catch(() => {
        if (!cancelled) setTopupErr("Could not load platform top-up totals")
      })
      .finally(() => {
        if (!cancelled) setTopupLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [topupPeriod, hasHydrated, isAuthenticated, user?.email, user?.role, user?.adminApiToken])

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      setLoadError(null)

      const [kpisRes, salesRes, ordersRes, sectorsRes, inventoryRes, complianceRes] = await Promise.all([
        postAdminApi({ action: "getDashboardKPIs" }),
        postAdminApi({ action: "getSalesRevenueGraph", period: "daily" }),
        postAdminApi({ action: "getActiveOrders", page: ordersPage, pageSize }),
        postAdminApi({ action: "getTrendingSectors" }),
        postAdminApi({ action: "getLowInventoryAlerts", threshold: 10 }),
        postAdminApi({ action: "getComplianceAlerts" }),
      ])

      const errs: string[] = []

      const kpisData = await kpisRes.json()
      if (kpisData.ok) setKpis(kpisData)
      else errs.push(kpisData.error || `KPIs (${kpisRes.status})`)

      const salesJson = await salesRes.json()
      if (salesJson.ok) setSalesData(salesJson.data || [])
      else errs.push(salesJson.error || `Sales (${salesRes.status})`)

      const ordersData = await ordersRes.json()
      if (ordersData.ok) {
        setActiveOrders(Array.isArray(ordersData.orders) ? ordersData.orders : [])
        setOrdersTotal(ordersData.totalCount || 0)
      } else errs.push(ordersData.error || `Orders (${ordersRes.status})`)

      const sectorsData = await sectorsRes.json()
      if (sectorsData.ok) setTrendingSectors(sectorsData.sectors || [])
      else errs.push(sectorsData.error || `Sectors (${sectorsRes.status})`)

      const inventoryData = await inventoryRes.json()
      if (inventoryData.ok) setLowInventory(inventoryData.alerts || [])
      else errs.push(inventoryData.error || `Inventory (${inventoryRes.status})`)

      const complianceData = await complianceRes.json()
      if (complianceData.ok) setComplianceAlerts(complianceData.alerts || [])
      else errs.push(complianceData.error || `Compliance (${complianceRes.status})`)

      if (errs.length) setLoadError([...new Set(errs)].join(" · "))
    } catch (error) {
      console.error("Error loading dashboard data:", error)
      setLoadError("Could not reach the admin API. Check your connection and try again.")
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-RW", {
      style: "currency",
      currency: "RWF",
      minimumFractionDigits: 0,
    }).format(amount)
  }

  if (!hasHydrated || !isAuthenticated || !user || user.role !== "admin") {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">
          {!hasHydrated ? "Restoring session…" : "Redirecting to sign-in…"}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-[16rem] items-center justify-center">
        <div className="text-slate-500">Loading dashboard...</div>
      </div>
    )
  }

  return (
    <div className="min-h-0 space-y-6">
      <div className="min-w-0 hidden lg:block">
        <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-600 mt-1">Overview of platform performance</p>
      </div>
      <div className="min-w-0 lg:hidden">
        <p className="text-sm text-slate-600">Overview of platform performance</p>
      </div>

      {loadError && (
        <div
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          role="alert"
        >
          <p className="font-medium">Some dashboard data could not be loaded</p>
          <p className="mt-1 text-amber-800">{loadError}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {kpis ? formatCurrency(kpis.totalRevenue) : "0"}
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <DollarSign className="text-green-600" size={24} />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Platform Commission</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {kpis ? formatCurrency(kpis.platformCommission) : "0"}
              </p>
              <p className="text-xs text-gray-500 mt-1">0.1% of revenue</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <TrendingUp className="text-blue-600" size={24} />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Orders</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{kpis?.totalOrders || 0}</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-full">
              <ShoppingCart className="text-purple-600" size={24} />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Sellers</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{kpis?.activeSellers || 0}</p>
              <p className="text-xs text-orange-500 mt-1">{kpis?.pendingSellers || 0} pending</p>
            </div>
            <div className="p-3 bg-orange-100 rounded-full">
              <Users className="text-orange-600" size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 flex flex-col min-h-[200px] lg:min-h-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Low Inventory</h2>
            <AlertCircle className="text-orange-500 shrink-0" size={20} />
          </div>
          <div className="space-y-2 flex-1 overflow-y-auto max-h-44 2xl:max-h-52">
            {lowInventory.length === 0 ? (
              <p className="text-gray-500 text-sm">No low inventory alerts</p>
            ) : (
              lowInventory.slice(0, 10).map((alert: unknown, idx: number) => {
                const a = alert as Record<string, unknown>
                return (
                  <div key={idx} className="flex items-center justify-between p-2 bg-orange-50 rounded-lg gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-xs text-gray-900 truncate">{String(a.itemName ?? "")}</p>
                      <p className="text-[11px] text-gray-600 truncate">{String(a.sellerName ?? "")}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold text-orange-600">{String(a.quantity ?? "")}</p>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 flex flex-col min-h-[200px] lg:min-h-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Compliance</h2>
            <FileText className="text-red-500 shrink-0" size={20} />
          </div>
          <div className="space-y-2 flex-1 overflow-y-auto max-h-44 2xl:max-h-52">
            {complianceAlerts.length === 0 ? (
              <p className="text-gray-500 text-sm">No compliance alerts</p>
            ) : (
              complianceAlerts.map((alert: unknown, idx: number) => {
                const a = alert as Record<string, unknown>
                return (
                  <div key={idx} className="p-2 bg-red-50 rounded-lg">
                    <p className="font-medium text-xs text-gray-900 truncate">{String(a.sellerName ?? "")}</p>
                    <p className="text-[11px] text-red-600 line-clamp-2">{String(a.issue ?? "")}</p>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 border border-emerald-100">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Smartphone className="text-emerald-600 shrink-0" size={22} />
              Top-up sales (all clients)
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Totals from the admin order feed (capped for speed). Requires the same admin session/token as the rest of
              the dashboard.
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              {([30, 90, "all"] as const).map((p) => (
                <button
                  key={String(p)}
                  type="button"
                  onClick={() => setTopupPeriod(p)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    topupPeriod === p
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {p === "all" ? "All" : `${p}d`}
                </button>
              ))}
            </div>
          </div>
          <div className="shrink-0 lg:text-right">
            {topupLoading ? (
              <p className="text-sm text-gray-500">Loading top-up summary…</p>
            ) : topupErr ? (
              <p className="text-sm text-red-600 max-w-md lg:ml-auto">{topupErr}</p>
            ) : topup ? (
              <div>
                <p className="text-2xl font-bold text-emerald-700">{formatCurrency(topup.topupSalesTotal)}</p>
                <p className="text-sm text-gray-600 mt-1">
                  {topup.topupOrdersCount} order{topup.topupOrdersCount === 1 ? "" : "s"} with top-up lines ·{" "}
                  {topup.topupLineCount} line{topup.topupLineCount === 1 ? "" : "s"}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {topup.ordersScanned} orders scanned
                  {topup.ordersAvailable > topup.ordersScanned ? ` (of ${topup.ordersAvailable} in list)` : ""}
                  {topup.period === "all" ? " · capped for speed" : topup.rangeDays != null ? ` · last ${topup.rangeDays} days` : ""}
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No data</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Sales & Revenue (Last 30 Days)</h2>
          <div className="h-[260px] w-full min-w-0 sm:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
            <LineChart data={salesData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="revenue" stroke="#3b82f6" name="Revenue (RWF)" />
              <Line type="monotone" dataKey="orderCount" stroke="#10b981" name="Orders" />
            </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Trending Sectors</h2>
          <div className="h-[260px] w-full min-w-0 sm:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendingSectors as { name?: string; orderCount?: number }[]}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="orderCount" fill="#3b82f6" name="Orders" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Active orders — seller view</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Logistics / fulfilment side (seller name & account context).{" "}
              <Link href="/admin/orders?attentionOnly=1" className="font-medium text-blue-600 hover:underline">
                Open Order Monitor →
              </Link>
            </p>
          </div>
          <Package className="shrink-0 text-blue-500" size={20} />
        </div>
        <ResponsiveTable className="rounded-md border border-slate-100" minWidth="720px">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Order #</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Seller</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Amount</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Time</th>
              </tr>
            </thead>
            <tbody>
              {activeOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-500">
                    No active orders
                  </td>
                </tr>
              ) : (
                activeOrders.map((order, idx) => {
                  const o = order as Record<string, unknown>
                  const status = String(o.status ?? "")
                  return (
                    <tr key={orderRowKey(o, idx)} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm text-gray-900">
                        {String(o.orderNumber ?? o.order_number ?? `#${o.id ?? ""}`)}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-700">{String(o.sellerName ?? o.seller_name ?? "—")}</td>
                      <td className="py-3 px-4 text-sm font-medium text-gray-900">
                        {formatCurrency(Number(o.amount) || 0)}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            status === "PENDING"
                              ? "bg-yellow-100 text-yellow-800"
                              : status === "CONFIRMED"
                                ? "bg-blue-100 text-blue-800"
                                : status === "PROCESSING"
                                  ? "bg-purple-100 text-purple-800"
                                  : "bg-green-100 text-green-800"
                          }`}
                        >
                          {status || "—"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-500">{formatOrderTime(o)}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </ResponsiveTable>
      </div>

      {/* Buyer-focused orders */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Active orders — buyer view</h2>
            <p className="text-sm text-gray-500 mt-0.5">Customer / delivery side (buyer name)</p>
          </div>
          <ShoppingCart className="text-indigo-500" size={20} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Order #</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Buyer</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Amount</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Time</th>
              </tr>
            </thead>
            <tbody>
              {activeOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-500">
                    No active orders
                  </td>
                </tr>
              ) : (
                activeOrders.map((order, idx) => {
                  const o = order as Record<string, unknown>
                  const status = String(o.status ?? "")
                  return (
                    <tr key={`b-${orderRowKey(o, idx)}`} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm text-gray-900">
                        {String(o.orderNumber ?? o.order_number ?? `#${o.id ?? ""}`)}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-700">{String(o.buyerName ?? o.buyer_name ?? "—")}</td>
                      <td className="py-3 px-4 text-sm font-medium text-gray-900">
                        {formatCurrency(Number(o.amount) || 0)}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            status === "PENDING"
                              ? "bg-yellow-100 text-yellow-800"
                              : status === "CONFIRMED"
                                ? "bg-blue-100 text-blue-800"
                                : status === "PROCESSING"
                                  ? "bg-purple-100 text-purple-800"
                                  : "bg-green-100 text-green-800"
                          }`}
                        >
                          {status || "—"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-500">{formatOrderTime(o)}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex flex-col gap-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <div>
            Page {ordersPage} of {Math.max(1, Math.ceil(ordersTotal / pageSize))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded border px-3 py-1 disabled:opacity-50"
              onClick={() => setOrdersPage((p) => Math.max(1, p - 1))}
              disabled={ordersPage === 1}
            >
              Previous
            </button>
            <button
              type="button"
              className="rounded border px-3 py-1 disabled:opacity-50"
              onClick={() => {
                const maxPage = Math.max(1, Math.ceil(ordersTotal / pageSize))
                setOrdersPage((p) => (p < maxPage ? p + 1 : p))
              }}
              disabled={ordersPage >= Math.max(1, Math.ceil(ordersTotal / pageSize))}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
