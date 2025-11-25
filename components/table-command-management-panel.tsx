"use client"

/**
 * ✅ TABLE COMMAND MANAGEMENT PANEL
 *
 * Complete UI for managing table commands with the correct 3-step workflow:
 * 1. ACTIVE → Create table, users join, add orders
 * 2. SENT → Send complete table order (this button!)
 * 3. CLOSED → Close table
 *
 * @author Gilbert (2025-11-21)
 */

import { useState, useEffect } from "react"
import { Users, Send, XCircle, CheckCircle, AlertCircle, Clock } from "lucide-react"
import { SendTableButton } from "./table-command-send-button"

interface TableInfo {
  tableName: string
  locationId: string
  locationName: string
  status: "ACTIVE" | "SENT" | "CLOSED"
  createdBy: string
  lastSentBy: string | null
  createdAt: string
  participantCount: number
  totalOrders: number
  totalAmount: number
}

interface Props {
  userEmail: string
  userName: string
  locationId: string
  locationName: string
}

export function TableCommandManagementPanel({ userEmail, userName, locationId, locationName }: Props) {
  const [tables, setTables] = useState<TableInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://ihute.rw/Trading"

  // Fetch active/sent tables
  const fetchTables = async () => {
    try {
      const url = new URL(`${API_BASE}/OrdersServlet`)
      url.searchParams.set("action", "getActiveTables")
      url.searchParams.set("locationId", locationId)

      const response = await fetch(url.toString())
      const result = await response.json()

      if (result.ok) {
        setTables(result.tables || [])
      } else {
        setError(result.error || "Failed to fetch tables")
      }
    } catch (err: any) {
      console.error("Error fetching tables:", err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTables()
    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchTables, 10000)
    return () => clearInterval(interval)
  }, [locationId])

  const handleCloseTable = async (tableName: string) => {
    if (!confirm(`Are you sure you want to close table "${tableName}"? This action cannot be undone.`)) {
      return
    }

    try {
      const url = new URL(`${API_BASE}/OrdersServlet`)
      url.searchParams.set("action", "closeTable")
      url.searchParams.set("tableName", tableName)
      url.searchParams.set("locationId", locationId)
      url.searchParams.set("userEmail", userEmail)

      const response = await fetch(url.toString(), { method: "POST" })
      const result = await response.json()

      if (result.ok) {
        alert(`✅ Table "${tableName}" closed successfully!`)
        fetchTables() // Refresh list
      } else {
        alert(`❌ Error: ${result.error || "Failed to close table"}`)
      }
    } catch (err: any) {
      alert(`❌ Error: ${err.message}`)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex items-center gap-2 text-gray-600">
          <Clock className="h-5 w-5 animate-spin" />
          <span>Loading tables...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-red-700">
          <AlertCircle className="h-5 w-5" />
          <span>Error: {error}</span>
        </div>
      </div>
    )
  }

  if (tables.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <Users className="h-12 w-12 text-gray-400 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-gray-700 mb-1">No Active Tables</h3>
        <p className="text-sm text-gray-600">
          Create a new table to start group ordering!
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">Active Tables at {locationName}</h2>
        <button
          onClick={fetchTables}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          🔄 Refresh
        </button>
      </div>

      {tables.map((table) => {
        const isCreator = table.createdBy === userEmail
        const isLastSender = table.lastSentBy === userEmail
        const canClose = (isCreator || isLastSender) && table.status === "SENT"

        return (
          <div
            key={table.tableName}
            className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-600" />
                  {table.tableName}
                </h3>
                <p className="text-sm text-gray-600">
                  {table.participantCount} participant{table.participantCount !== 1 ? 's' : ''} • {table.totalOrders} order{table.totalOrders !== 1 ? 's' : ''}
                </p>
              </div>
              <StatusBadge status={table.status} />
            </div>

            {/* Details */}
            <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
              <div>
                <span className="text-gray-600">Created by:</span>
                <p className="font-medium text-gray-900">
                  {isCreator ? "You" : table.createdBy}
                </p>
              </div>
              <div>
                <span className="text-gray-600">Created at:</span>
                <p className="font-medium text-gray-900">{table.createdAt}</p>
              </div>
              <div>
                <span className="text-gray-600">Total amount:</span>
                <p className="font-bold text-green-600">
                  {table.totalAmount.toLocaleString()} RWF
                </p>
              </div>
              {table.lastSentBy && (
                <div>
                  <span className="text-gray-600">Sent by:</span>
                  <p className="font-medium text-gray-900">
                    {isLastSender ? "You" : table.lastSentBy}
                  </p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
              {/* ✅ SEND TABLE ORDER BUTTON (ACTIVE tables, creators only) */}
              {table.status === "ACTIVE" && isCreator && (
                <SendTableButton
                  tableName={table.tableName}
                  locationId={locationId}
                  userEmail={userEmail}
                  userName={userName}
                  isCreator={isCreator}
                  tableStatus={table.status}
                  onSuccess={fetchTables}
                />
              )}

              {/* ✅ CLOSE TABLE BUTTON (SENT tables, creator/sender only) */}
              {table.status === "SENT" && canClose && (
                <button
                  onClick={() => handleCloseTable(table.tableName)}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                >
                  <XCircle className="h-4 w-4" />
                  <span>Close Table</span>
                </button>
              )}

              {/* Status Messages */}
              {table.status === "ACTIVE" && !isCreator && (
                <div className="flex items-center gap-2 text-sm text-gray-600 px-3 py-2 bg-gray-50 rounded-lg">
                  <AlertCircle className="h-4 w-4" />
                  <span>Waiting for creator to send order...</span>
                </div>
              )}

              {table.status === "SENT" && !canClose && (
                <div className="flex items-center gap-2 text-sm text-orange-600 px-3 py-2 bg-orange-50 rounded-lg">
                  <AlertCircle className="h-4 w-4" />
                  <span>Only creator or sender can close this table</span>
                </div>
              )}

              {table.status === "CLOSED" && (
                <div className="flex items-center gap-2 text-sm text-green-600 px-3 py-2 bg-green-50 rounded-lg">
                  <CheckCircle className="h-4 w-4" />
                  <span>Table closed</span>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function StatusBadge({ status }: { status: "ACTIVE" | "SENT" | "CLOSED" }) {
  const styles = {
    ACTIVE: "bg-green-100 text-green-800 border-green-200",
    SENT: "bg-orange-100 text-orange-800 border-orange-200",
    CLOSED: "bg-gray-100 text-gray-800 border-gray-200",
  }

  const icons = {
    ACTIVE: <Users className="h-3.5 w-3.5" />,
    SENT: <Send className="h-3.5 w-3.5" />,
    CLOSED: <CheckCircle className="h-3.5 w-3.5" />,
  }

  return (
    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border font-medium text-xs ${styles[status]}`}>
      {icons[status]}
      <span>{status}</span>
    </div>
  )
}

/**
 * ✅ USAGE IN YOUR PAGE:
 *
 * import { TableCommandManagementPanel } from "@/components/table-command-management-panel"
 *
 * export default function MyPage() {
 *   return (
 *     <TableCommandManagementPanel
 *       userEmail="user@example.com"
 *       userName="John Doe"
 *       locationId="ALGGG0942009"
 *       locationName="Pangolin's Burrows"
 *     />
 *   )
 * }
 */
