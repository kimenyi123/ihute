"use client"

import { useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

/** Full order management UI lives under `/supplier/orders/[orderId]`; keep `/seller/orders/...` working for the seller panel. */
export default function SellerOrderDetailRedirect() {
  const params = useParams()
  const router = useRouter()
  const orderId = params.orderId as string

  useEffect(() => {
    if (orderId) router.replace(`/supplier/orders/${orderId}`)
  }, [orderId, router])

  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] text-muted-foreground gap-2">
      <Loader2 className="h-6 w-6 animate-spin" />
      <p className="text-sm">Opening order…</p>
    </div>
  )
}
