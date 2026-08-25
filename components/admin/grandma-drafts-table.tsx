"use client"

import { useEffect, useMemo, useState } from "react"

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

type Tone = "dark" | "light"

function formatWhen(raw: string): string {
  if (!raw) return "—"
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  return d.toLocaleString()
}

export function GrandmaDraftsTable({ tone }: { tone: Tone }) {
  const [pending, setPending] = useState<DraftRow[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  const dark = tone === "dark"
  const inputClass = dark
    ? "w-full max-w-md rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
    : "w-full max-w-md rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400"
  const bannerWarn = dark
    ? "rounded-lg border border-amber-900/60 bg-amber-950/40 px-4 py-3 text-sm text-amber-200"
    : "rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
  const bannerErr = dark
    ? "rounded-lg border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200"
    : "rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
  const wrap = dark
    ? "overflow-x-auto rounded-xl border border-zinc-800"
    : "overflow-x-auto rounded-xl border border-slate-200 bg-white"
  const thead = dark
    ? "border-b border-zinc-800 bg-zinc-900/80 text-zinc-400"
    : "border-b border-slate-200 bg-slate-50 text-slate-500"
  const cell = dark ? "px-3 py-3 text-zinc-300" : "px-3 py-3 text-slate-700"
  const muted = dark ? "text-zinc-500" : "text-slate-400"
  const rowHover = dark ? "hover:bg-zinc-900/40" : "hover:bg-slate-50"
  const divide = dark ? "divide-y divide-zinc-800" : "divide-y divide-slate-100"

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
    <div className="space-y-4">
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search shop, item, kind, MoMo…"
        className={inputClass}
        aria-label="Search onboarding drafts"
      />
      {message ? <div className={bannerWarn}>{message}</div> : null}
      {error ? <div className={bannerErr}>{error}</div> : null}
      <div className={wrap}>
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className={thead}>
            <tr>
              <th className="px-3 py-3 font-medium">ID</th>
              <th className="px-3 py-3 font-medium">Created</th>
              <th className="px-3 py-3 font-medium">Kind</th>
              <th className="px-3 py-3 font-medium">Shop</th>
              <th className="px-3 py-3 font-medium">Item</th>
              <th className="px-3 py-3 font-medium">Total RWF</th>
              <th className="px-3 py-3 font-medium">MoMo</th>
              <th className="px-3 py-3 font-medium">Ref</th>
            </tr>
          </thead>
          <tbody className={divide}>
            {filtered.map((p) => (
              <tr key={p.id} className={rowHover}>
                <td className={`${cell} tabular-nums`}>{p.id}</td>
                <td className={`${cell} whitespace-nowrap text-xs`}>{formatWhen(p.created_at)}</td>
                <td className={cell}>{p.kind ?? "—"}</td>
                <td className={`max-w-[200px] truncate ${cell}`}>{p.shopName ?? "—"}</td>
                <td className={`max-w-[220px] truncate ${cell}`}>{p.itemName ?? "—"}</td>
                <td className={`${cell} tabular-nums`}>
                  {p.totalRwf != null ? p.totalRwf.toLocaleString() : "—"}
                </td>
                <td className={`${cell} font-mono text-xs ${muted}`}>{p.momo || "—"}</td>
                <td className={`max-w-[140px] truncate font-mono text-xs ${muted}`}>{p.rid || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading ? <p className={`px-4 py-8 text-center text-sm ${muted}`}>Loading drafts…</p> : null}
        {!loading && filtered.length === 0 && !message && !error ? (
          <p className={`px-4 py-8 text-center text-sm ${muted}`}>No rows in shop_onboarding_draft.</p>
        ) : null}
      </div>
      {!loading && pending.length > 0 ? (
        <p className={`text-xs ${muted}`}>
          Showing {filtered.length} of {pending.length} drafts
        </p>
      ) : null}
    </div>
  )
}
