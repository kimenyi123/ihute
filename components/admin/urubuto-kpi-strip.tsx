"use client"

import { useEffect, useState } from "react"
import { postAdminApi } from "@/lib/admin-client"

export function UrubutoKpiStrip() {
  const [kpis, setKpis] = useState<Record<string, number> | null>(null)

  useEffect(() => {
    void postAdminApi({ action: "getUrubutoMerchantKpis" })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && d.kpis) setKpis(d.kpis)
      })
      .catch(() => {})
  }, [])

  if (!kpis) return null

  const items = [
    { label: "Pending", value: kpis.pendingApplications },
    { label: "Live merchants", value: kpis.activeMerchants },
    { label: "With Urubuto codes", value: kpis.withUrubutoCode },
    { label: "Payments (7d)", value: kpis.paymentsLast7Days },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
      {items.map((k) => (
        <div key={k.label} className="rounded-lg border bg-white px-4 py-3 shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide">{k.label}</p>
          <p className="text-2xl font-semibold text-gray-900">{k.value ?? 0}</p>
        </div>
      ))}
    </div>
  )
}
