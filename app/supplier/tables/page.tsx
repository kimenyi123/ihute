"use client"

import { useCallback, useEffect, useState } from "react"
import { useAuthStore } from "@/lib/auth-store"
import Link from "next/link"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Users, ExternalLink, RefreshCw, Table2, Trash2, ChevronLeft, ChevronRight } from "lucide-react"

const PAGE_SIZE_OPTIONS = [6, 12, 24] as const

type TableRow = {
  id: number
  tableName: string
  status: string
  createdBy: string
  locationName: string
  createdAt?: string
  expiresAt?: string
  updatedAt?: string
  participantsJoined: number
  totalAmount: number
  masterOrderId?: number
}

export default function SupplierTablesPage() {
  const { user } = useAuthStore()
  const account = user?.ishyigaAccount ?? ""
  const [tables, setTables] = useState<TableRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(12)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [clearingAll, setClearingAll] = useState(false)

  const fetchTables = useCallback(async () => {
    if (!account) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/supplier/tables?account=${encodeURIComponent(account)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Failed to load tables")
      setTables(Array.isArray(data?.tables) ? data.tables : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load tables")
      setTables([])
    } finally {
      setLoading(false)
    }
  }, [account])

  useEffect(() => {
    fetchTables()
  }, [fetchTables])

  const totalPages = Math.max(1, Math.ceil(tables.length / pageSize))
  const paginatedTables = tables.slice((page - 1) * pageSize, page * pageSize)

  const canSoftDelete = (status: string) => {
    const s = (status || "").toUpperCase()
    return s === "CLOSED" || s === "SENT" || s === "EXPIRED"
  }

  const completedCount = tables.filter((t) => canSoftDelete(t.status)).length

  async function handleClearAllCompleted() {
    if (!account || completedCount === 0) return
    const ok = window.confirm(
      `Remove all ${completedCount} completed table(s) (CLOSED, SENT, EXPIRED) from this list? ACTIVE tables will not be changed.`
    )
    if (!ok) return
    setClearingAll(true)
    try {
      const res = await fetch(
        `/api/supplier/tables/clear-completed?account=${encodeURIComponent(account)}`,
        { method: "POST" }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Failed to clear")
      setTables((prev) => prev.filter((t) => !canSoftDelete(t.status)))
      setPage(1)
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to clear completed tables")
    } finally {
      setClearingAll(false)
    }
  }

  async function handleSoftDelete(t: TableRow) {
    if (!account || !canSoftDelete(t.status)) return
    setDeletingId(t.id)
    try {
      const res = await fetch(`/api/supplier/tables?account=${encodeURIComponent(account)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableName: t.tableName }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Failed to remove")
      setTables((prev) => prev.filter((x) => x.id !== t.id))
      if (page > 1 && paginatedTables.length === 1) setPage((p) => Math.max(1, p - 1))
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to remove table from list")
    } finally {
      setDeletingId(null)
    }
  }

  const statusBadge = (status: string) => {
    const s = (status || "").toUpperCase()
    const style =
      s === "ACTIVE"
        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
        : s === "SENT"
          ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
          : s === "CLOSED"
            ? "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
            : s === "EXPIRED"
              ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
              : "bg-slate-200 text-slate-600 dark:bg-slate-600 dark:text-slate-300"
    return (
      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${style}`}>
        {status || "—"}
      </span>
    )
  }

  const formatDate = (raw?: string) => {
    if (!raw) return "—"
    try {
      const d = new Date(raw)
      return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })
    } catch {
      return raw
    }
  }

  if (!account) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Tables</h1>
        <p className="text-slate-600 dark:text-slate-400">Sign in as a supplier to see your tables.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Table2 className="h-7 w-7" />
            Tables
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            All tables (manual and from QR). People who joined and linked orders appear here.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            <span><strong>ACTIVE</strong> — in use (cannot remove)</span>
            <span><strong>SENT</strong> — order sent (can remove)</span>
            <span><strong>CLOSED</strong> — completed (can remove)</span>
            <span><strong>EXPIRED</strong> — no longer active (can remove)</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600 dark:text-slate-400">Per page:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value))
              setPage(1)
            }}
            className="rounded border border-slate-300 bg-white dark:bg-slate-800 dark:border-slate-600 text-sm px-2 py-1"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={fetchTables} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          {completedCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearAllCompleted}
              disabled={clearingAll}
              className="text-amber-700 border-amber-300 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-700 dark:hover:bg-amber-950/30"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {clearingAll ? "Clearing…" : `Clear all completed (${completedCount})`}
            </Button>
          )}
        </div>
      </div>

      {error && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
          <CardContent className="pt-4">
            <p className="text-amber-800 dark:text-amber-200">{error}</p>
          </CardContent>
        </Card>
      )}

      {loading && tables.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-slate-500">
            Loading tables…
          </CardContent>
        </Card>
      ) : tables.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No tables yet</CardTitle>
            <CardDescription>
              Tables appear here when you create one (e.g. from Dashboard “Shop with me” QR) or when
              someone opens a table link and joins. Create a table from your Dashboard to get a shareable link.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {paginatedTables.map((t) => (
              <Card key={t.id} className="flex flex-col">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg font-semibold truncate" title={t.tableName}>
                      {t.tableName || "Unnamed table"}
                    </CardTitle>
                    {statusBadge(t.status)}
                  </div>
                  {t.locationName && (
                    <CardDescription>{t.locationName}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="flex-1 space-y-3">
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <Users className="h-4 w-4 shrink-0" />
                    <span>{t.participantsJoined} joined</span>
                  </div>
                  {t.totalAmount > 0 && (
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Total: {Number(t.totalAmount).toLocaleString()} RWF
                    </p>
                  )}
                  {t.createdBy && (
                    <p className="text-xs text-slate-500">Created by {t.createdBy}</p>
                  )}
                  <p className="text-xs text-slate-500">Created {formatDate(t.createdAt)}</p>
                  {t.masterOrderId && (
                    <Button asChild variant="secondary" size="sm" className="w-full">
                      <Link href={`/supplier/orders/${t.masterOrderId}`}>
                        <ExternalLink className="h-3.5 w-3.5 mr-2" />
                        View order #{t.masterOrderId}
                      </Link>
                    </Button>
                  )}
                  {canSoftDelete(t.status) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                      onClick={() => handleSoftDelete(t)}
                      disabled={deletingId === t.id}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-2" />
                      {deletingId === t.id ? "Removing…" : "Remove from list"}
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-4 pt-6">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, tables.length)} of {tables.length} tables
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
