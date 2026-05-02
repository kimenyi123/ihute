"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import {
  ArrowUpRight,
  Banknote,
  Check,
  ChevronsUpDown,
  DollarSign,
  Landmark,
  Loader2,
  Percent,
  RefreshCw,
  Settings,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { useAuthStore } from "@/lib/auth-store"
import { postAdminApi } from "@/lib/admin-client"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { ResponsiveTable } from "@/components/ui/responsive-table"

type ReportPeriod = "daily" | "weekly" | "monthly"

/** Inline glyph — avoids lucide `Search` chunk issues with Next/Turbopack HMR in some setups. */
function SellerPickerSearchIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}

interface CommissionSettings {
  platformFee: number
  platformFeePercent: number
  description: string
  /** Effective rate source from backend: environment | database | default */
  rateSource?: string
  /** Value persisted in ihute_platform_settings (may differ from platformFee when env overrides). */
  databaseRate?: number
  databaseRatePercent?: number
}

/** Trim float noise for percent fields (e.g. 0.5 not 0.5000000001). */
function formatPercentForInput(pct: number): string {
  if (!Number.isFinite(pct)) return ""
  const s = pct.toFixed(10).replace(/\.?0+$/, "")
  return s === "" ? "0" : s
}

/** Value to show in the fee dialog: DB-stored % when env overrides, else effective %. */
function commissionPercentInputFromSettings(s: CommissionSettings | null): string {
  if (!s) return ""
  if (
    s.rateSource === "environment" &&
    s.databaseRatePercent != null &&
    Number.isFinite(s.databaseRatePercent)
  ) {
    return formatPercentForInput(s.databaseRatePercent)
  }
  return formatPercentForInput(s.platformFeePercent)
}

function commissionRateSourceLabel(source?: string): string {
  switch (source) {
    case "environment":
      return "Environment variable (KAOS_PLATFORM_COMMISSION_RATE)"
    case "database":
      return "Admin panel (saved in database)"
    case "default":
      return "Built-in default (no saved rate yet)"
    default:
      return "—"
  }
}

interface CommissionReportRow {
  date: string
  orderCount: number
  totalRevenue: number
  platformCommission: number
}

interface TopSeller {
  id: number
  name: string
  ishyigaAccount: string
  orderCount: number
  totalRevenue: number
  totalCommission: number
  previousPeriodCommission: number
  growth?: number
  sector?: string
}

interface CollectionRow {
  id: number
  sellerAccount: string
  sellerName: string
  amountCollected: number
  collectionPeriodStart?: string
  collectionPeriodEnd?: string
  collectionDate: string
  collectedBy?: string
  paymentMethod?: string
  referenceNumber?: string
  notes?: string
  status?: string
}

interface CollectionSummary {
  totalCollections?: number
  totalCollected?: number
  averageCollection?: number
  firstCollectionDate?: string
  lastCollectionDate?: string
  sellersWithPendingCommission?: number
  totalPendingCommission?: number
}

/** Live sellers from AdminServlet.getActiveSellers */
interface LiveSellerOption {
  id: number
  ishyigaAccount: string
  firstName: string | null
  lastName: string | null
  email?: string | null
}

/**  first === last → single readable label. */
function collapseMirroredPersonName(phrase: string): string {
  const t = phrase.trim().replace(/\s+/g, " ")
  if (!t) return t
  const words = t.split(" ")
  if (words.length >= 2 && words.length % 2 === 0) {
    const mid = words.length / 2
    const a = words.slice(0, mid).join(" ")
    const b = words.slice(mid).join(" ")
    if (a.toLowerCase() === b.toLowerCase()) return a
  }
  return t
}

function formatSellerDisplayName(s: Pick<LiveSellerOption, "firstName" | "lastName" | "email" | "ishyigaAccount">): string {
  const fn = (s.firstName ?? "").trim()
  const ln = (s.lastName ?? "").trim()
  let name = ""
  if (fn && ln) {
    if (fn.toLowerCase() === ln.toLowerCase()) name = fn
    else name = `${fn} ${ln}`.trim()
  } else {
    name = [fn, ln].filter(Boolean).join(" ").trim()
  }
  if (name) return collapseMirroredPersonName(name)
  const em = s.email?.trim()
  if (em) return em
  return s.ishyigaAccount
}

function buildSellerSearchHaystack(s: LiveSellerOption): string {
  const display = formatSellerDisplayName(s)
  const parts = [
    s.ishyigaAccount,
    display,
    s.email ?? "",
    s.firstName ?? "",
    s.lastName ?? "",
    ...display.split(/\s+/).filter(Boolean),
  ]
  return parts.filter(Boolean).join(" ").toLowerCase()
}

/** Substring-only matching on spaced hay + compact alphanumerics (no subsequence — that matched unrelated rows on full words). */
function sellerRowMatchesQuery(s: LiveSellerOption, rawQuery: string): boolean {
  const q = rawQuery
    .trim()
    .normalize("NFC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .toLowerCase()
  if (!q) return true
  const hay = buildSellerSearchHaystack(s)
  const compactHay = hay.replace(/[^a-z0-9]/gi, "")
  const tokens = q.split(/\s+/).filter(Boolean)

  for (const t of tokens) {
    if (!t) continue
    if (hay.includes(t)) continue
    const tCompact = t.replace(/[^a-z0-9]/gi, "")
    if (tCompact.length === 0) return false
    // Long letter-only tokens must appear in spaced hay (name/email/account words), not only in
    // compact glue — avoids accidental matches across digit/letter boundaries.
    const lettersOnly = /^[a-z]+$/i.test(tCompact)
    if (lettersOnly && tCompact.length >= 4) return false
    if (compactHay.includes(tCompact)) continue
    return false
  }
  return true
}

function clearSellerRowMatchesQuery(rawQuery: string): boolean {
  const q = rawQuery.trim().toLowerCase()
  if (!q) return true
  return ["clear", "reset", "deselect", "none", "remove"].some(
    (w) => q.includes(w) || w.includes(q)
  )
}

async function adminPost(body: Record<string, unknown>) {
  const res = await postAdminApi(body)
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok && data?.ok === true, data, status: res.status, rawError: data?.error }
}

