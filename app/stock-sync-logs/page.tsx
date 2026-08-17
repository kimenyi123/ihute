"use client"

import { useEffect, useMemo, useState } from "react"

type LogItem = {
  _id?: unknown
  source?: string
  stage?: string
  status?: string
  ishyigaAccount?: string
  sellerOwner?: string
  redisKey?: string
  message?: string
  inputCount?: number
  savedCount?: number
  failedCount?: number
  durationMs?: number
  createdAt?: string
  skippedItems?: Array<{ index?: number; item_commercial_name?: string; reason?: string }>
}

const logTimeKigaliFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Kigali",
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
})

function formatLogTimeKigali(iso?: string): string {
  if (!iso?.trim()) return "—"
  const raw = iso.trim()
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  return logTimeKigaliFormatter.format(d)
}

export default function StockSyncLogsPage() {
  const [items, setItems] = useState<LogItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [summary, setSummary] = useState<{
    uniqueAccountsTotal: number
    uniqueAccountsByStage: Record<string, number>
    eventsByStage: Record<string, number>
  }>({ uniqueAccountsTotal: 0, uniqueAccountsByStage: {}, eventsByStage: {} })

  const [seller, setSeller] = useState("")
  const [stage, setStage] = useState("")
  const [status, setStatus] = useState("")
  const [source, setSource] = useState("")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [retryingKey, setRetryingKey] = useState<string>("")

  const stageLabel = (s?: string) => {
    if (s === "redis_ingest") return "send_to_redis"
    if (s === "redis_to_mysql_sync") return "redis_to_mysql_sync"
    if (!s) return "—"
    return s
  }

  const query = useMemo(() => {
    const params = new URLSearchParams()
    if (seller.trim()) params.set("seller", seller.trim())
    if (stage.trim()) params.set("stage", stage.trim())
    if (status.trim()) params.set("status", status.trim())
    if (source.trim()) params.set("source", source.trim())
    if (from.trim()) params.set("from", new Date(from).toISOString())
    if (to.trim()) params.set("to", new Date(to).toISOString())
    params.set("page", String(page))
    params.set("pageSize", String(pageSize))
    return params.toString()
  }, [seller, stage, status, source, from, to, page, pageSize])

  const load = async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/stock-sync/logs?${query}`, {
        cache: "no-store",
      })
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
        items?: LogItem[]
        total?: number
        totalPages?: number
        summary?: {
          uniqueAccountsTotal?: number
          uniqueAccountsByStage?: Record<string, number>
          eventsByStage?: Record<string, number>
        }
      }
      if (!res.ok || !json?.ok) {
        setItems([])
        setTotal(0)
        setTotalPages(1)
        setError(json?.error || "Failed to load logs")
        return
      }
      setItems(Array.isArray(json.items) ? json.items : [])
      setTotal(typeof json.total === "number" ? json.total : 0)
      setTotalPages(typeof json.totalPages === "number" ? Math.max(1, json.totalPages) : 1)
      setSummary({
        uniqueAccountsTotal: json.summary?.uniqueAccountsTotal ?? 0,
        uniqueAccountsByStage: json.summary?.uniqueAccountsByStage ?? {},
        eventsByStage: json.summary?.eventsByStage ?? {},
      })
    } catch (e) {
      setItems([])
      setTotal(0)
      setTotalPages(1)
      setError(e instanceof Error ? e.message : "Failed to load logs")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [query])

  useEffect(() => {
    if (!autoRefresh) return
    const id = setInterval(() => {
      void load()
    }, 30000)
    return () => clearInterval(id)
  }, [autoRefresh, query])

  const exportCsv = async () => {
    const q = new URLSearchParams()
    if (seller.trim()) q.set("seller", seller.trim())
    if (stage.trim()) q.set("stage", stage.trim())
    if (status.trim()) q.set("status", status.trim())
    if (source.trim()) q.set("source", source.trim())
    if (from.trim()) q.set("from", new Date(from).toISOString())
    if (to.trim()) q.set("to", new Date(to).toISOString())
    q.set("max", "10000")
    window.open(`/api/stock-sync/logs/export?${q.toString()}`, "_blank", "noopener,noreferrer")
  }

  const retryFailed = async (it: LogItem) => {
    setRetryingKey(String(it.redisKey || it.ishyigaAccount || "row"))
    try {
      const res = await fetch("/api/stock-sync/logs/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ishyigaAccount: it.ishyigaAccount,
          redisKey: it.redisKey,
          stage: it.stage,
        }),
      })
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; message?: string }
      if (!res.ok || !json.ok) {
        setError(json.error || "Retry failed")
        return
      }
      setError("")
      await load()
    } finally {
      setRetryingKey("")
    }
  }

  return (
    <main className="mx-auto max-w-7xl p-4 md:p-6">
      <h1 className="text-2xl font-semibold">Stock Sync Logs</h1>
      <p className="text-sm text-muted-foreground mt-1">
        send_to_redis + redis_to_mysql_sync events with failure reasons.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-8">
        <input
          className="rounded border px-3 py-2 text-sm"
          placeholder="Seller account (ALG...)"
          value={seller}
          onChange={(e) => {
            setSeller(e.target.value)
            setPage(1)
          }}
        />
        <select
          className="rounded border px-3 py-2 text-sm"
          value={stage}
          onChange={(e) => {
            setStage(e.target.value)
            setPage(1)
          }}
        >
          <option value="">All stages</option>
          <option value="redis_ingest">send_to_redis</option>
          <option value="redis_to_mysql_sync">redis_to_mysql_sync</option>
        </select>
        <select
          className="rounded border px-3 py-2 text-sm"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            setPage(1)
          }}
        >
          <option value="">All status</option>
          <option value="success">success</option>
          <option value="partial_success">partial_success</option>
          <option value="failed">failed</option>
        </select>
        <select
          className="rounded border px-3 py-2 text-sm"
          value={source}
          onChange={(e) => {
            setSource(e.target.value)
            setPage(1)
          }}
        >
          <option value="">All sources</option>
          <option value="Redisbulk">Redisbulk</option>
          <option value="RedisSellerStockSyncJob">RedisSellerStockSyncJob</option>
        </select>
        <select
          className="rounded border px-3 py-2 text-sm"
          value={String(pageSize)}
          onChange={(e) => {
            setPageSize(Number.parseInt(e.target.value, 10))
            setPage(1)
          }}
        >
          <option value="10">10 / page</option>
          <option value="25">25 / page</option>
          <option value="50">50 / page</option>
          <option value="100">100 / page</option>
        </select>
        <input
          type="datetime-local"
          className="rounded border px-3 py-2 text-sm"
          value={from}
          onChange={(e) => {
            setFrom(e.target.value)
            setPage(1)
          }}
        />
        <input
          type="datetime-local"
          className="rounded border px-3 py-2 text-sm"
          value={to}
          onChange={(e) => {
            setTo(e.target.value)
            setPage(1)
          }}
        />
        <button
          onClick={() => void load()}
          className="rounded bg-[#1e3a5f] px-3 py-2 text-sm font-medium text-white hover:bg-[#2c4f7c]"
          disabled={loading}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
        <button
          onClick={exportCsv}
          className="rounded border border-[#1e3a5f] px-3 py-2 text-sm font-medium text-[#1e3a5f] hover:bg-slate-50"
        >
          Export CSV
        </button>
      </div>
      <div className="mt-2 flex items-center gap-2 text-sm">
        <input
          id="auto-refresh"
          type="checkbox"
          checked={autoRefresh}
          onChange={(e) => setAutoRefresh(e.target.checked)}
        />
        <label htmlFor="auto-refresh" className="text-slate-600">
          Auto refresh every 30s
        </label>
      </div>

      {error ? (
        <div className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded border bg-slate-50 px-3 py-2 text-sm">
          <div className="text-xs text-slate-500">Unique seller accounts (filtered)</div>
          <div className="text-lg font-semibold">{summary.uniqueAccountsTotal}</div>
        </div>
        <div className="rounded border bg-slate-50 px-3 py-2 text-sm">
          <div className="text-xs text-slate-500">send_to_redis</div>
          <div className="text-sm">
            sellers: {summary.uniqueAccountsByStage.redis_ingest ?? 0} | events:{" "}
            {summary.eventsByStage.redis_ingest ?? 0}
          </div>
        </div>
        <div className="rounded border bg-slate-50 px-3 py-2 text-sm">
          <div className="text-xs text-slate-500">redis_to_mysql_sync</div>
          <div className="text-sm">
            sellers: {summary.uniqueAccountsByStage.redis_to_mysql_sync ?? 0} | events:{" "}
            {summary.eventsByStage.redis_to_mysql_sync ?? 0}
          </div>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded border">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left">
              <th className="px-3 py-2">Time</th>
              <th className="px-3 py-2">Seller</th>
              <th className="px-3 py-2">Owner</th>
              <th className="px-3 py-2">Stage</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Counts</th>
              <th className="px-3 py-2">Message</th>
              <th className="px-3 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => (
              <tr key={idx} className="border-t align-top">
                <td
                  className="px-3 py-2 whitespace-nowrap"
                  title={it.createdAt ? `UTC: ${it.createdAt}` : undefined}
                >
                  {formatLogTimeKigali(it.createdAt)}
                </td>
                <td className="px-3 py-2 font-mono">{it.ishyigaAccount || "—"}</td>
                <td className="px-3 py-2">{it.sellerOwner || "—"}</td>
                <td className="px-3 py-2">{stageLabel(it.stage)}</td>
                <td className="px-3 py-2">
                  <span
                    className={
                      it.status === "success"
                        ? "rounded bg-green-100 px-2 py-1 text-green-700"
                        : it.status === "failed"
                          ? "rounded bg-red-100 px-2 py-1 text-red-700"
                          : "rounded bg-amber-100 px-2 py-1 text-amber-700"
                    }
                  >
                    {it.status || "—"}
                  </span>
                </td>
                <td className="px-3 py-2">
                  in:{it.inputCount ?? 0} / ok:{it.savedCount ?? 0} / fail:{it.failedCount ?? 0}
                </td>
                <td className="px-3 py-2">
                  <div>{it.message || "—"}</div>
                  {Array.isArray(it.skippedItems) && it.skippedItems.length > 0 ? (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-xs text-slate-600">
                        {it.skippedItems.length} skipped reason(s)
                      </summary>
                      <ul className="mt-1 list-disc pl-5 text-xs text-slate-700">
                        {it.skippedItems.slice(0, 20).map((s, i) => (
                          <li key={i}>
                            #{s.index ?? i} {s.item_commercial_name || ""} - {s.reason || "Unknown reason"}
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {it.status === "failed" ? (
                    <button
                      className="rounded border px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-50"
                      onClick={() => void retryFailed(it)}
                      disabled={retryingKey === String(it.redisKey || it.ishyigaAccount || "row")}
                      title="Retry failed event"
                    >
                      {retryingKey === String(it.redisKey || it.ishyigaAccount || "row")
                        ? "Retrying..."
                        : "Retry"}
                    </button>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
            {!loading && items.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-center text-muted-foreground" colSpan={8}>
                  No logs found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 text-sm">
        <div className="text-slate-600">
          Page {page} / {totalPages} ({total} total event{total === 1 ? "" : "s"})
        </div>
        <div className="flex gap-2">
          <button
            className="rounded border px-3 py-1.5 disabled:opacity-50"
            disabled={loading || page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </button>
          <button
            className="rounded border px-3 py-1.5 disabled:opacity-50"
            disabled={loading || page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </button>
        </div>
      </div>
    </main>
  )
}

