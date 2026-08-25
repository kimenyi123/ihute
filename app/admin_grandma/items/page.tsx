"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"

type DraftRow = {
  id: number
  created_at: string
  kind: string | null
  shopName: string | null
  itemName: string | null
  totalRwf: number | null
  rid: string | null
  momo: string | null
}

function formatWhen(raw: string): string {
  if (!raw) return "—"
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  return d.toLocaleString()
}

export default function AdminGrandmaItemsPage() {
  const [pending, setPending] = useState<DraftRow[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch("/api/admin/grandma/pending-drafts", { cache: "no-store" })
        const j = (await res.json()) as {
          ok: boolean
          pending?: DraftRow[]
          message?: string
          error?: string
        }
        if (cancelled) return
        if (j.message) setMessage(j.message)
        if (j.error) setError(j.error)
        setPending(Array.isArray(j.pending) ? j.pending : [])
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Load failed")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return pending
    return pending.filter((p) =>
      [p.id, p.kind, p.shopName, p.itemName, p.rid, p.momo, p.totalRwf]
        .join(" ")
        .toLowerCase()
        .includes(q),
    )
  }, [pending, search])

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin_grandma" className="text-sm text-zinc-500 hover:text-zinc-300">
          ← Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-white">shop_onboarding_draft</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Live rows from <code className="text-zinc-300">shop_onboarding_draft</code> (Umuriro and other onboarding
          JSON).
        </p>
      </div>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search shop, item, kind, MoMo…"
        className="w-full max-w-md rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
        aria-label="Search onboarding drafts"
      />

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
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="border-b border-zinc-800 bg-zinc-900/80 text-zinc-400">
            <tr>
              <th className="px-4 py-3 font-medium">ID</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium">Kind</th>
              <th className="px-4 py-3 font-medium">Shop</th>
              <th className="px-4 py-3 font-medium">Item</th>
              <th className="px-4 py-3 font-medium">Total RWF</th>
              <th className="px-4 py-3 font-medium">MoMo</th>
              <th className="px-4 py-3 font-medium">Ref</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {filtered.map((p) => (
              <tr key={p.id} className="hover:bg-zinc-900/40">
                <td className="px-4 py-3 tabular-nums text-zinc-300">{p.id}</td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-zinc-400">{formatWhen(p.created_at)}</td>
                <td className="px-4 py-3 text-zinc-300">{p.kind ?? "—"}</td>
                <td className="max-w-[200px] truncate px-4 py-3 text-zinc-300">{p.shopName ?? "—"}</td>
                <td className="max-w-[220px] truncate px-4 py-3 text-zinc-300">{p.itemName ?? "—"}</td>
                <td className="px-4 py-3 tabular-nums text-zinc-300">
                  {p.totalRwf != null ? p.totalRwf.toLocaleString() : "—"}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-zinc-400">{p.momo || "—"}</td>
                <td className="max-w-[140px] truncate px-4 py-3 font-mono text-xs text-zinc-500">{p.rid || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading ? <p className="px-4 py-8 text-center text-sm text-zinc-500">Loading drafts…</p> : null}
        {!loading && filtered.length === 0 && !message && !error ? (
          <p className="px-4 py-8 text-center text-sm text-zinc-500">No rows in shop_onboarding_draft.</p>
        ) : null}
      </div>
      {!loading && pending.length > 0 ? (
        <p className="text-xs text-zinc-500">
          Showing {filtered.length} of {pending.length} drafts
        </p>
      ) : null}
    </div>
  )
}