/** Same window as Top sellers chart; uses in-memory list when seller is in top 50, else backend. */
async function suggestCollectionAmountRwf(
  sellerAccount: string,
  topSellers: TopSeller[],
  topSellerPeriod: string,
  adminEmail: string
): Promise<string> {
  const top = topSellers.find((t) => t.ishyigaAccount === sellerAccount)
  if (top) {
    return String(Math.round(Number(top.totalCommission) || 0))
  }
  const res = await adminPost({
    adminEmail,
    action: "getSellerCommissionDue",
    sellerAccount,
    period: topSellerPeriod,
  })
  const due = res.data?.commissionDue
  if (res.ok && typeof due === "number" && Number.isFinite(due)) {
    return String(Math.round(due))
  }
  return ""
}

export default function CommissionPage() {
  const { user, hasHydrated } = useAuthStore()
  const adminEmail = user?.email?.trim() || ""

  const [settings, setSettings] = useState<CommissionSettings | null>(null)
  const [report, setReport] = useState<CommissionReportRow[]>([])
  const [reportMeta, setReportMeta] = useState<{ period: string } | null>(null)
  const [topSellers, setTopSellers] = useState<TopSeller[]>([])
  const [topSellerPeriod, setTopSellerPeriod] = useState<"7" | "30" | "90">("30")
  const [collections, setCollections] = useState<CollectionRow[]>([])
  const [collectionSummary, setCollectionSummary] = useState<CollectionSummary | null>(null)
  const [collectionsAvailable, setCollectionsAvailable] = useState(true)

  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>("monthly")
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const TOP_SELLERS_PAGE_SIZE = 10
  const REPORT_BREAKDOWN_PAGE_SIZE = 12
  const [topSellersPage, setTopSellersPage] = useState(1)
  const [reportBreakdownPage, setReportBreakdownPage] = useState(1)

  const [settingsOpen, setSettingsOpen] = useState(false)
  const feeDialogOpenRef = useRef(false)
  const [ratePercentInput, setRatePercentInput] = useState("")
  const [savingRate, setSavingRate] = useState(false)
  const [saveRateFeedback, setSaveRateFeedback] = useState<{ type: "ok" | "warn" | "err"; text: string } | null>(null)

  useEffect(() => {
    feeDialogOpenRef.current = settingsOpen
  }, [settingsOpen])

  const [collForm, setCollForm] = useState({
    sellerAccount: "",
    sellerName: "",
    amount: "",
    periodStart: "",
    periodEnd: "",
    collectedBy: "",
    paymentMethod: "Mobile Money",
    referenceNumber: "",
    notes: "",
  })
  const [collSubmitting, setCollSubmitting] = useState(false)
  const [collFeedback, setCollFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(null)
  const [liveSellers, setLiveSellers] = useState<LiveSellerOption[]>([])
  const [liveSellersLoading, setLiveSellersLoading] = useState(false)
  const [useManualSellerAccount, setUseManualSellerAccount] = useState(false)
  const [sellerPickerOpen, setSellerPickerOpen] = useState(false)
  /** Controlled query — cmdk's built-in filter often stays empty inside Popover, so we filter the list ourselves. */
  const [sellerPickerQuery, setSellerPickerQuery] = useState("")
  const collSellerSelectSeq = useRef(0)

  const chartData = useMemo(() => {
    return [...report].sort((a, b) => a.date.localeCompare(b.date))
  }, [report])

  const reportSortedDesc = useMemo(
    () => [...report].sort((a, b) => b.date.localeCompare(a.date)),
    [report]
  )

  const reportBreakdownTotalPages = Math.max(1, Math.ceil(reportSortedDesc.length / REPORT_BREAKDOWN_PAGE_SIZE))
  const reportBreakdownPageSafe = Math.min(Math.max(1, reportBreakdownPage), reportBreakdownTotalPages)
  const reportBreakdownSlice = useMemo(() => {
    const start = (reportBreakdownPageSafe - 1) * REPORT_BREAKDOWN_PAGE_SIZE
    return reportSortedDesc.slice(start, start + REPORT_BREAKDOWN_PAGE_SIZE)
  }, [reportSortedDesc, reportBreakdownPageSafe])

  const topSellersTotalPages = Math.max(1, Math.ceil(topSellers.length / TOP_SELLERS_PAGE_SIZE))
  const topSellersPageSafe = Math.min(Math.max(1, topSellersPage), topSellersTotalPages)
  const topSellersSlice = useMemo(() => {
    const start = (topSellersPageSafe - 1) * TOP_SELLERS_PAGE_SIZE
    return topSellers.slice(start, start + TOP_SELLERS_PAGE_SIZE)
  }, [topSellers, topSellersPageSafe])

  const sellerAccountTriggerLabel = useMemo(() => {
    if (liveSellersLoading) return "Loading sellers…"
    if (liveSellers.length === 0) return "No live sellers found"
    if (!collForm.sellerAccount) return "Search seller by account or name…"
    const sel = liveSellers.find((x) => x.ishyigaAccount === collForm.sellerAccount)
    const label = sel ? formatSellerDisplayName(sel) : collForm.sellerName || collForm.sellerAccount
    return `${collForm.sellerAccount} — ${label}`
  }, [liveSellersLoading, liveSellers, collForm.sellerAccount, collForm.sellerName])

  const filteredLiveSellers = useMemo(
    () => liveSellers.filter((s) => sellerRowMatchesQuery(s, sellerPickerQuery)),
    [liveSellers, sellerPickerQuery]
  )

  useEffect(() => {
    setTopSellersPage(1)
  }, [topSellerPeriod])

  useEffect(() => {
    setReportBreakdownPage(1)
  }, [reportPeriod])

  useEffect(() => {
    setTopSellersPage((p) => Math.min(p, Math.max(1, Math.ceil(topSellers.length / TOP_SELLERS_PAGE_SIZE) || 1)))
  }, [topSellers])

  useEffect(() => {
    setReportBreakdownPage((p) =>
      Math.min(p, Math.max(1, Math.ceil(reportSortedDesc.length / REPORT_BREAKDOWN_PAGE_SIZE) || 1))
    )
  }, [reportSortedDesc])

  const totals = useMemo(() => {
    return report.reduce(
      (acc, row) => ({
        orders: acc.orders + row.orderCount,
        revenue: acc.revenue + row.totalRevenue,
        commission: acc.commission + row.platformCommission,
      }),
      { orders: 0, revenue: 0, commission: 0 }
    )
  }, [report])

  const loadData = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!hasHydrated) return
      if (!adminEmail) {
        setError("Admin email missing — sign in as an admin user.")
        setLoading(false)
        return
      }

      const silent = opts?.silent
      if (silent) setRefreshing(true)
      else setLoading(true)
      setError(null)

      const base = { adminEmail }

      const [settingsRes, reportRes, sellersRes, collRes] = await Promise.all([
        adminPost({ ...base, action: "getCommissionSettings" }),
        adminPost({ ...base, action: "getCommissionReport", period: reportPeriod }),
        adminPost({ ...base, action: "getTopSellers", period: topSellerPeriod }),
        adminPost({ ...base, action: "getCommissionCollections" }),
      ])

      if (settingsRes.ok && settingsRes.data?.settings) {
        const nextSettings = settingsRes.data.settings as CommissionSettings
        setSettings(nextSettings)
        if (!feeDialogOpenRef.current) {
          setRatePercentInput(commissionPercentInputFromSettings(nextSettings))
        }
      }

      if (reportRes.ok && Array.isArray(reportRes.data?.data)) {
        setReport(reportRes.data.data as CommissionReportRow[])
        setReportMeta({ period: String(reportRes.data.period || reportPeriod) })
      } else {
        setReport([])
        setReportMeta(null)
      }

      if (sellersRes.ok && Array.isArray(sellersRes.data?.sellers)) {
        setTopSellers(sellersRes.data.sellers as TopSeller[])
      } else {
        setTopSellers([])
      }

      if (collRes.ok) {
        setCollectionsAvailable(true)
        setCollections(Array.isArray(collRes.data?.collections) ? collRes.data.collections : [])
        setCollectionSummary((collRes.data?.summary as CollectionSummary) || null)
      } else if (!silent) {
        setCollectionsAvailable(false)
        setCollections([])
        setCollectionSummary(null)
      }

      let errMsg: string | null = null
      if (!reportRes.ok) errMsg = reportRes.rawError || "Could not load commission report."
      else if (!settingsRes.ok) errMsg = settingsRes.rawError || "Could not load commission settings."
      setError(errMsg)

      if (silent) setRefreshing(false)
      else setLoading(false)
    },
    [adminEmail, hasHydrated, reportPeriod, topSellerPeriod]
  )

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (adminEmail) {
      setCollForm((c) => ({ ...c, collectedBy: c.collectedBy || adminEmail }))
    }
  }, [adminEmail])

  useEffect(() => {
    if (!hasHydrated || !adminEmail) return
    let cancelled = false
    ;(async () => {
      setLiveSellersLoading(true)
      const accum: LiveSellerOption[] = []
      let page = 1
      const pageSize = 250
      try {
        while (!cancelled) {
          const res = await adminPost({
            adminEmail,
            action: "getActiveSellers",
            page: String(page),
            pageSize: String(pageSize),
          })
          if (!res.ok || !Array.isArray(res.data?.sellers)) break
          const batch = res.data.sellers as LiveSellerOption[]
          accum.push(...batch)
          const total = Number(res.data.totalCount) ?? accum.length
          if (accum.length >= total || batch.length < pageSize) break
          page += 1
          if (page > 80) break
        }
        if (!cancelled) {
          const byAccount = new Map<string, LiveSellerOption>()
          for (const s of accum) {
            const acc = String(s.ishyigaAccount ?? "").trim()
            if (!acc || byAccount.has(acc)) continue
            byAccount.set(acc, { ...s, ishyigaAccount: acc })
          }
          const unique = Array.from(byAccount.values()).sort((a, b) =>
            a.ishyigaAccount.localeCompare(b.ishyigaAccount)
          )
          setLiveSellers(unique)
        }
      } finally {
        if (!cancelled) setLiveSellersLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [hasHydrated, adminEmail])

  const applySellerSelection = useCallback(
    async (acc: string) => {
      const seq = ++collSellerSelectSeq.current
      const trimmed = acc.trim()
      if (!trimmed) {
        setCollForm((c) => ({ ...c, sellerAccount: "", sellerName: "", amount: "" }))
        return
      }
      const row = liveSellers.find((x) => x.ishyigaAccount === trimmed)
      const sellerName = row ? formatSellerDisplayName(row) : ""
      const amount = await suggestCollectionAmountRwf(trimmed, topSellers, topSellerPeriod, adminEmail)
      if (collSellerSelectSeq.current !== seq) return
      setCollForm((c) => ({ ...c, sellerAccount: trimmed, sellerName, amount }))
    },
    [liveSellers, topSellers, topSellerPeriod, adminEmail]
  )

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-RW", {
      style: "currency",
      currency: "RWF",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)

  const collectionAmountHint =
    topSellerPeriod === "7"
      ? "Prefills with platform commission on this seller's orders in the last 7 days (same window as Top sellers)."
      : topSellerPeriod === "90"
        ? "Prefills with platform commission on this seller's orders in the last 90 days (same window as Top sellers)."
        : "Prefills with platform commission on this seller's orders in the last 30 days (same window as Top sellers)."

  const onRecordCollection = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setCollFeedback(null)
    const sellerAccount = collForm.sellerAccount.trim()
    const sellerNameForRecord = collForm.sellerName.trim()
    const amountRaw = collForm.amount.replace(/,/g, ".").trim()
    if (!sellerAccount || !amountRaw) {
      setCollFeedback({ type: "err", text: "Seller account and amount are required." })
      return
    }
    const amountNum = parseFloat(amountRaw)
    if (Number.isNaN(amountNum) || amountNum <= 0) {
      setCollFeedback({ type: "err", text: "Enter a valid positive amount (RWF)." })
      return
    }

    setCollSubmitting(true)
    const { ok, data } = await adminPost({
      adminEmail,
      action: "recordCommissionCollection",
      sellerAccount,
      sellerName: sellerNameForRecord,
      amount: String(amountNum),
      periodStart: collForm.periodStart.trim(),
      periodEnd: collForm.periodEnd.trim(),
      collectedBy: collForm.collectedBy.trim(),
      paymentMethod: collForm.paymentMethod.trim(),
      referenceNumber: collForm.referenceNumber.trim(),
      notes: collForm.notes.trim(),
    })
    setCollSubmitting(false)

    if (ok) {
      const baseMsg = (data?.message as string) || "Commission collection recorded."
      const warn = data?.warning ? String(data.warningMessage ?? "").trim() : ""
      setCollFeedback({
        type: "ok",
        text: warn ? `${baseMsg} — ${warn}` : baseMsg,
      })

      const collectionId = Number(data?.collectionId)
      const amountCollected = Number(data?.amountCollected ?? amountNum)
      const collectionDate = String(
        (data?.collectionDate as string) || new Date().toISOString()
      )
      if (Number.isFinite(collectionId) && collectionId > 0) {
        const optimisticRow: CollectionRow = {
          id: collectionId,
          sellerAccount,
          sellerName: sellerNameForRecord || sellerAccount,
          amountCollected: Number.isFinite(amountCollected) ? amountCollected : amountNum,
          collectionDate,
          status: "completed",
        }
        setCollections((prev) => {
          const rest = prev.filter((c) => c.id !== collectionId)
          return [optimisticRow, ...rest]
        })
        setCollectionsAvailable(true)
        setCollectionSummary((prev) => {
          if (!prev) {
            const ac = optimisticRow.amountCollected
            return {
              totalCollections: 1,
              totalCollected: ac,
              averageCollection: ac,
              firstCollectionDate: collectionDate,
              lastCollectionDate: collectionDate,
            }
          }
          const n = (prev.totalCollections ?? 0) + 1
          const tot = (prev.totalCollected ?? 0) + optimisticRow.amountCollected
          return {
            ...prev,
            totalCollections: n,
            totalCollected: tot,
            averageCollection: n > 0 ? tot / n : prev.averageCollection,
            lastCollectionDate: collectionDate,
          }
        })
      }

      setUseManualSellerAccount(false)
      setSellerPickerOpen(false)
      setCollForm((c) => ({
        ...c,
        sellerAccount: "",
        sellerName: "",
        amount: "",
        periodStart: "",
        periodEnd: "",
        referenceNumber: "",
        notes: "",
      }))
      await loadData({ silent: true })
    } else {
      setCollFeedback({ type: "err", text: (data?.error as string) || "Failed to record collection." })
    }
  }

  const onSaveRate = async () => {
    const pct = parseFloat(ratePercentInput.replace(",", "."))
    if (Number.isNaN(pct) || pct < 0 || pct > 100) {
      setSaveRateFeedback({
        type: "err",
        text: "Enter a valid percent between 0 and 100 (e.g. 0.1 for 0.1%).",
      })
      return
    }
    const rate = pct / 100
    setSavingRate(true)
    setSaveRateFeedback(null)
    const { ok, data } = await adminPost({
      adminEmail,
      action: "updateCommissionSettings",
      rate: String(rate),
    })
    setSavingRate(false)
    if (ok) {
      const msg =
        (data?.message as string) || "Platform commission rate saved."
      const warning = data?.warning === true
      setSaveRateFeedback({ type: warning ? "warn" : "ok", text: msg })
      const effective = Number(data?.currentRate)
      const requestedRaw = Number(data?.requestedRate)
      const requested = Number.isFinite(requestedRaw) ? requestedRaw : rate
      const src = String(data?.rateSource ?? "")
      if (Number.isFinite(effective)) {
        setSettings((prev) => ({
          description: prev?.description ?? "Platform commission rate applied to all orders",
          platformFee: effective,
          platformFeePercent: effective * 100,
          databaseRate: requested,
          databaseRatePercent: requested * 100,
          rateSource: src || prev?.rateSource,
        }))
      }
      setRatePercentInput(formatPercentForInput(pct))
      await loadData({ silent: true })
    } else {
      setSaveRateFeedback({ type: "err", text: (data?.error as string) || "Update failed." })
    }
  }

  if (!hasHydrated || loading) {
    return (
      <div className="flex min-h-[18rem] flex-col items-center justify-center gap-3 text-slate-500">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p>Loading commission & billing…</p>
      </div>
    )
  }

  if (!adminEmail) {
    return (
      <Card className="border-amber-200 bg-amber-50/80">
        <CardHeader>
          <CardTitle className="text-amber-900">Admin sign-in required</CardTitle>
          <CardDescription>
            Commission endpoints require a verified admin email. Sign in with an account where{" "}
            <code className="rounded bg-white/80 px-1">TYPE = ADMIN</code> in the backend.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="min-h-0 space-y-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 p-6 text-white shadow-lg sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-emerald-500/15 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Commission & billing</h1>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="bg-white/10 text-white hover:bg-white/20"
              disabled={refreshing}
              onClick={() => loadData({ silent: true })}
            >
              <RefreshCw className={cn("mr-2 h-4 w-4", refreshing && "animate-spin")} />
              Refresh
            </Button>
            <Button
              type="button"
              size="sm"
              className="bg-white text-slate-900 hover:bg-slate-100"
              onClick={() => {
                setSaveRateFeedback(null)
                if (settings) setRatePercentInput(commissionPercentInputFromSettings(settings))
                setSettingsOpen(true)
              }}
            >
              <Settings className="mr-2 h-4 w-4" />
              Fee settings
            </Button>
          </div>
        </div>

        <div className="relative mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Period commission</p>
            <p className="mt-1 text-2xl font-bold text-emerald-300">{formatCurrency(totals.commission)}</p>
            <p className="text-xs text-slate-400">
              {reportMeta?.period === "daily" && "Last 24h"}
              {reportMeta?.period === "weekly" && "Last 7 days"}
              {reportMeta?.period === "monthly" && "Last 30 days"}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Gross revenue</p>
            <p className="mt-1 text-2xl font-bold text-white">{formatCurrency(totals.revenue)}</p>
            <p className="text-xs text-slate-400">{totals.orders} orders in window</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Configured rate</p>
            <p className="mt-1 text-2xl font-bold text-blue-200">
              {settings ? `${formatPercentForInput(settings.platformFeePercent)}%` : "—"}
            </p>
            <p className="text-xs text-slate-400">Applied as AMOUNT × rate</p>
            {settings?.rateSource && (
              <p className="mt-2 text-[11px] leading-snug text-slate-400">
                Source: {commissionRateSourceLabel(settings.rateSource)}
              </p>
            )}
            {settings &&
              settings.databaseRatePercent != null &&
              Number.isFinite(settings.databaseRatePercent) &&
              Math.abs(settings.platformFeePercent - settings.databaseRatePercent) > 1e-9 && (
                <p className="mt-1 text-[11px] leading-snug text-amber-200/90">
                  Saved in DB: {formatPercentForInput(settings.databaseRatePercent)}% (effective rate above may differ)
                </p>
              )}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="border-slate-200/80 shadow-sm xl:col-span-2">
          <CardHeader className="flex flex-col gap-4 border-b border-slate-100 bg-slate-50/50 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
                Commission vs revenue
              </CardTitle>
              <CardDescription>Daily buckets from the report API (non-cancelled orders).</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Label htmlFor="report-period" className="sr-only">
                Report period
              </Label>
              <select
                id="report-period"
                value={reportPeriod}
                onChange={(e) => setReportPeriod(e.target.value as ReportPeriod)}
                className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              >
                <option value="daily">Daily (1 day)</option>
                <option value="weekly">Weekly (7 days)</option>
                <option value="monthly">Monthly (30 days)</option>
              </select>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-[300px] w-full min-w-0 sm:h-[340px]">
              {chartData.length === 0 ? (
                <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
                  No orders in this period — chart will appear when data exists.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="fillComm" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="fillRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} className="text-slate-500" />
                    <YAxis tick={{ fontSize: 11 }} className="text-slate-500" />
                    <Tooltip
                      formatter={(v: number, name) => [formatCurrency(v), name === "totalRevenue" ? "Revenue" : "Commission"]}
                      labelClassName="text-slate-700"
                      contentStyle={{ borderRadius: 8 }}
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="totalRevenue"
                      name="Revenue"
                      stroke="#2563eb"
                      fill="url(#fillRev)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="platformCommission"
                      name="Commission"
                      stroke="#059669"
                      fill="url(#fillComm)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Percent className="h-5 w-5 text-blue-600" />
              Rate card
            </CardTitle>
            <CardDescription>Values returned by getCommissionSettings.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {settings ? (
              <>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-xs font-medium uppercase text-slate-500">Effective rate</p>
                  <p className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
                    {formatPercentForInput(settings.platformFeePercent)}%
                  </p>
                  <p className="mt-2 text-xs text-slate-600">{settings.description}</p>
                  <p className="mt-3 font-mono text-xs text-slate-500">
                    Decimal (effective): {settings.platformFee}
                  </p>
                  {settings.databaseRatePercent != null &&
                    Number.isFinite(settings.databaseRatePercent) &&
                    Math.abs(settings.platformFeePercent - settings.databaseRatePercent) > 1e-9 && (
                      <p className="mt-2 text-xs text-slate-600">
                        <span className="font-medium text-slate-700">Saved in database: </span>
                        {formatPercentForInput(settings.databaseRatePercent)}% (decimal{" "}
                        {settings.databaseRate})
                      </p>
                    )}
                  <p className="mt-3 text-xs text-slate-600">
                    <span className="font-medium text-slate-700">Source: </span>
                    {commissionRateSourceLabel(settings.rateSource)}
                  </p>
                  {settings.rateSource === "environment" && (
                    <p className="mt-2 text-xs text-amber-800/90">
                      The env variable overrides any value saved from this UI. Unset it to use the database rate.
                    </p>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  Changes are stored in MySQL and apply immediately unless <code className="rounded bg-slate-100 px-1">KAOS_PLATFORM_COMMISSION_RATE</code> is set.
                </p>
              </>
            ) : (
              <p className="text-sm text-slate-500">Settings not loaded.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top sellers */}
      <Card className="border-slate-200/80 shadow-sm">
        <CardHeader className="flex flex-col gap-4 border-b border-slate-100 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Wallet className="h-5 w-5 text-violet-600" />
              Top sellers by commission
            </CardTitle>
          </div>
          <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
            {(["7", "30", "90"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setTopSellerPeriod(d)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  topSellerPeriod === d ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                )}
              >
                {d}d
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="mb-6 h-[220px] w-full min-w-0 sm:h-[260px]">
            {topSellers.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
                No seller commission data for this range.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topSellersSlice.slice(0, 8).map((s) => ({
                    name: (s.name || s.ishyigaAccount || "?").slice(0, 14),
                    commission: s.totalCommission,
                  }))}
                  layout="vertical"
                  margin={{ left: 8, right: 16 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-slate-200" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="commission" name="Commission" fill="#7c3aed" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <ResponsiveTable className="rounded-lg border border-slate-100" minWidth="880px">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-left">
                  <th className="px-4 py-3 font-semibold text-slate-700">Seller</th>
                  <th className="px-4 py-3 font-semibold text-slate-700">Sector</th>
                  <th className="px-4 py-3 font-semibold text-slate-700">Orders</th>
                  <th className="px-4 py-3 font-semibold text-slate-700">Revenue</th>
                  <th className="px-4 py-3 font-semibold text-slate-700">Commission</th>
                  <th className="px-4 py-3 font-semibold text-slate-700">Growth</th>
                </tr>
              </thead>
              <tbody>
                {topSellers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                      No rows.
                    </td>
                  </tr>
                ) : (
                  topSellersSlice.map((s) => (
                    <tr key={s.ishyigaAccount} className="border-b border-slate-100 hover:bg-slate-50/80">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{s.name || "—"}</div>
                        <div className="font-mono text-xs text-slate-500">{s.ishyigaAccount}</div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className="font-normal">
                          {s.sector || "—"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">{s.orderCount}</td>
                      <td className="px-4 py-3 font-medium">{formatCurrency(s.totalRevenue)}</td>
                      <td className="px-4 py-3 font-semibold text-emerald-700">{formatCurrency(s.totalCommission)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 font-medium",
                            (s.growth ?? 0) >= 0 ? "text-emerald-600" : "text-red-600"
                          )}
                        >
                          {(s.growth ?? 0) >= 0 ? (
                            <ArrowUpRight className="h-4 w-4" />
                          ) : (
                            <TrendingDown className="h-4 w-4" />
                          )}
                          {(s.growth ?? 0).toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </ResponsiveTable>
          <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Page {topSellersPageSafe} of {topSellersTotalPages}
              {topSellers.length > 0 && (
                <span className="text-slate-400">
                  {" "}
                  ({topSellers.length} sellers)
                </span>
              )}
            </span>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={topSellersPageSafe <= 1}
                onClick={() => setTopSellersPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={topSellersPageSafe >= topSellersTotalPages}
                onClick={() => setTopSellersPage((p) => Math.min(topSellersTotalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Record commission collection — AdminServlet.recordCommissionCollection */}
      <Card className="border border-emerald-200/80 bg-gradient-to-br from-emerald-50/50 via-white to-slate-50 shadow-sm">
        <CardHeader className="border-b border-emerald-100/80 bg-emerald-50/40">
          <CardTitle className="flex items-center gap-2 text-lg text-emerald-950">
            <Banknote className="h-5 w-5 text-emerald-700" />
            Record commission collection
          </CardTitle>
          <CardDescription className="text-emerald-900/70">
            Saves to <span className="font-medium">commission_collections</span> (seller account and amount required).
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={onRecordCollection} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label htmlFor="coll-seller-account">Seller account *</Label>
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300"
                      checked={useManualSellerAccount}
                      onChange={(e) => {
                        setUseManualSellerAccount(e.target.checked)
                        setSellerPickerOpen(false)
                        setCollForm((c) => ({ ...c, sellerAccount: "", sellerName: "", amount: "" }))
                      }}
                    />
                    Enter account manually
                  </label>
                </div>
                {useManualSellerAccount ? (
                  <Input
                    id="coll-seller-account"
                    required
                    autoComplete="off"
                    placeholder="ISHYIGA account code"
                    value={collForm.sellerAccount}
                    onChange={(e) => setCollForm((c) => ({ ...c, sellerAccount: e.target.value }))}
                  />
                ) : (
                  <Popover
                    open={sellerPickerOpen}
                    onOpenChange={(open) => {
                      setSellerPickerOpen(open)
                      if (open) setSellerPickerQuery("")
                    }}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        id="coll-seller-account"
                        variant="outline"
                        role="combobox"
                        aria-expanded={sellerPickerOpen}
                        disabled={liveSellersLoading || liveSellers.length === 0}
                        className={cn(
                          "h-10 w-full justify-between font-normal",
                          !collForm.sellerAccount && "text-muted-foreground"
                        )}
                      >
                        <span className="truncate text-left">{sellerAccountTriggerLabel}</span>
                        {liveSellersLoading ? (
                          <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin opacity-50" />
                        ) : (
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[var(--radix-popover-trigger-width)] max-w-[min(100vw-1.5rem,28rem)] p-0"
                      align="start"
                    >
                      {/* Plain input + list: cmdk CommandInput does not reliably sync controlled search inside Popover. */}
                      <div className="flex h-10 items-center gap-2 border-b border-border px-3">
                        <SellerPickerSearchIcon className="size-4 shrink-0 opacity-50" />
                        <Input
                          value={sellerPickerQuery}
                          onChange={(e) => setSellerPickerQuery(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") e.preventDefault()
                          }}
                          className="h-9 flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                          placeholder="Search account, name, email…"
                          autoComplete="off"
                          aria-label="Search sellers"
                        />
                      </div>
                      <div
                        className="max-h-[300px] overflow-y-auto overflow-x-hidden p-1"
                        role="listbox"
                        aria-label="Seller results"
                      >
                        {collForm.sellerAccount && clearSellerRowMatchesQuery(sellerPickerQuery) ? (
                          <button
                            type="button"
                            role="option"
                            className="flex w-full rounded-sm px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                            onClick={() => {
                              void applySellerSelection("")
                              setSellerPickerOpen(false)
                            }}
                          >
                            Clear selection
                          </button>
                        ) : null}
                        {filteredLiveSellers.length === 0 ? (
                          <p className="py-6 text-center text-sm text-muted-foreground">No seller matches.</p>
                        ) : (
                          filteredLiveSellers.map((s) => {
                            const display = formatSellerDisplayName(s)
                            const selected = collForm.sellerAccount === s.ishyigaAccount
                            return (
                              <button
                                key={`${s.id}-${s.ishyigaAccount}`}
                                type="button"
                                role="option"
                                aria-selected={selected}
                                className={cn(
                                  "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none",
                                  "hover:bg-accent hover:text-accent-foreground",
                                  selected && "bg-accent/70"
                                )}
                                onClick={() => {
                                  void applySellerSelection(s.ishyigaAccount)
                                  setSellerPickerOpen(false)
                                }}
                              >
                                <Check
                                  className={cn("size-4 shrink-0", selected ? "opacity-100" : "opacity-0")}
                                  aria-hidden
                                />
                                <span className="min-w-0 truncate">
                                  <span className="font-medium">{s.ishyigaAccount}</span>
                                  <span className="text-muted-foreground"> — {display}</span>
                                  {s.email?.trim() ? (
                                    <span className="mt-0.5 block truncate text-xs text-muted-foreground/90">
                                      {s.email.trim()}
                                    </span>
                                  ) : null}
                                </span>
                              </button>
                            )
                          })
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="coll-seller-name">Seller name</Label>
                <Input
                  id="coll-seller-name"
                  placeholder={
                    useManualSellerAccount
                      ? "Optional display name"
                      : "Auto-filled from selection; you can edit"
                  }
                  value={collForm.sellerName}
                  onChange={(e) => setCollForm((c) => ({ ...c, sellerName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="coll-amount">Amount collected (RWF) *</Label>
                <Input
                  id="coll-amount"
                  required
                  inputMode="decimal"
                  placeholder="e.g. 15000"
                  value={collForm.amount}
                  onChange={(e) => setCollForm((c) => ({ ...c, amount: e.target.value }))}
                />
                <p className="text-xs text-slate-500">{collectionAmountHint} You can edit the value.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="coll-payment">Payment method</Label>
                <select
                  id="coll-payment"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={collForm.paymentMethod}
                  onChange={(e) => setCollForm((c) => ({ ...c, paymentMethod: e.target.value }))}
                >
                  <option value="Mobile Money">Mobile Money</option>
                  <option value="Bank transfer">Bank transfer</option>
                  <option value="Cash">Cash</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="coll-period-start">Period start</Label>
                <Input
                  id="coll-period-start"
                  type="date"
                  value={collForm.periodStart}
                  onChange={(e) => setCollForm((c) => ({ ...c, periodStart: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="coll-period-end">Period end</Label>
                <Input
                  id="coll-period-end"
                  type="date"
                  value={collForm.periodEnd}
                  onChange={(e) => setCollForm((c) => ({ ...c, periodEnd: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="coll-collected-by">Collected by</Label>
                <Input
                  id="coll-collected-by"
                  placeholder="Admin name or email"
                  value={collForm.collectedBy}
                  onChange={(e) => setCollForm((c) => ({ ...c, collectedBy: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="coll-reference">Reference number</Label>
                <Input
                  id="coll-reference"
                  placeholder="Txn / receipt ref"
                  value={collForm.referenceNumber}
                  onChange={(e) => setCollForm((c) => ({ ...c, referenceNumber: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="coll-notes">Notes</Label>
              <Textarea
                id="coll-notes"
                rows={3}
                placeholder="Optional notes for this collection"
                value={collForm.notes}
                onChange={(e) => setCollForm((c) => ({ ...c, notes: e.target.value }))}
              />
            </div>
            {collFeedback && (
              <div
                className={cn(
                  "rounded-lg border px-4 py-3 text-sm",
                  collFeedback.type === "ok"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                    : "border-red-200 bg-red-50 text-red-800"
                )}
              >
                {collFeedback.text}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={collSubmitting} className="bg-emerald-700 hover:bg-emerald-800">
                {collSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save collection"
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCollFeedback(null)
                  setUseManualSellerAccount(false)
                  setSellerPickerOpen(false)
                  setCollForm({
                    sellerAccount: "",
                    sellerName: "",
                    amount: "",
                    periodStart: "",
                    periodEnd: "",
                    collectedBy: adminEmail,
                    paymentMethod: "Mobile Money",
                    referenceNumber: "",
                    notes: "",
                  })
                }}
              >
                Clear form
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Collections + pending */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="border-slate-200/80 shadow-sm lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Landmark className="h-5 w-5 text-amber-600" />
              Collections
            </CardTitle>
            <CardDescription>getCommissionCollections summary.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!collectionsAvailable ? (
              <p className="text-sm text-slate-500">
                Ledger table unavailable or DB error — other commission data still loads.
              </p>
            ) : collectionSummary ? (
              <>
                <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <span className="text-sm text-slate-600">Collected (completed)</span>
                  <span className="font-semibold text-slate-900">
                    {formatCurrency(collectionSummary.totalCollected ?? 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <span className="text-sm text-slate-600"># Collections</span>
                  <span className="font-semibold">{collectionSummary.totalCollections ?? 0}</span>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3">
                  <p className="text-xs font-medium uppercase text-amber-900/80">Pending (30d)</p>
                  <p className="mt-1 text-lg font-bold text-amber-950">
                    {formatCurrency(collectionSummary.totalPendingCommission ?? 0)}
                  </p>
                  <p className="text-xs text-amber-900/70">
                    {collectionSummary.sellersWithPendingCommission ?? 0} sellers with volume
                  </p>
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-500">No summary returned.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Collection history</CardTitle>
            <CardDescription>Rows from commission_collections (when present).</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveTable minWidth="720px">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-left">
                    <th className="px-3 py-2 font-semibold text-slate-700">Seller</th>
                    <th className="px-3 py-2 font-semibold text-slate-700">Amount</th>
                    <th className="px-3 py-2 font-semibold text-slate-700">Date</th>
                    <th className="px-3 py-2 font-semibold text-slate-700">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {!collectionsAvailable || collections.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-8 text-center text-slate-500">
                        No collection rows.
                      </td>
                    </tr>
                  ) : (
                    collections.map((c) => (
                      <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                        <td className="px-3 py-2">
                          <div className="font-medium text-slate-900">{c.sellerName || c.sellerAccount}</div>
                          <div className="font-mono text-xs text-slate-500">{c.sellerAccount}</div>
                        </td>
                        <td className="px-3 py-2 font-medium text-emerald-700">{formatCurrency(c.amountCollected)}</td>
                        <td className="px-3 py-2 text-slate-600">{c.collectionDate?.slice(0, 16) || "—"}</td>
                        <td className="px-3 py-2">
                          <Badge variant={c.status === "completed" ? "default" : "secondary"}>{c.status || "—"}</Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </ResponsiveTable>
          </CardContent>
        </Card>
      </div>

      {/* Detail table report */}
      <Card className="border-slate-200/80 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <DollarSign className="h-5 w-5 text-slate-700" />
            Period breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveTable minWidth="640px">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-left">
                  <th className="px-4 py-3 font-semibold text-slate-700">Date</th>
                  <th className="px-4 py-3 font-semibold text-slate-700">Orders</th>
                  <th className="px-4 py-3 font-semibold text-slate-700">Revenue</th>
                  <th className="px-4 py-3 font-semibold text-slate-700">Commission</th>
                </tr>
              </thead>
              <tbody>
                {report.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                      No commission data for this period.
                    </td>
                  </tr>
                ) : (
                  reportBreakdownSlice.map((row, idx) => (
                    <tr key={`${row.date}-${idx}`} className="border-b border-slate-100 hover:bg-slate-50/80">
                      <td className="px-4 py-3 text-slate-900">{row.date}</td>
                      <td className="px-4 py-3">{row.orderCount}</td>
                      <td className="px-4 py-3 font-medium">{formatCurrency(row.totalRevenue)}</td>
                      <td className="px-4 py-3 font-semibold text-emerald-700">
                        {formatCurrency(row.platformCommission)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </ResponsiveTable>
          <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Page {reportBreakdownPageSafe} of {reportBreakdownTotalPages}
              {reportSortedDesc.length > 0 && (
                <span className="text-slate-400">
                  {" "}
                  ({reportSortedDesc.length} days)
                </span>
              )}
            </span>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={reportBreakdownPageSafe <= 1}
                onClick={() => setReportBreakdownPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={reportBreakdownPageSafe >= reportBreakdownTotalPages}
                onClick={() => setReportBreakdownPage((p) => Math.min(reportBreakdownTotalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={settingsOpen} onOpenChange={(open) => {
        setSettingsOpen(open)
        if (!open) setSaveRateFeedback(null)
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Platform commission rate</DialogTitle>
            <DialogDescription>
              Enter a percentage between 0 and 100 (e.g. <span className="font-medium">0.1</span> for 0.1%). The server
              stores <code className="rounded bg-slate-100 px-1">rate = percent / 100</code> and uses it for commission
              unless <code className="rounded bg-slate-100 px-1">KAOS_PLATFORM_COMMISSION_RATE</code> is set in the
              environment.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="rate-pct">Percent (%)</Label>
            <Input
              id="rate-pct"
              inputMode="decimal"
              placeholder="e.g. 0.1"
              value={ratePercentInput}
              onChange={(e) => setRatePercentInput(e.target.value)}
            />
            {saveRateFeedback && (
              <p
                className={cn(
                  "text-sm",
                  saveRateFeedback.type === "err" && "text-red-700",
                  saveRateFeedback.type === "warn" && "text-amber-900",
                  saveRateFeedback.type === "ok" && "text-emerald-800"
                )}
              >
                {saveRateFeedback.text}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSettingsOpen(false)}>
              Close
            </Button>
            <Button type="button" disabled={savingRate} onClick={onSaveRate}>
              {savingRate ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit to backend"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
