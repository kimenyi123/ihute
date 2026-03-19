"use client"

import { useSearchParams } from "next/navigation"
import { KioskStatusPage } from "@/src/modules/self-order/components/KioskStatusPage"

export default function SelfOrderStatusPage() {
  const searchParams = useSearchParams()
  const orderId = searchParams.get("orderId") || ""

  if (!orderId) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-400">
          Missing order identifier. Please ask staff for help.
        </p>
      </div>
    )
  }

  return <KioskStatusPage orderId={orderId} />
}

