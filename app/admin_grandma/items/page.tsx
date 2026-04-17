"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

type Pending = {
  id: number
  created_at: string
  kind: string | null
  shopName: string | null
  itemName: string | null
  totalRwf: number | null
}

export default function AdminGrandmaItemsPage() {
  const [pending, setPending] = useState<Pending[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch("/api/admin/grandma/pending-drafts", { cache: "no-store" })
        const j = (await res.json()) as {
          ok: boolean
          pending?: Pending[]
          message?: string
          error?: string
        }
        if (cancelled) return
        if (j.message) setMessage(j.message)
        if (j.error) setError(j.error)
        setPending(Array.isArray(j.pending) ? j.pending : [])
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Load failed")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin_grandma" className="text-sm text-zinc-500 hover:text-zinc-300">
          ← Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-white">Items · pending validation</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Umuriro rows from <code className="text-zinc-300">shop_onboarding_draft</code> (kind = umuriro). Approve/reject
          actions can be added next.
        </p>
      </div>

      {message ? (
        <div className="rounded-lg border border-amber-900/60 bg-amber-950/40 px-4 py-3 text-sm text-amber-200">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-lg border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="border-b border-zinc-800 bg-zinc-900/80 text-zinc-400">
            <tr>
              <th className="px-4 py-3 font-medium">Draft ID</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium">Shop</th>
              <th className="px-4 py-3 font-medium">Item</th>
              <th className="px-4 py-3 font-medium">Total RWF</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {pending.map((p) => (
              <tr key={p.id} className="hover:bg-zinc-900/40">
                <td className="px-4 py-3 tabular-nums text-zinc-300">{p.id}</td>
                <td className="px-4 py-3 text-zinc-400">{p.created_at}</td>
                <td className="max-w-[200px] px-4 py-3 text-zinc-300">{p.shopName ?? "—"}</td>
                <td className="max-w-[200px] px-4 py-3 text-zinc-300">{p.itemName ?? "—"}</td>
                <td className="px-4 py-3 tabular-nums text-zinc-300">
                  {p.totalRwf != null ? p.totalRwf.toLocaleString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {pending.length === 0 && !message && !error ? (
          <p className="px-4 py-8 text-center text-sm text-zinc-500">No Umuriro drafts found.</p>
        ) : null}
      </div>
    </div>
  )
}
