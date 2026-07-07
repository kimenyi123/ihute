"use client"

import { useState, useEffect } from 'react'
import { Filter, Eye } from 'lucide-react'
import { postAdminApi } from '@/lib/admin-client'
import Link from 'next/link'
import { mapBackendOrderStatusToTrack, type TrackOrderStatus } from '@/lib/order-status-map'
import { downloadExcel } from '@/lib/grandma-excel-export'

interface Order {
  id: number
  orderNumber: string
  sellerName: string
  buyerName: string
  amount: number
  status: string
  paymentStatus: string
  paymentName: string
  timestamp: string
  deliveryLocation: string
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

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    sector: '',
    sellerAccount: '',
    status: '',
  })
  const [sectors, setSectors] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const pageSize = 20

  useEffect(() => {
    loadSectors()
  }, [])

  useEffect(() => {
    void loadOrders(page)
  }, [filters, page])

  const updateFilters = (nextFilters: Partial<typeof filters>) => {
    setFilters((current) => ({ ...current, ...nextFilters }))
    setPage(1)
  }

  const loadSectors = async () => {
    try {
      const res = await postAdminApi({ action: 'getSectors' })
      const data = await res.json()
      
      if (data.ok) {
        setSectors((data.sectors || []).map((s: any) => s.name))
      }
    } catch (error) {
      console.error('Error loading sectors:', error)
    }
  }

  const loadOrders = async (pageArg: number = page) => {
    try {
      setLoading(true)
      const res = await postAdminApi({
        action: 'getAllOrders',
        ...filters,
        limit: pageSize,
        page: pageArg,
      })
      const data = await res.json()

      if (data.ok) {
        setOrders(data.orders || [])
        const count = Number(data.totalCount ?? data.totalOrders ?? 0) || 0
        setTotalCount(count)
        setTotalPages(count > 0 ? Math.max(1, Math.ceil(count / pageSize)) : 1)
      }
    } catch (error) {
      console.error('Error loading orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    const n = new Intl.NumberFormat('en-RW', { minimumFractionDigits: 0 }).format(amount)
    return `RWF ${n}`
  }

  const exportToExcel = () => {
    const rows = orders.map((order) => {
      const normalizedStatus = mapBackendOrderStatusToTrack(order.status, order.paymentStatus)
      return {
        'Order #': order.orderNumber || `#${order.id}`,
        Seller: order.sellerName,
        Buyer: order.buyerName,
        Amount: order.amount,
        Status: getStatusLabel(normalizedStatus),
        'Payment status': order.paymentStatus || 'OPEN',
        Payment: order.paymentName,
        Time: new Date(order.timestamp).toLocaleString(),
        'Delivery location': order.deliveryLocation,
      }
    })
    const ok = downloadExcel(rows, 'Orders', 'admin_order_monitor')
    if (!ok) window.alert('No orders to export.')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Order Monitor</h1>
        <p className="text-gray-600 mt-1">Real-time order tracking and management</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter size={20} />
          <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
        </div>
        <div className="flex flex-col gap-4 md:flex-row md:items-end">
          <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sector</label>
            <select
              value={filters.sector}
              onChange={(e) => updateFilters({ sector: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">All Sectors</option>
              {sectors.map((sector) => (
                <option key={sector} value={sector}>{sector}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Seller Account</label>
            <input
              type="text"
              value={filters.sellerAccount}
              onChange={(e) => updateFilters({ sellerAccount: e.target.value })}
              placeholder="Enter seller account"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => updateFilters({ status: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">All Statuses</option>
              <option value="OPEN">Open</option>
              <option value="PENDING">Pending</option>
              <option value="PROCESSING">Processing</option>
              <option value="INVOICE">Invoice</option>
              <option value="IN-TRANSIT">Out for Delivery</option>
              <option value="DELIVERED">Delivered</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
          </div>
          <button
            type="button"
            disabled={loading || orders.length === 0}
            onClick={exportToExcel}
            className="inline-flex shrink-0 items-center justify-center rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Export to Excel
          </button>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500">Loading orders...</div>
        ) : orders.length === 0 ? (
          <div className="p-12 text-center text-gray-500">No orders found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order #</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Seller</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Buyer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {orders.map((order) => (
                  (() => {
                    const normalizedStatus = mapBackendOrderStatusToTrack(order.status, order.paymentStatus)
                    return (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {order.orderNumber || `#${order.id}`}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {order.sellerName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {order.buyerName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatCurrency(order.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(normalizedStatus)}`}>
                        {getStatusLabel(normalizedStatus)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          order.paymentStatus === 'PAID' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {order.paymentStatus || 'OPEN'}
                        </span>
                        <p className="text-xs text-gray-500 mt-1">{order.paymentName}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(order.timestamp).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="text-blue-600 hover:text-blue-900 inline-flex items-center gap-1"
                      >
                        <Eye size={16} />
                        View
                      </Link>
                    </td>
                  </tr>
                    )
                  })()
                ))}
              </tbody>
            </table>
            <div className="flex flex-col gap-3 border-t border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-gray-600">
                Showing {orders.length} orders of {totalCount.toLocaleString()} · Page {page} of {totalPages}
              </div>
              <div className="inline-flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1 || loading}
                  onClick={() => {
                    const prevPage = Math.max(1, page - 1)
                    setPage(prevPage)
                    void loadOrders(prevPage)
                  }}
                  className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages || loading}
                  onClick={() => {
                    const nextPage = Math.min(totalPages, page + 1)
                    setPage(nextPage)
                    void loadOrders(nextPage)
                  }}
                  className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
