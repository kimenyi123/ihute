"use client"

import { useCallback, useEffect, useState } from "react"
import { Eye, RefreshCw, Search } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { fetchAdminProtectedApi } from "@/lib/admin-client"
import {
  CLIENT_SUGGESTION_CATEGORIES,
  CLIENT_SUGGESTION_STATUSES,
  type ClientSuggestionRow,
  type ClientSuggestionStatus,
} from "@/lib/client-suggestion-shared"

type ListResponse = {
  ok: boolean
  error?: string
  data?: ClientSuggestionRow[]
  pagination?: { page: number; limit: number; total: number; totalPages: number }
}

function statusBadge(status: ClientSuggestionStatus) {
  const map: Record<ClientSuggestionStatus, string> = {
    NEW: "bg-blue-100 text-blue-800",
    READ: "bg-slate-100 text-slate-800",
    IN_PROGRESS: "bg-amber-100 text-amber-800",
    RESOLVED: "bg-emerald-100 text-emerald-800",
  }
  return <Badge className={map[status]}>{status.replace("_", " ")}</Badge>
}

export default function AdminClientSuggestionsPage() {
  const [rows, setRows] = useState<ClientSuggestionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [q, setQ] = useState("")
  const [qDraft, setQDraft] = useState("")
  const [status, setStatus] = useState("all")
  const [category, setCategory] = useState("all")
  const [sort, setSort] = useState<"newest" | "oldest">("newest")
  const [selected, setSelected] = useState<ClientSuggestionRow | null>(null)
  const [statusSaving, setStatusSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
        sort,
      })
      if (q) params.set("q", q)
      if (status !== "all") params.set("status", status)
      if (category !== "all") params.set("category", category)
      const res = await fetchAdminProtectedApi(`/api/admin/client-suggestions?${params}`)
      const data = (await res.json()) as ListResponse
      if (!res.ok || !data.ok) {
        setError(data.error || "Failed to load suggestions")
        setRows([])
        return
      }
      setRows(data.data ?? [])
      setTotalPages(data.pagination?.totalPages ?? 1)
      setTotal(data.pagination?.total ?? 0)
    } catch {
      setError("Failed to load suggestions")
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [page, q, status, category, sort])

  useEffect(() => {
    void load()
  }, [load])

  async function updateStatus(id: number, next: ClientSuggestionStatus) {
    setStatusSaving(true)
    try {
      const res = await fetchAdminProtectedApi(`/api/admin/client-suggestions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
      const data = (await res.json()) as { ok?: boolean; error?: string; data?: ClientSuggestionRow }
      if (!res.ok || !data.ok || !data.data) {
        toast.error(data.error || "Could not update status")
        return
      }
      toast.success("Status updated")
      setSelected(data.data)
      setRows((prev) => prev.map((r) => (r.id === id ? data.data! : r)))
    } catch {
      toast.error("Could not update status")
    } finally {
      setStatusSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Client Suggestions</CardTitle>
          <CardDescription>Feedback submitted from Grandma Support.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <form
              className="flex min-w-0 flex-1 gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                setPage(1)
                setQ(qDraft.trim())
              }}
            >
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden />
                <Input
                  value={qDraft}
                  onChange={(e) => setQDraft(e.target.value)}
                  placeholder="Search name, email, subject…"
                  className="pl-9"
                  aria-label="Search suggestions"
                />
              </div>
              <Button type="submit" variant="secondary">
                Search
              </Button>
            </form>
            <Select
              value={status}
              onValueChange={(v) => {
                setPage(1)
                setStatus(v)
              }}
            >
              <SelectTrigger className="w-full lg:w-44" aria-label="Filter by status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {CLIENT_SUGGESTION_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.replace("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={category}
              onValueChange={(v) => {
                setPage(1)
                setCategory(v)
              }}
            >
              <SelectTrigger className="w-full lg:w-48" aria-label="Filter by category">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {CLIENT_SUGGESTION_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(v) => setSort(v === "oldest" ? "oldest" : "newest")}>
              <SelectTrigger className="w-full lg:w-36" aria-label="Sort">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="oldest">Oldest</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <p>{error}</p>
              <Button type="button" size="sm" className="mt-2" onClick={() => void load()}>
                <RefreshCw className="h-4 w-4" />
                Retry
              </Button>
            </div>
          ) : null}

          {loading ? (
            <div className="space-y-2 py-4" aria-busy="true" aria-label="Loading suggestions">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-2/3" />
            </div>
          ) : rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">
              {q || status !== "all" || category !== "all"
                ? "No matching suggestions."
                : "No client suggestions yet."}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.id}</TableCell>
                      <TableCell>
                        <div className="font-medium">{r.fullName}</div>
                        <div className="text-xs text-slate-500">{r.email}</div>
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate">{r.subject}</TableCell>
                      <TableCell>{r.category || "—"}</TableCell>
                      <TableCell>{statusBadge(r.status)}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {r.createdAt ? new Date(r.createdAt).toLocaleString() : "—"}
                      </TableCell>
                      <TableCell>
                        <Button type="button" size="sm" variant="outline" onClick={() => setSelected(r)}>
                          <Eye className="h-4 w-4" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="flex items-center justify-between text-sm text-slate-600">
            <span>
              {total} total · page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Suggestion #{selected?.id}</DialogTitle>
            <DialogDescription>Full client feedback</DialogDescription>
          </DialogHeader>
          {selected ? (
            <div className="space-y-3 text-sm">
              <p>
                <span className="font-medium">Client:</span> {selected.fullName}
              </p>
              <p>
                <span className="font-medium">Email:</span> {selected.email}
              </p>
              <p>
                <span className="font-medium">Phone:</span> {selected.phone}
              </p>
              <p>
                <span className="font-medium">Subject:</span> {selected.subject}
              </p>
              <p>
                <span className="font-medium">Category:</span> {selected.category || "—"}
              </p>
              <p className="whitespace-pre-wrap rounded-md bg-slate-50 p-3">{selected.suggestionDetails}</p>
              <p>
                <span className="font-medium">Created:</span> {new Date(selected.createdAt).toLocaleString()}
              </p>
              <p>
                <span className="font-medium">Updated:</span> {new Date(selected.updatedAt).toLocaleString()}
              </p>
              <div className="space-y-1.5">
                <p className="font-medium">Status</p>
                <Select
                  value={selected.status}
                  disabled={statusSaving}
                  onValueChange={(v) => {
                    if (CLIENT_SUGGESTION_STATUSES.includes(v as ClientSuggestionStatus)) {
                      void updateStatus(selected.id, v as ClientSuggestionStatus)
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CLIENT_SUGGESTION_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s.replace("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
