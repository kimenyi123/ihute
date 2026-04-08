"use client"

import { useState, useEffect } from 'react'
import { DollarSign, TrendingUp, Settings } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface CommissionSettings {
  platformFee: number
  platformFeePercent: number
  description: string
}

interface CommissionReport {
  date: string
  orderCount: number
  totalRevenue: number
  platformCommission: number
}

export default function CommissionPage() {
  const [settings, setSettings] = useState<CommissionSettings | null>(null)
  const [report, setReport] = useState<CommissionReport[]>([])
  const [period, setPeriod] = useState('monthly')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [period])

  const loadData = async () => {
    try {
      setLoading(true)
      
      // Load settings
      const settingsRes = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getCommissionSettings' })
      })
      const settingsData = await settingsRes.json()
      if (settingsData.ok) {
        setSettings(settingsData.settings)
      }

      // Load report
      const reportRes = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getCommissionReport', period })
      })
      const reportData = await reportRes.json()
      if (reportData.ok) {
        setReport(reportData.data || [])
      }
    } catch (error) {
      console.error('Error loading commission data:', error)
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
        <div className="text-gray-500">Loading commission data...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Commission & Billing</h1>
        <p className="text-gray-600 mt-1">Manage platform commission settings and view reports</p>
      </div>

      {/* Commission Settings */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-3 mb-4">
          <Settings className="text-blue-600" size={24} />
          <h2 className="text-xl font-semibold text-gray-900">Platform Commission Settings</h2>
        </div>
        {settings && (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
              <div>
                <p className="text-sm text-gray-600">Platform Fee Rate</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {settings.platformFeePercent}%
                </p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <DollarSign className="text-blue-600" size={24} />
              </div>
            </div>
            <p className="text-sm text-gray-600">{settings.description}</p>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              Update Settings
            </button>
          </div>
        )}
      </div>

      {/* Commission Report */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <TrendingUp className="text-green-600" size={24} />
            <h2 className="text-xl font-semibold text-gray-900">Commission Report</h2>
          </div>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={report}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="totalRevenue" stroke="#3b82f6" name="Total Revenue" />
            <Line type="monotone" dataKey="platformCommission" stroke="#10b981" name="Platform Commission" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Summary Table */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Commission Summary</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Date</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Orders</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Revenue</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Commission</th>
              </tr>
            </thead>
            <tbody>
              {report.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-gray-500">
                    No commission data available
                  </td>
                </tr>
              ) : (
                report.map((row, idx) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm text-gray-900">{row.date}</td>
                    <td className="py-3 px-4 text-sm text-gray-700">{row.orderCount}</td>
                    <td className="py-3 px-4 text-sm font-medium text-gray-900">
                      {formatCurrency(row.totalRevenue)}
                    </td>
                    <td className="py-3 px-4 text-sm font-medium text-green-600">
                      {formatCurrency(row.platformCommission)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}


