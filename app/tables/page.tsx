"use client"

/**
 * ✅ TABLE COMMANDS PAGE - FIXED for Anonymous Users
 *
 * Works with both logged-in users AND anonymous/guest users.
 * Anonymous users can create and manage table commands using guest email.
 *
 * Route: /tables
 *
 * @author Gilbert (2025-11-21)
 */

import { TableCommandManagementPanel } from "@/components/table-command-management-panel"
import { useEffect, useState } from "react"
import { Users, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useAuthStore } from "@/lib/auth-store"

export default function TablesPage() {
  const { user, isAuthenticated } = useAuthStore()
  const [selectedLocation, setSelectedLocation] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [guestEmail, setGuestEmail] = useState<string>("")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)

    // Get current location/supplier from localStorage or context
    const locationData = localStorage.getItem("currentLocation")
    if (locationData) {
      try {
        const parsedLocation = JSON.parse(locationData)
        setSelectedLocation(parsedLocation)
      } catch (e) {
        console.error("Error parsing location data:", e)
      }
    }

    // Check for guest email in localStorage (from table command session)
    const tableCommandSession = localStorage.getItem("tableCommandSession")
    if (tableCommandSession) {
      try {
        const session = JSON.parse(tableCommandSession)
        if (session.userEmail) {
          setGuestEmail(session.userEmail)
        }
      } catch (e) {
        console.error("Error parsing table session:", e)
      }
    }

    // Generate guest email if needed (only on client side)
    if (!user?.email && !guestEmail) {
      const generatedEmail = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}@ihute.rw`
      setGuestEmail(generatedEmail)
    }

    setLoading(false)
  }, [user?.email, guestEmail])

  // ✅ Prevent hydration mismatch by waiting for client-side mount
  if (!mounted || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4 animate-pulse" />
          <p className="text-gray-600">Loading tables...</p>
        </div>
      </div>
    )
  }

  // ✅ FIXED: Support both authenticated AND anonymous users (no Date.now() here)
  const userEmail = user?.email || guestEmail || "guest@ihute.rw"
  const userName = user?.name || "Guest User"
  const locationId = selectedLocation?.ishyigaAccount || selectedLocation?.id || "ALGGG0942009"
  const locationName = selectedLocation?.businessName || selectedLocation?.name || "Current Location"

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </Link>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Users className="h-6 w-6 text-blue-600" />
                Table Commands
              </h1>
              <p className="text-sm text-gray-600">
                Manage group orders for {locationName}
              </p>
            </div>
            {/* User Info */}
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-gray-900">{userName}</p>
              <p className="text-xs text-gray-500">{userEmail}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Anonymous User Notice */}
        {!isAuthenticated && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <Users className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-amber-900 mb-1">
                  Browsing as Guest
                </h3>
                <p className="text-sm text-amber-800">
                  You're using table commands as a guest user. Your email: <span className="font-mono font-medium">{userEmail}</span>
                </p>
                <p className="text-xs text-amber-700 mt-2">
                  💡 Tip: <Link href="/login" className="underline hover:text-amber-900">Login</Link> to save your orders and view history.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Info Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-blue-900 mb-2">
            How Table Commands Work
          </h3>
          <div className="text-sm text-blue-800 space-y-1">
            <p>• <strong>Create a table:</strong> Start a group order and invite others</p>
            <p>• <strong>Others join:</strong> Multiple people can add their orders</p>
            <p>• <strong>Send order:</strong> Creator sends all orders as one master order</p>
            <p>• <strong>Close table:</strong> After delivery, close the table</p>
          </div>
        </div>

        {/* ✅ Table Management Panel - Now works for all users */}
        <TableCommandManagementPanel
          userEmail={userEmail}
          userName={userName}
          locationId={locationId}
          locationName={locationName}
        />

        {/* Help Section */}
        <div className="mt-8 bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Need Help?
          </h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-700">
            <div>
              <h4 className="font-medium text-gray-900 mb-2">
                🟢 ACTIVE Status
              </h4>
              <p>
                Table is open. Users can join and add orders.
                <strong className="block mt-1">
                  Creator can "Send Table Order" to lock the table.
                </strong>
              </p>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-2">
                🟠 SENT Status
              </h4>
              <p>
                Table is locked. Master order sent to kitchen.
                <strong className="block mt-1">
                  Creator/Sender can "Close Table" when done.
                </strong>
              </p>
            </div>
          </div>

          {/* Debug Info (remove in production) */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h4 className="font-medium text-gray-700 mb-2 text-xs">Debug Info:</h4>
            <div className="bg-gray-50 rounded p-3 text-xs font-mono space-y-1">
              <p>User Email: {userEmail}</p>
              <p>Location ID: {locationId}</p>
              <p>Is Authenticated: {isAuthenticated ? "Yes" : "No (Guest)"}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
