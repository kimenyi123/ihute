"use client"

/**
 * ✅ TABLE COMMAND: Send Complete Order Button
 *
 * This button sends ALL orders from the table to the kitchen/seller.
 * It creates a MASTER ORDER that aggregates all individual orders.
 *
 * CRITICAL WORKFLOW:
 * 1. ACTIVE → Users join and add orders
 * 2. SENT → Creator clicks this button → Master order created
 * 3. CLOSED → Creator/Sender can close table
 *
 * @author Gilbert (2025-11-21)
 */

import { useState } from "react"
import { Send, AlertCircle, CheckCircle, Users } from "lucide-react"

interface SendTableButtonProps {
  tableName: string
  locationId: string
  userEmail: string
  userName?: string
  isCreator: boolean
  tableStatus: "ACTIVE" | "SENT" | "CLOSED"
  onSuccess?: () => void
}

export function SendTableButton({
  tableName,
  locationId,
  userEmail,
  userName,
  isCreator,
  tableStatus,
  onSuccess
}: SendTableButtonProps) {
  const [showDialog, setShowDialog] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<any>(null)

  // Only show for ACTIVE tables and table creator
  if (!isCreator || tableStatus !== "ACTIVE") {
    return null
  }

  const handleSendTableOrder = async () => {
    setSending(true)
    setError(null)
    setSuccess(null)

    try {
      // Use Next.js API route (same origin) to avoid CORS
      const response = await fetch("/api/table-commands/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableName, locationId, userEmail }),
      })

      const result = await response.json()

      console.log("📥 Response:", result)

      if (!result.ok) {
        throw new Error(result.error || "Failed to send table order")
      }

      // ✅ SUCCESS!
      setSuccess(result)
      setError(null)

      // Auto-close dialog after 3 seconds and refresh
      setTimeout(() => {
        setShowDialog(false)
        if (onSuccess) {
          onSuccess()
        } else {
          window.location.reload()
        }
      }, 3000)

    } catch (err: any) {
      console.error("❌ Error sending table order:", err)
      setError(err.message || "Failed to send table order. Please try again.")
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      {/* ✅ SEND ORDER BUTTON */}
      <button
        onClick={() => setShowDialog(true)}
        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors shadow-sm"
      >
        <Send className="h-4 w-4" />
        <span>Send Complete Table Order</span>
      </button>

      {/* ✅ CONFIRMATION DIALOG */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <Send className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Send Complete Table Order?
                </h3>
                <p className="text-sm text-gray-600">
                  Table: <span className="font-mono font-medium">{tableName}</span>
                </p>
              </div>
            </div>

            {/* Success State */}
            {success && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-semibold text-green-900 mb-2">
                      ✅ Table order sent successfully!
                    </h4>
                    <div className="text-sm text-green-800 space-y-1">
                      <p>• Master Order ID: <span className="font-mono">{success.masterOrderId}</span></p>
                      <p>• Child Orders: {success.childOrderCount}</p>
                      <p>• Total Amount: {success.totalAmount.toLocaleString()} RWF</p>
                      <p>• Sent By: {success.sentBy}</p>
                    </div>
                    <p className="text-xs text-green-700 mt-3">
                      🔒 Table is now locked (SENT status). Refreshing...
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Error State */}
            {error && !success && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-red-900 mb-1">Error</h4>
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Explanation */}
            {!success && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <h4 className="font-medium text-blue-900 mb-2">What happens next:</h4>
                <ul className="text-sm text-blue-800 space-y-1.5">
                  <li className="flex items-start gap-2">
                    <Users className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <span>All individual orders will be combined into ONE master order</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600">🔒</span>
                    <span>Table will be locked - no one else can join</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600">📨</span>
                    <span>Kitchen/seller receives the complete aggregated order</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600">📊</span>
                    <span>Stock will be decremented for all items</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600">✅</span>
                    <span>You can close the table after sending</span>
                  </li>
                </ul>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowDialog(false)}
                disabled={sending || !!success}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleSendTableOrder}
                disabled={sending || !!success}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? "Sending..." : success ? "Sent ✓" : "Send Order"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/**
 * ✅ USAGE EXAMPLE:
 *
 * import { SendTableButton } from "@/components/table-command-send-button"
 *
 * <SendTableButton
 *   tableName="LAGOSTA"
 *   locationId="ALGGG0942009"
 *   userEmail="user@example.com"
 *   userName="John Doe"
 *   isCreator={true}
 *   tableStatus="ACTIVE"
 *   onSuccess={() => {
 *     console.log("Table order sent!")
 *     window.location.reload()
 *   }}
 * />
 */
