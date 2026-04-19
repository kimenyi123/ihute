"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"

type Entry = { key: string; type: string; ttl: number; value: string | null }

export default function DevRedisPage() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const headers: HeadersInit = {}
    if (token.trim()) {
      headers.Authorization = token.trim().startsWith("Bearer ") ? token.trim() : `Bearer ${token.trim()}`
    }
    const r = await fetch("/api/dev/redis", { cache: "no-store", headers })
    const j = (await r.json().catch(() => null)) as Record<string, unknown> | null
    if (!r.ok) {
      setEntries([])
      setError(typeof j?.error === "string" ? j.error : `HTTP ${r.status}`)
      setLoading(false)
      return
    }
    const list = j && Array.isArray(j.entries) ? (j.entries as Entry[]) : []
    setEntries(list)
    setLoading(false)
  }, [token])

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only; token used on Refresh
  }, [])

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-slate-900">Redis inspector</h1>
          <Link href="/" className="text-sm text-blue-600 hover:underline">
            Home
          </Link>
        </div>
        <p className="text-sm text-slate-600">
          In development this loads without a token. In production, set{" "}
          <code className="rounded bg-slate-200 px-1">REDIS_DEBUG_SECRET</code> and pass{" "}
          <code className="rounded bg-slate-200 px-1">Authorization: Bearer …</code> below.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-600">Bearer token (non-dev)</span>
            <input
              className="min-w-[240px] rounded border border-slate-300 bg-white px-2 py-1.5 font-mono text-sm"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="optional"
              autoComplete="off"
            />
          </label>
          <button
            type="button"
            className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            onClick={() => void load()}
          >
            Refresh
          </button>
        </div>
        {loading ? <p className="text-sm text-slate-500">Loading…</p> : null}
        {error ? (
          <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
        ) : null}
        {!loading && !error ? (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100 text-slate-700">
                  <th className="px-3 py-2 font-medium">Key</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">TTL</th>
                  <th className="px-3 py-2 font-medium">Value</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.key} className="border-b border-slate-100 align-top">
                    <td className="max-w-[200px] break-all px-3 py-2 font-mono text-xs">{e.key}</td>
                    <td className="whitespace-nowrap px-3 py-2">{e.type}</td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums">{e.ttl}</td>
                    <td className="max-w-xl break-all px-3 py-2 font-mono text-xs text-slate-800">{e.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {entries.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-slate-500">No keys (or empty database).</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
