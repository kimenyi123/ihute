"use client"

import { useEffect, useState } from "react"

type OrderStatus = "open" | "pending" | "processing" | "invoice" | "in-transit" | "delivered"

type Props = {
  estimatedAt: string
  status: OrderStatus
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return "Any moment"
  const totalMinutes = Math.floor(ms / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours > 0) return `~${hours}h ${minutes}m`
  return `~${minutes} min`
}

export function DeliveryCountdown({ estimatedAt, status }: Props) {
  const [remaining, setRemaining] = useState<number | null>(null)

  useEffect(() => {
    const target = new Date(estimatedAt).getTime()
    const tick = () => {
      const now = Date.now()
      setRemaining(target - now)
    }
    tick()
    const id = setInterval(tick, 60000)
    return () => clearInterval(id)
  }, [estimatedAt])

  if (status === "delivered") {
    return <p className="text-sm text-green-600 font-medium">Delivered</p>
  }

  if (remaining === null) {
    return (
      <p className="text-sm text-slate-600">
        By {new Date(estimatedAt).toLocaleString()}
      </p>
    )
  }

  if (remaining <= 0) {
    return (
      <p className="text-sm text-blue-600 font-medium">
        Estimated time passed — delivery may be soon. Contact seller if needed.
      </p>
    )
  }

  return (
    <p className="text-sm text-slate-700">
      <span className="font-medium">{formatRemaining(remaining)}</span>
      {" "}remaining · by {new Date(estimatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
    </p>
  )
}
