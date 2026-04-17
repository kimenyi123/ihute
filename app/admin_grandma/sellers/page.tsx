"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

type SellerRow = {
  id: number
  ishyiga_account: string
  email: string
  owner: string | null
  tel: string
  status: string
  profileCompletion: number
  created_at?: string
}

export default function AdminGrandmaSellersPage() {
  const [sellers, setSellers] = useState<SellerRow[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch("/api/admin/grandma/sellers", { cache: "no-store" })
        const j = (await res.json()) as {
          ok: boolean
          sellers?: SellerRow[]
          message?: string
          error?: string
        }
        if (cancelled) return
        if (j.message) setMessage(j.message)
        if (j.error) setError(j.error)
        setSellers(Array.isArray(j.sellers) ? j.sellers : [])
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link href="/admin_grandma" className="text-sm text-zinc-500 hover:text-zinc-300">
            ← Dashboard
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-white">Sellers</h1>
          <p className="mt-1 text-sm text-zinc-400">Profile completion from key fields in account_seller.</p>
        </div>
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
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-zinc-800 bg-zinc-900/80 text-zinc-400">
            <tr>
              <th className="px-4 py-3 font-medium">ID</th>
              <th className="px-4 py-3 font-medium">Account</th>
              <th className="px-4 py-3 font-medium">Owner</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Profile</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {sellers.map((s) => (
              <tr key={s.id} className="hover:bg-zinc-900/40">
                <td className="px-4 py-3 tabular-nums text-zinc-300">{s.id}</td>
                <td className="max-w-[200px] px-4 py-3">
                  <div className="truncate font-mono text-xs text-zinc-400">{s.ishyiga_account}</div>
                  <div className="truncate text-zinc-300">{s.email}</div>
                </td>
                <td className="max-w-[180px] px-4 py-3 text-zinc-300">{s.owner ?? "—"}</td>
                <td className="px-4 py-3 text-zinc-400">{s.status}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-24 overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className="h-full rounded-full bg-emerald-600 transition-all"
                        style={{ width: `${Math.min(100, Math.max(0, s.profileCompletion))}%` }}
                      />
                    </div>
                    <span className="tabular-nums text-zinc-300">{s.profileCompletion}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sellers.length === 0 && !message && !error ? (
          <p className="px-4 py-8 text-center text-sm text-zinc-500">No rows loaded.</p>
        ) : null}
      </div>
    </div>
  )
}
