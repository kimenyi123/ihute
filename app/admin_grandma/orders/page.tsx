"use client"

import Link from "next/link"
import { GrandmaOrdersTable } from "@/components/admin/grandma-orders-table"

export default function AdminGrandmaOrdersPage() {
  return (
    <div className="space-y-4">
      <Link href="/admin_grandma" className="text-sm text-zinc-500 hover:text-zinc-300">
        ← Dashboard
      </Link>
      <div>
        <h1 className="text-2xl font-bold text-white">Grandma orders</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Orders placed from Grandma only (<code className="text-zinc-300">ORDER_SOURCE = GRANDMA</code>). Marketplace
          Order Monitor rows are excluded.
        </p>
      </div>
      <GrandmaOrdersTable tone="dark" />
    </div>
  )
}
