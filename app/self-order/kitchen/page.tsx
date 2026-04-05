"use client"

import { useSearchParams } from "next/navigation"
import { KioskKitchenDashboard } from "@/src/modules/self-order/components/KioskKitchenDashboard"

export default function SelfOrderKitchenPage() {
  const searchParams = useSearchParams()
  const sellerAccount = searchParams.get("sellerAccount") || undefined
  const kioskCategory = searchParams.get("kioskCategory") || undefined
  const locationId = searchParams.get("locationId") || undefined

  // Require at least one filter — either seller account or kiosk category
  if (!sellerAccount && !kioskCategory && !locationId) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
        <div className="text-center space-y-3">
          <p className="text-sm text-slate-400">
            No filter provided. Open this screen with a query parameter:
          </p>
          <ul className="text-xs text-slate-500 space-y-1">
            <li><code>?kioskCategory=BAR</code> — show all bar orders</li>
            <li><code>?kioskCategory=RESTRO</code> — show all restaurant orders</li>
            <li><code>?kioskCategory=COFFEE_SHOP</code> — show coffee shop orders</li>
            <li><code>?sellerAccount=account_name</code> — filter by specific seller</li>
          </ul>
        </div>
      </div>
    )
  }

  return (
    <KioskKitchenDashboard
      sellerAccount={sellerAccount}
      kioskCategory={kioskCategory}
      locationId={locationId}
    />
  )
}
