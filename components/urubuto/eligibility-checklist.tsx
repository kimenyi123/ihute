"use client"

import { CheckCircle2, XCircle } from "lucide-react"
import type { UrubutoChecklistItem } from "@/lib/urubuto-pipeline"

export function EligibilityChecklist({
  items,
  showFixedBy = false,
}: {
  items: UrubutoChecklistItem[]
  showFixedBy?: boolean
}) {
  if (!items?.length) return null
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.key} className="flex items-start gap-2 text-sm">
          {item.ok ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
          ) : (
            <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          )}
          <div>
            <span className={item.ok ? "text-gray-800" : "text-gray-900 font-medium"}>{item.label}</span>
            {showFixedBy && item.fixedBy && (
              <span className="ml-2 text-xs text-gray-500">({item.fixedBy})</span>
            )}
            {!item.ok && item.rejectionReason && (
              <p className="text-xs text-red-700 mt-0.5">Reason: {item.rejectionReason}</p>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
