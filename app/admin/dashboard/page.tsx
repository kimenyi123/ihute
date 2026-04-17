"use client"

import { useEffect, useState } from 'react'
import {
  DollarSign,
  ShoppingCart,
  Users,
  AlertCircle,
  TrendingUp,
  Package,
  FileText
} from 'lucide-react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useAuthStore } from '@/lib/auth-store'
import { mapBackendOrderStatusToTrack, type TrackOrderStatus } from '@/lib/order-status-map'
import { ResponsiveTable } from '@/components/ui/responsive-table'

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

function getStatusLabel(status: TrackOrderStatus): string {
  switch (status) {
    case 'pending':
      return 'Pending'
    case 'open':
      return 'Open'
    case 'processing':
      return 'Processing'
    case 'invoice':
      return 'Invoice'
    case 'in-transit':
      return 'Out for Delivery'
    case 'delivered':
      return 'Delivered'
    default:
      return 'Open'
  }
}

function getStatusBadgeClass(status: TrackOrderStatus): string {
  switch (status) {
    case 'pending':
      return 'bg-yellow-100 text-yellow-800'
    case 'open':
      return 'bg-blue-100 text-blue-800'
    case 'processing':
      return 'bg-purple-100 text-purple-800'
    case 'invoice':
      return 'bg-violet-100 text-violet-800'
    case 'in-transit':
      return 'bg-indigo-100 text-indigo-800'
    case 'delivered':
      return 'bg-green-100 text-green-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

export default function AdminDashboard() {
  const { user } = useAuthStore()
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null)
  const [salesData, setSalesData] = useState<SalesData[]>([])
  const [activeOrders, setActiveOrders] = useState<any[]>([])
  const [ordersTotal, setOrdersTotal] = useState(0)
  const [ordersPage, setOrdersPage] = useState(1)
  const pageSize = 10
  const [trendingSectors, setTrendingSectors] = useState<any[]>([])
  const [lowInventory, setLowInventory] = useState<any[]>([])
  const [complianceAlerts, setComplianceAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboardData()
  }, [ordersPage])

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      
      // Load KPIs
      const kpisRes = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getDashboardKPIs', adminEmail: user?.email || '' })
      })
      const kpisData = await kpisRes.json()
      if (kpisData.ok) {
        setKpis(kpisData)
      }

      // Load Sales Graph
      const salesRes = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getSalesRevenueGraph', period: 'daily', adminEmail: user?.email || '' })
      })
      const salesData = await salesRes.json()
      if (salesData.ok) {
        setSalesData(salesData.data || [])
      }

      // Load Active Orders
      await loadActiveOrders(ordersPage)

      // Load Trending Sectors
      const sectorsRes = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getTrendingSectors', adminEmail: user?.email || '' })
      })
      const sectorsData = await sectorsRes.json()
      if (sectorsData.ok) {
        setTrendingSectors(sectorsData.sectors || [])
      }

      // Load Low Inventory
      const inventoryRes = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getLowInventoryAlerts', threshold: 10, adminEmail: user?.email || '' })
      })
      const inventoryData = await inventoryRes.json()
      if (inventoryData.ok) {
        setLowInventory(inventoryData.alerts || [])
      }

      // Load Compliance Alerts
      const complianceRes = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getComplianceAlerts', adminEmail: user?.email || '' })
      })
      const complianceData = await complianceRes.json()
      if (complianceData.ok) {
        setComplianceAlerts(complianceData.alerts || [])
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadActiveOrders = async (page: number) => {
    const ordersRes = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'getActiveOrders', adminEmail: user?.email || '', page, pageSize })
    })
    const ordersData = await ordersRes.json()
    if (ordersData.ok) {
      setActiveOrders(ordersData.orders || [])
      setOrdersTotal(ordersData.totalCount || 0)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-RW', {
      style: 'currency',
      currency: 'RWF',
      minimumFractionDigits: 0,
    }).format(amount)
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {kpis ? formatCurrency(kpis.totalRevenue) : '0'}
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
                {kpis ? formatCurrency(kpis.platformCommission) : '0'}
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
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {kpis?.totalOrders || 0}
              </p>
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
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {kpis?.activeSellers || 0}
              </p>
              <p className="text-xs text-orange-500 mt-1">
                {kpis?.pendingSellers || 0} pending
              </p>
            </div>
            <div className="p-3 bg-orange-100 rounded-full">
              <Users className="text-orange-600" size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Sales & Revenue Graph */}
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

        {/* Trending Sectors */}
        <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Trending Sectors</h2>
          <div className="h-[260px] w-full min-w-0 sm:h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trendingSectors}>
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

      {/* Alerts and Active Orders Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Low Inventory Alerts */}
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Low Inventory Alerts</h2>
            <AlertCircle className="text-orange-500" size={20} />
          </div>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {lowInventory.length === 0 ? (
              <p className="text-gray-500 text-sm">No low inventory alerts</p>
            ) : (
              lowInventory.slice(0, 10).map((alert: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                  <div>
                    <p className="font-medium text-sm text-gray-900">{alert.itemName}</p>
                    <p className="text-xs text-gray-600">{alert.sellerName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-orange-600">{alert.quantity}</p>
                    <p className="text-xs text-gray-500">units left</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Compliance Alerts */}
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Compliance Alerts</h2>
            <FileText className="text-red-500" size={20} />
          </div>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {complianceAlerts.length === 0 ? (
              <p className="text-gray-500 text-sm">No compliance alerts</p>
            ) : (
              complianceAlerts.map((alert: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                  <div>
                    <p className="font-medium text-sm text-gray-900">{alert.sellerName}</p>
                    <p className="text-xs text-red-600">{alert.issue}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Active Orders Monitor */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Active Orders Monitor</h2>
          <Package className="text-blue-500 shrink-0" size={20} />
        </div>
        <ResponsiveTable className="rounded-md border border-slate-100" minWidth="720px">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Order #</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Seller</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Buyer</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Amount</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Time</th>
              </tr>
            </thead>
            <tbody>
              {activeOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500">
                    No active orders
                  </td>
                </tr>
              ) : (
                activeOrders.map((order: any) => (
                  (() => {
                    const normalizedStatus = mapBackendOrderStatusToTrack(order.status, order.paymentStatus)
                    return (
                  <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm text-gray-900">{order.orderNumber || `#${order.id}`}</td>
                    <td className="py-3 px-4 text-sm text-gray-700">{order.sellerName}</td>
                    <td className="py-3 px-4 text-sm text-gray-700">{order.buyerName}</td>
                    <td className="py-3 px-4 text-sm font-medium text-gray-900">
                      {formatCurrency(order.amount)}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(normalizedStatus)}`}>
                        {getStatusLabel(normalizedStatus)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-500">
                      {new Date(order.timestamp).toLocaleString()}
                    </td>
                  </tr>
                    )
                  })()
                ))
              )}
            </tbody>
          </table>
        </ResponsiveTable>
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
