"use client"

import { useState, useEffect } from 'react'
import { Users, ShoppingCart, DollarSign } from 'lucide-react'
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

export default function AnalyticsPage() {
  const [sectorPerformance, setSectorPerformance] = useState<any[]>([])
  const [sellerPerformance, setSellerPerformance] = useState<any[]>([])
  const [revenueReport, setRevenueReport] = useState<any[]>([])
  const [orderAnalytics, setOrderAnalytics] = useState<any>(null)
  const [customerInsights, setCustomerInsights] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAnalytics()
  }, [])

  const loadAnalytics = async () => {
    try {
      setLoading(true)
      
      // Load sector performance
      const sectorRes = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getSectorPerformance' })
      })
      const sectorData = await sectorRes.json()
      if (sectorData.ok) {
        setSectorPerformance(sectorData.sectors || [])
      }

      // Load seller performance
      const sellerRes = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getSellerPerformance' })
      })
      const sellerData = await sellerRes.json()
      if (sellerData.ok) {
        setSellerPerformance(sellerData.sellers || [])
      }

      // Load revenue report
      const revenueRes = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getRevenueReport', period: 'monthly' })
      })
      const revenueData = await revenueRes.json()
      if (revenueData.ok) {
        setRevenueReport(revenueData.data || [])
      }

      // Load order analytics
      const orderRes = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getOrderAnalytics' })
      })
      const orderData = await orderRes.json()
      if (orderData.ok) {
        setOrderAnalytics(orderData)
      }

      // Load customer insights
      const customerRes = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getCustomerInsights' })
      })
      const customerData = await customerRes.json()
      if (customerData.ok) {
        setCustomerInsights(customerData)
      }
    } catch (error) {
      console.error('Error loading analytics:', error)
    } finally {
      setLoading(false)
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
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading analytics...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Analytics & Reports</h1>
        <p className="text-gray-600 mt-1">Comprehensive platform analytics and insights</p>
      </div>

      {/* Customer Insights */}
      {customerInsights && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Customers</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {customerInsights.totalCustomers || 0}
                </p>
              </div>
              <Users className="text-blue-600" size={24} />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Repeat Customers</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {customerInsights.repeatCustomers || 0}
                </p>
              </div>
              <ShoppingCart className="text-green-600" size={24} />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg Order Value</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {formatCurrency(customerInsights.avgOrderValue || 0)}
                </p>
              </div>
              <DollarSign className="text-purple-600" size={24} />
            </div>
          </div>
        </div>
      )}

      {/* Sector Performance */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Sector Performance</h2>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={sectorPerformance}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="totalRevenue" fill="#3b82f6" name="Revenue" />
            <Bar dataKey="orderCount" fill="#10b981" name="Orders" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Revenue Report */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Revenue Trend</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={revenueReport}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="totalRevenue" stroke="#3b82f6" name="Revenue" />
            <Line type="monotone" dataKey="platformCommission" stroke="#10b981" name="Commission" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Order Status Breakdown */}
      {orderAnalytics && orderAnalytics.statusBreakdown && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Order Status Breakdown</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={Object.entries(orderAnalytics.statusBreakdown).map(([name, value]) => ({ name, value }))}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {Object.entries(orderAnalytics.statusBreakdown).map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top Sellers */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Top Performing Sellers</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Seller</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Orders</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Revenue</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Products</th>
              </tr>
            </thead>
            <tbody>
              {sellerPerformance.slice(0, 10).map((seller: any, idx: number) => (
                <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 text-sm text-gray-900">{seller.sellerName}</td>
                  <td className="py-3 px-4 text-sm text-gray-700">{seller.orderCount}</td>
                  <td className="py-3 px-4 text-sm font-medium text-gray-900">
                    {formatCurrency(seller.totalRevenue)}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-700">{seller.productCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}


