"use client"

import { useCallback, useEffect, useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Check, X, RefreshCw, Search, Pill, HelpCircle } from "lucide-react"
import { fetchAdminProtectedApi } from "@/lib/admin-client"
import { DRUG_FAMILLES } from "@/lib/prescription-review-constants"
import { useToast } from "@/components/ui/use-toast"

type Item = {
  nikiCode: string
  itemName: string
  famille: string
  requiresPrescription: number
  prescriptionReason: string
  stockSellers: number
}

type Stats = {
  unflaggedInDrugBuckets: number
  pendingReviewReason: number
  pharmacistReviewed: number
}

function Hint({ label, tip }: { label: ReactNode; tip: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      {label}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex text-slate-400 hover:text-slate-600"
            aria-label="More info"
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[260px] text-left leading-snug">
          {tip}
        </TooltipContent>
      </Tooltip>
    </span>
  )
}

export default function PrescriptionReviewPage() {
  const { toast } = useToast()
  const [items, setItems] = useState<Item[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit] = useState(40)
  const [q, setQ] = useState("")
  const [qDraft, setQDraft] = useState("")
  const [famille, setFamille] = useState("ALL")
  const [filter, setFilter] = useState<"pending" | "reviewed">("pending")
  const [loading, setLoading] = useState(true)
  const [busyCode, setBusyCode] = useState<string | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        filter,
      })
      if (q.trim()) params.set("q", q.trim())
      if (famille && famille !== "ALL") params.set("famille", famille)

      const [listRes, statsRes] = await Promise.all([
        fetchAdminProtectedApi(`/api/admin/prescription-review?${params}`),
        fetchAdminProtectedApi("/api/admin/prescription-review?stats=1"),
      ])
      const listJson = await listRes.json()
      const statsJson = await statsRes.json()
      if (!listRes.ok || !listJson.ok) {
        throw new Error(listJson.error || `List failed (${listRes.status})`)
      }
      setItems(Array.isArray(listJson.items) ? listJson.items : [])
      setTotal(Number(listJson.total) || 0)
      if (statsRes.ok && statsJson.ok && statsJson.stats) {
        setStats(statsJson.stats as Stats)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load queue"
      setError(msg)
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [page, limit, q, famille, filter])

  useEffect(() => {
    void load()
  }, [load])

  async function decide(nikiCode: string, decision: "rx" | "otc") {
    setBusyCode(nikiCode)
    try {
      const res = await fetchAdminProtectedApi("/api/admin/prescription-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nikiCode, decision }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        throw new Error(json.error || `Save failed (${res.status})`)
      }
      toast({
        title: decision === "rx" ? "Marked Rx required" : "Marked OTC (no Rx)",
        description: `${nikiCode} · mirrored ${json.mirrored ?? 0} stock row(s)`,
        duration: 2500,
      })
      setItems((prev) => prev.filter((it) => it.nikiCode !== nikiCode))
      setTotal((t) => Math.max(0, t - 1))
      void load()
    } catch (e) {
      toast({
        title: "Could not save",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setBusyCode(null)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / limit))

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <Pill className="h-7 w-7 text-sky-700" />
            Prescription review
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Pharmacist queue for catalog items the auto-classifier left unflagged. Your choice
            updates checkout (buyers must upload Rx when marked required) and WhatsApp order flow.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="rounded-lg border border-sky-100 bg-sky-50/80 px-4 py-3 text-sm text-slate-700">
        <p className="font-medium text-slate-900">What this is for</p>
        <ul className="mt-1.5 list-disc space-y-1 pl-5 text-slate-600">
          <li>
            <strong className="font-medium text-slate-800">Rx</strong> — buyer must attach a
            prescription at checkout for this NIKI code.
          </li>
          <li>
            <strong className="font-medium text-slate-800">OTC</strong> — no prescription needed;
            still records that a pharmacist decided.
          </li>
          <li>
            Saves to <code className="text-xs">niki_items</code> and mirrors{" "}
            <code className="text-xs">seller_add_stock</code>. Does not bulk-flip the whole
            pending_review pile.
          </li>
        </ul>
      </div>

      {stats ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>
                <Hint
                  label="Unflagged in drug buckets"
                  tip="Items in pharmacy/drug familles that still have requires_prescription = 0 (not yet decided)."
                />
              </CardDescription>
              <CardTitle className="text-2xl tabular-nums">{stats.unflaggedInDrugBuckets}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>
                <Hint
                  label="pending_review reason rows"
                  tip="Auto-ingest marked these as unclear (pending_review:…). Prefer deciding them here instead of bulk SQL."
                />
              </CardDescription>
              <CardTitle className="text-2xl tabular-nums">{stats.pendingReviewReason}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>
                <Hint
                  label="Pharmacist reviewed"
                  tip="Already decided in this UI (prescription_reason starts with pharmacist:)."
                />
              </CardDescription>
              <CardTitle className="text-2xl tabular-nums">{stats.pharmacistReviewed}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
          <CardDescription>
            Narrow by name/code, POS famille, or switch to past pharmacist decisions.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="flex min-w-[200px] flex-1 gap-2">
            <Input
              placeholder="Search name or NIKI code…"
              value={qDraft}
              onChange={(e) => setQDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setPage(1)
                  setQ(qDraft)
                }
              }}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setPage(1)
                setQ(qDraft)
              }}
            >
              <Search className="h-4 w-4" />
            </Button>
          </div>
          <Select
            value={famille}
            onValueChange={(v) => {
              setFamille(v)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Famille" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All familles</SelectItem>
              {DRUG_FAMILLES.map((f) => (
                <SelectItem key={f} value={f}>
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filter}
            onValueChange={(v) => {
              setFilter(v as "pending" | "reviewed")
              setPage(1)
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Needs review</SelectItem>
              <SelectItem value="reviewed">Already reviewed</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
          <div className="mt-1 text-xs text-red-700">
            Ensure GQ_MYSQL_* points at the marketplace DB (e.g. chaos_dev) with access to{" "}
            <code>niki.niki_items</code>.
          </div>
        </div>
      ) : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Queue{" "}
            <Badge variant="secondary" className="ml-2 tabular-nums">
              {total}
            </Badge>
          </CardTitle>
          <CardDescription>
            Page {page} / {totalPages}
            {loading ? " · loading…" : ""}
            {filter === "pending"
              ? " · decide each row; pending_review reasons are sorted first"
              : " · read-only history of pharmacist decisions"}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <Hint
                    label="NIKI"
                    tip="Catalog product code (niki_code). Same ID used on stock rows and checkout."
                  />
                </TableHead>
                <TableHead>
                  <Hint label="Name" tip="Commercial name from niki_items.item_commercial_name." />
                </TableHead>
                <TableHead>
                  <Hint
                    label="Famille"
                    tip="POS/NIKI product family from seller stock (e.g. DRUGS, CA, PSE). Used to scope this queue to pharmacy-like buckets."
                  />
                </TableHead>
                <TableHead>
                  <Hint
                    label="Sellers"
                    tip="How many distinct sellers currently have this NIKI code in seller_add_stock. Higher = more impact when you flip Rx."
                  />
                </TableHead>
                <TableHead>
                  <Hint
                    label="Reason"
                    tip="Why the row is here: pending_review:… from auto-ingest, empty if never classified, or pharmacist:… after you decide."
                  />
                </TableHead>
                <TableHead className="text-right">
                  <span className="inline-flex w-full justify-end">
                    <Hint
                      label="Decide"
                      tip="Rx = require prescription at checkout. OTC = no prescription. Writes niki_items and mirrors requires_prescription to all seller stock rows for this code."
                    />
                  </span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!loading && items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No items in this filter.
                  </TableCell>
                </TableRow>
              ) : null}
              {items.map((it) => (
                <TableRow key={it.nikiCode}>
                  <TableCell className="font-mono text-xs">{it.nikiCode}</TableCell>
                  <TableCell className="max-w-[280px] text-sm">{it.itemName}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{it.famille || "—"}</Badge>
                  </TableCell>
                  <TableCell className="tabular-nums">{it.stockSellers}</TableCell>
                  <TableCell className="max-w-[160px] truncate text-xs text-muted-foreground">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help truncate">{it.prescriptionReason || "—"}</span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[320px] break-all text-left">
                        {it.prescriptionReason || "No reason stored yet"}
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell className="text-right">
                    {filter === "pending" ? (
                      <div className="flex justify-end gap-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700"
                              disabled={busyCode === it.nikiCode}
                              onClick={() => void decide(it.nikiCode, "rx")}
                            >
                              <Check className="mr-1 h-3.5 w-3.5" />
                              Rx
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Require prescription at checkout</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busyCode === it.nikiCode}
                              onClick={() => void decide(it.nikiCode, "otc")}
                            >
                              <X className="mr-1 h-3.5 w-3.5" />
                              OTC
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>No prescription required</TooltipContent>
                        </Tooltip>
                      </div>
                    ) : (
                      <Badge variant={it.requiresPrescription ? "default" : "secondary"}>
                        {it.requiresPrescription ? "Rx" : "OTC"}
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="mt-4 flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground tabular-nums">
              {page} / {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
