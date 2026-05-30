"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import {
  buildUrubutoPaymentTimestamps,
  buildUrubutoReferenceDisplay,
  fetchSupplierUrubutoPayments,
  formatUrubutoPaymentMethod,
  formatUrubutoPaymentStatus,
  isCompactUrubutoReferencePanel,
  resolveEffectiveUrubutoPaymentStatus,
  type UrubutoPaymentRow,
  type UrubutoPaymentSummary,
} from "@/lib/urubuto-transactions"
import { cn } from "@/lib/utils"
import { useLanguageStore, type Language } from "@/lib/language-store"
import { ChevronDown, ChevronLeft, ChevronRight, Copy, CreditCard, Loader2, RefreshCw, Search, Smartphone, Wallet } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

type MethodFilter = "all" | "WALLET" | "CARD"
type StatusFilter = "all" | "PENDING" | "COMPLETED" | "FAILED"

const REPORT_UI: Record<Language, {
  transactionReport: string
  description: string
  refresh: string
  totalPayments: string
  momoWallet: string
  walletChannel: string
  card: string
  cardChannel: string
  completedRwf: string
  completedSummary: (paid: number, pending: number) => string
  allMethods: string
  momoOnly: string
  cardOnly: string
  allStatus: string
  pending: string
  completed: string
  failed: string
  cancelled: string
  paid: string
  from: string
  to: string
  searchRef: string
  searchPlaceholder: string
  noMatchingPayments: string
  showing: (from: number, to: number, total: number) => string
  clearFilters: string
  noTransactions: string
  when: string
  customer: string
  amount: string
  method: string
  status: string
  paymentIds: string
  paidAt: string
  recorded: string
  initiated: string
  attempted: string
  started: string
  guest: string
  customerFallback: string
  orderNumber: (id: number) => string
  moreReferences: string
  perPage: string
  previous: string
  next: string
  pageOf: (page: number, total: number) => string
  copied: string
  couldNotLoad: string
}> = {
  en: {
    transactionReport: "Transaction report",
    description: "All UrubutoPay payments at your shop — MoMo wallet and card (IHUTE checkout & POS).",
    refresh: "Refresh",
    totalPayments: "Total payments",
    momoWallet: "MoMo wallet",
    walletChannel: "WALLET channel",
    card: "Card",
    cardChannel: "CARD channel",
    completedRwf: "Completed (RWF)",
    completedSummary: (paid, pending) => `${paid} paid · ${pending} pending`,
    allMethods: "All methods",
    momoOnly: "MoMo only",
    cardOnly: "Card only",
    allStatus: "All status",
    pending: "Pending",
    completed: "Completed",
    failed: "Failed",
    cancelled: "Cancelled",
    paid: "Paid",
    from: "From",
    to: "To",
    searchRef: "Search ref",
    searchPlaceholder: "IHUTE ref, MoMo FT, cart, payer...",
    noMatchingPayments: "No matching payments",
    showing: (from, to, total) => `Showing ${from}-${to} of ${total}`,
    clearFilters: "Clear filters",
    noTransactions: "No transactions match these filters yet. When customers pay with UrubutoPay (MoMo or card) at checkout, they appear here.",
    when: "When",
    customer: "Customer",
    amount: "Amount",
    method: "Method",
    status: "Status",
    paymentIds: "Payment IDs",
    paidAt: "Paid at",
    recorded: "Recorded",
    initiated: "Initiated",
    attempted: "Attempted",
    started: "Started",
    guest: "Guest",
    customerFallback: "Customer",
    orderNumber: (id) => `Order #${id}`,
    moreReferences: "More references",
    perPage: "Per page",
    previous: "Previous",
    next: "Next",
    pageOf: (page, total) => `Page ${page} of ${total}`,
    copied: "Copied",
    couldNotLoad: "Could not load transactions",
  },
  rw: {
    transactionReport: "Raporo y'ubwishyu",
    description: "Ubwishyu bwose bwa UrubutoPay ku iduka ryawe — MoMo wallet na card (IHUTE checkout & POS).",
    refresh: "Vugurura",
    totalPayments: "Ubwishyu bwose",
    momoWallet: "MoMo wallet",
    walletChannel: "Uburyo bwa WALLET",
    card: "Card",
    cardChannel: "Uburyo bwa CARD",
    completedRwf: "Ubwishyu bwuzuye (RWF)",
    completedSummary: (paid, pending) => `${paid} byishyuwe · ${pending} bitegereje`,
    allMethods: "Uburyo bwose",
    momoOnly: "MoMo gusa",
    cardOnly: "Card gusa",
    allStatus: "Imiterere yose",
    pending: "Bitegereje",
    completed: "Byuzuye",
    failed: "Byanze",
    cancelled: "Byahagaritswe",
    paid: "Byishyuwe",
    from: "Kuva",
    to: "Kugeza",
    searchRef: "Shaka ref",
    searchPlaceholder: "IHUTE ref, MoMo FT, cart, uwishyuye...",
    noMatchingPayments: "Nta bwishyu buhuye",
    showing: (from, to, total) => `Birerekana ${from}-${to} kuri ${total}`,
    clearFilters: "Kuraho amayungurura",
    noTransactions: "Nta bwishyu buhuye n'aya mayungurura. Abakiriya nibishyura na UrubutoPay (MoMo cyangwa card), bizagaragara hano.",
    when: "Igihe",
    customer: "Umukiriya",
    amount: "Amafaranga",
    method: "Uburyo",
    status: "Imiterere",
    paymentIds: "ID z'ubwishyu",
    paidAt: "Yishyuwe",
    recorded: "Yanditswe",
    initiated: "Yatangiye",
    attempted: "Yageragejwe",
    started: "Yatangiye",
    guest: "Umushyitsi",
    customerFallback: "Umukiriya",
    orderNumber: (id) => `Komande #${id}`,
    moreReferences: "Izindi references",
    perPage: "Kuri page",
    previous: "Ibibanza",
    next: "Ibikurikira",
    pageOf: (page, total) => `Page ${page} kuri ${total}`,
    copied: "Byakoporowe",
    couldNotLoad: "Ntibyashobotse gufungura transactions",
  },
  fr: {
    transactionReport: "Rapport des transactions",
    description: "Tous les paiements UrubutoPay de votre boutique — portefeuille MoMo et carte (IHUTE checkout & POS).",
    refresh: "Actualiser",
    totalPayments: "Total des paiements",
    momoWallet: "Portefeuille MoMo",
    walletChannel: "Canal WALLET",
    card: "Carte",
    cardChannel: "Canal CARD",
    completedRwf: "Terminés (RWF)",
    completedSummary: (paid, pending) => `${paid} payé(s) · ${pending} en attente`,
    allMethods: "Tous les moyens",
    momoOnly: "MoMo seulement",
    cardOnly: "Carte seulement",
    allStatus: "Tous les statuts",
    pending: "En attente",
    completed: "Terminé",
    failed: "Échoué",
    cancelled: "Annulé",
    paid: "Payé",
    from: "Du",
    to: "Au",
    searchRef: "Rechercher ref",
    searchPlaceholder: "Réf. IHUTE, MoMo FT, panier, payeur...",
    noMatchingPayments: "Aucun paiement correspondant",
    showing: (from, to, total) => `Affichage ${from}-${to} sur ${total}`,
    clearFilters: "Effacer les filtres",
    noTransactions: "Aucune transaction ne correspond à ces filtres. Quand les clients paient avec UrubutoPay (MoMo ou carte), elles apparaissent ici.",
    when: "Date",
    customer: "Client",
    amount: "Montant",
    method: "Moyen",
    status: "Statut",
    paymentIds: "ID de paiement",
    paidAt: "Payé le",
    recorded: "Enregistré",
    initiated: "Initié",
    attempted: "Tentative",
    started: "Démarré",
    guest: "Invité",
    customerFallback: "Client",
    orderNumber: (id) => `Commande #${id}`,
    moreReferences: "Plus de références",
    perPage: "Par page",
    previous: "Précédent",
    next: "Suivant",
    pageOf: (page, total) => `Page ${page} sur ${total}`,
    copied: "Copié",
    couldNotLoad: "Impossible de charger les transactions",
  },
}

function methodLabel(method: string | undefined, ui: typeof REPORT_UI.en) {
  const { label, tone } = formatUrubutoPaymentMethod(method)
  if (tone === "momo") return { label: ui.momoWallet, tone }
  if (tone === "card") return { label: ui.card, tone }
  return { label, tone }
}

function statusLabel(status: string | undefined, ui: typeof REPORT_UI.en) {
  const { label, tone } = formatUrubutoPaymentStatus(status)
  const s = (status ?? "").toUpperCase()
  if (s === "COMPLETED") return { label: ui.paid, tone }
  if (s === "PENDING" || s === "INITIATED") return { label: ui.pending, tone }
  if (s === "FAILED") return { label: ui.failed, tone }
  if (s === "CANCELLED") return { label: ui.cancelled, tone }
  return { label, tone }
}

function timeLabel(label: string, ui: typeof REPORT_UI.en) {
  switch (label) {
    case "Paid at":
      return ui.paidAt
    case "Recorded":
      return ui.recorded
    case "Initiated":
      return ui.initiated
    case "Attempted":
      return ui.attempted
    case "Started":
      return ui.started
    default:
      return label
  }
}

function MethodBadge({ method, ui }: { method?: string; ui: typeof REPORT_UI.en }) {
  const { label, tone } = methodLabel(method, ui)
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-normal gap-1",
        tone === "momo" && "border-yellow-300 bg-yellow-50 text-yellow-900",
        tone === "card" && "border-blue-300 bg-blue-50 text-blue-900",
      )}
    >
      {tone === "momo" ? <Smartphone className="h-3 w-3" /> : tone === "card" ? <CreditCard className="h-3 w-3" /> : null}
      {label}
    </Badge>
  )
}

function RefCopyRow({
  label,
  value,
  variant = "default",
  compact = false,
  onCopy,
}: {
  label: string
  value: string
  variant?: "ihute" | "momo" | "slip" | "default"
  compact?: boolean
  onCopy: (v: string) => void
}) {
  if (!value) return null
  return (
    <div
      className={cn(
        "grid grid-cols-[5rem_1fr_auto] gap-x-2 gap-y-0.5 items-start border-b border-gray-100/80 last:border-0",
        compact ? "py-1" : "py-1.5",
      )}
    >
      <span className="text-[10px] font-medium uppercase tracking-wide text-gray-500 pt-0.5">{label}</span>
      <button
        type="button"
        onClick={() => onCopy(value)}
        className={cn(
          "text-left font-mono text-[11px] leading-snug break-all hover:underline",
          variant === "ihute" && "text-violet-800",
          variant === "momo" && "text-emerald-800 font-semibold",
          variant === "slip" && "text-sky-800",
          variant === "default" && "text-gray-800",
        )}
        title={value}
      >
        {value}
      </button>
      <button
        type="button"
        onClick={() => onCopy(value)}
        className="p-0.5 text-gray-400 hover:text-violet-700 shrink-0"
        aria-label={`Copy ${label}`}
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

function PaymentReferences({
  p,
  displayStatus,
  onCopy,
  ui,
}: {
  p: UrubutoPaymentRow
  displayStatus: string
  onCopy: (v: string) => void
  ui: typeof REPORT_UI.en
}) {
  const refs = buildUrubutoReferenceDisplay(p)
  if (!refs.ihuteRef) {
    return <span className="text-gray-400">—</span>
  }

  const compact = isCompactUrubutoReferencePanel(p, displayStatus)
  const hasMore = Boolean(refs.urubutoInternal || refs.cartRef)

  return (
    <div
      className={cn(
        "rounded-lg border border-violet-100 bg-white shadow-sm w-full",
        compact ? "min-w-[200px] max-w-[260px]" : "min-w-[240px] max-w-[300px] lg:min-w-[280px] lg:max-w-[360px]",
      )}
    >
      {!compact ? (
        <div className="px-2.5 py-2 border-b border-violet-50 bg-violet-50/40">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-800">{ui.paymentIds}</p>
        </div>
      ) : null}
      <div className={cn("px-2.5", compact ? "py-1.5" : "py-1")}>
        <RefCopyRow label="IHUTE" value={refs.ihuteRef} variant="ihute" compact={compact} onCopy={onCopy} />
        {refs.momoFtId ? <RefCopyRow label="SMS FT" value={refs.momoFtId} variant="momo" onCopy={onCopy} /> : null}
        {refs.telcoRef ? <RefCopyRow label="Telco" value={refs.telcoRef} variant="default" onCopy={onCopy} /> : null}
        {refs.slip ? <RefCopyRow label="Slip" value={refs.slip} variant="slip" onCopy={onCopy} /> : null}
      </div>
      {hasMore ? (
        <details className="group border-t border-gray-100">
          <summary
            className={cn(
              "flex cursor-pointer list-none items-center gap-1 px-2.5 text-[10px] font-medium text-gray-500 hover:bg-gray-50 [&::-webkit-details-marker]:hidden",
              compact ? "py-1" : "py-1.5",
            )}
          >
            <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
            {ui.moreReferences}
          </summary>
          <div className={cn("px-2.5 pt-0", compact ? "pb-1.5" : "pb-2")}>
            {refs.urubutoInternal ? (
              <RefCopyRow label="Urubuto" value={refs.urubutoInternal} compact={compact} onCopy={onCopy} />
            ) : null}
            {refs.cartRef ? <RefCopyRow label="Cart" value={refs.cartRef} compact={compact} onCopy={onCopy} /> : null}
          </div>
        </details>
      ) : null}
    </div>
  )
}

function PaymentWhenCell({ p, displayStatus, ui }: { p: UrubutoPaymentRow; displayStatus: string; ui: typeof REPORT_UI.en }) {
  const ts = buildUrubutoPaymentTimestamps(p, displayStatus)
  const primaryIsPaid = ts.primaryLabel === "Paid at"

  return (
    <>
      <p
        className={cn(
          "text-[10px] font-medium uppercase tracking-wide",
          primaryIsPaid ? "text-emerald-700" : "text-gray-500",
        )}
      >
        {timeLabel(ts.primaryLabel, ui)}
      </p>
      <p className={cn("text-sm leading-snug", primaryIsPaid && "text-emerald-900 font-medium")}>
        {ts.primaryAt ? ts.primaryAt.toLocaleString() : "—"}
      </p>
      {ts.secondaryLabel && ts.secondaryAt ? (
        <div className="mt-2">
          <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">{timeLabel(ts.secondaryLabel, ui)}</p>
          <p className="text-xs leading-snug text-gray-600">{ts.secondaryAt.toLocaleString()}</p>
        </div>
      ) : null}
    </>
  )
}

function StatusBadge({ status, ui }: { status?: string; ui: typeof REPORT_UI.en }) {
  const { label, tone } = statusLabel(status, ui)
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-normal capitalize",
        tone === "success" && "border-green-300 bg-green-50 text-green-900",
        tone === "pending" && "border-amber-300 bg-amber-50 text-amber-900",
        tone === "failed" && "border-red-300 bg-red-50 text-red-900",
      )}
    >
      {label}
    </Badge>
  )
}

function SummaryTile({
  label,
  value,
  sub,
  active,
  onClick,
}: {
  label: string
  value: string
  sub?: string
  active?: boolean
  onClick?: () => void
}) {
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
      className={cn(
        "rounded-lg border p-3 text-left transition-colors",
        onClick && "cursor-pointer hover:border-violet-400",
        active ? "border-violet-500 bg-violet-50 ring-1 ring-violet-300" : "border-gray-200 bg-white",
      )}
    >
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-semibold text-gray-900 mt-0.5">{value}</p>
      {sub ? <p className="text-xs text-gray-500 mt-0.5">{sub}</p> : null}
      </button>
    )
  }
  return (
    <div
      className={cn(
        "rounded-lg border p-3 text-left",
        active ? "border-violet-500 bg-violet-50 ring-1 ring-violet-300" : "border-gray-200 bg-white",
      )}
    >
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-semibold text-gray-900 mt-0.5">{value}</p>
      {sub ? <p className="text-xs text-gray-500 mt-0.5">{sub}</p> : null}
    </div>
  )
}

export function UrubutoTransactionReport({
  account,
  autoRefreshMs = 45000,
}: {
  account: string
  autoRefreshMs?: number
}) {
  const { toast } = useToast()
  const language = useLanguageStore((s) => s.language)
  const ui = REPORT_UI[language] ?? REPORT_UI.en
  const [loading, setLoading] = useState(true)
  const [payments, setPayments] = useState<UrubutoPaymentRow[]>([])
  const [summary, setSummary] = useState<UrubutoPaymentSummary | null>(null)
  const [methodFilter, setMethodFilter] = useState<MethodFilter>("all")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [pageSize, setPageSize] = useState(20)
  const [page, setPage] = useState(0)
  const [filteredTotal, setFilteredTotal] = useState(0)
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [searchQuery, setSearchQuery] = useState("")

  const totalPages = Math.max(1, Math.ceil(filteredTotal / pageSize))

  useEffect(() => {
    const id = setTimeout(() => {
      setSearchQuery(searchInput.trim())
    }, 200)
    return () => clearTimeout(id)
  }, [searchInput])

  const load = useCallback(async () => {
    if (!account) return
    setLoading(true)
    try {
      const res = await fetchSupplierUrubutoPayments({
        account,
        limit: pageSize,
        offset: page * pageSize,
        method: methodFilter,
        status: statusFilter,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        search: searchQuery || undefined,
      })
      if (!res.ok) {
        toast({ title: ui.couldNotLoad, description: res.error, variant: "destructive" })
        return
      }
      setPayments(res.payments)
      setSummary(res.summary ?? null)
      setFilteredTotal(res.filteredTotal ?? res.payments.length)
    } finally {
      setLoading(false)
    }
  }, [account, page, pageSize, methodFilter, statusFilter, dateFrom, dateTo, searchQuery, toast, ui.couldNotLoad])

  const resetFilters = () => {
    setMethodFilter("all")
    setStatusFilter("all")
    setDateFrom("")
    setDateTo("")
    setSearchInput("")
    setSearchQuery("")
    setPage(0)
  }

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setPage(0)
  }, [methodFilter, statusFilter, dateFrom, dateTo, searchQuery, pageSize])

  useEffect(() => {
    if (page > 0 && page >= totalPages) {
      setPage(Math.max(0, totalPages - 1))
    }
  }, [page, totalPages])

  useEffect(() => {
    if (!autoRefreshMs || !account) return
    const id = setInterval(() => void load(), autoRefreshMs)
    return () => clearInterval(id)
  }, [account, autoRefreshMs, load])

  const copyRef = (text: string) => {
    void navigator.clipboard.writeText(text)
    toast({ title: ui.copied, description: text.slice(0, 40) + (text.length > 40 ? "..." : "") })
  }

  return (
    <Card className="border-violet-200/80">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Wallet className="h-5 w-5 text-violet-700" />
              {ui.transactionReport}
            </CardTitle>
            <CardDescription>
              {ui.description}
            </CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-2">{ui.refresh}</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <SummaryTile
              label={ui.totalPayments}
              value={String(summary.totalCount)}
              active={methodFilter === "all" && statusFilter === "all"}
              onClick={() => {
                setMethodFilter("all")
                setStatusFilter("all")
              }}
            />
            <SummaryTile
              label={ui.momoWallet}
              value={String(summary.walletCount)}
              sub={ui.walletChannel}
              active={methodFilter === "WALLET"}
              onClick={() => setMethodFilter((f) => (f === "WALLET" ? "all" : "WALLET"))}
            />
            <SummaryTile
              label={ui.card}
              value={String(summary.cardCount)}
              sub={ui.cardChannel}
              active={methodFilter === "CARD"}
              onClick={() => setMethodFilter((f) => (f === "CARD" ? "all" : "CARD"))}
            />
            <SummaryTile
              label={ui.completedRwf}
              value={summary.completedAmountRwf.toLocaleString()}
              sub={ui.completedSummary(summary.completedCount, summary.pendingCount)}
              active={statusFilter === "COMPLETED"}
              onClick={() => setStatusFilter((f) => (f === "COMPLETED" ? "all" : "COMPLETED"))}
            />
          </div>
        )}

        <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50/50 p-3">
          <div className="flex flex-wrap gap-2">
            {(["all", "WALLET", "CARD"] as const).map((m) => (
              <Button
                key={m}
                type="button"
                size="sm"
                variant={methodFilter === m ? "default" : "outline"}
                className={methodFilter === m ? "bg-violet-700 hover:bg-violet-800" : "bg-white"}
                onClick={() => setMethodFilter(m)}
              >
                {m === "all" ? ui.allMethods : m === "WALLET" ? ui.momoOnly : ui.cardOnly}
              </Button>
            ))}
            <span className="w-px h-8 bg-gray-200 hidden sm:block mx-1" />
            {(["all", "PENDING", "COMPLETED", "FAILED"] as const).map((s) => (
              <Button
                key={s}
                type="button"
                size="sm"
                variant={statusFilter === s ? "secondary" : "outline"}
                className={statusFilter !== s ? "bg-white" : ""}
                onClick={() => setStatusFilter(s)}
              >
                {s === "all" ? ui.allStatus : s === "PENDING" ? ui.pending : s === "COMPLETED" ? ui.completed : ui.failed}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <div>
              <label className="text-[10px] font-medium uppercase tracking-wide text-gray-500">{ui.from}</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="mt-0.5 h-9 bg-white"
              />
            </div>
            <div>
              <label className="text-[10px] font-medium uppercase tracking-wide text-gray-500">{ui.to}</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="mt-0.5 h-9 bg-white"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-[10px] font-medium uppercase tracking-wide text-gray-500">{ui.searchRef}</label>
              <div className="relative mt-0.5">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder={ui.searchPlaceholder}
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="h-9 pl-8 bg-white"
                />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 justify-between">
            <p className="text-xs text-gray-600">
              {filteredTotal === 0
                ? ui.noMatchingPayments
                : ui.showing(page * pageSize + 1, Math.min(filteredTotal, page * pageSize + payments.length), filteredTotal)}
            </p>
            <Button type="button" size="sm" variant="ghost" className="h-8 text-xs" onClick={resetFilters}>
              {ui.clearFilters}
            </Button>
          </div>
        </div>

        {loading && payments.length === 0 ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-7 w-7 animate-spin text-violet-600" />
          </div>
        ) : payments.length === 0 ? (
          <p className="text-sm text-gray-600 py-6 text-center rounded-lg border border-dashed bg-gray-50/80">
            {ui.noTransactions}
          </p>
        ) : (
          <div className="rounded-lg border overflow-x-auto lg:overflow-x-visible [scrollbar-width:none] hover:[scrollbar-width:thin] [-ms-overflow-style:none] [&::-webkit-scrollbar]:h-0 hover:[&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300">
            <table className="w-full text-sm min-w-[920px] lg:min-w-0 table-fixed lg:table-auto">
              <thead>
                <tr className="border-b bg-gray-50/90 text-left text-gray-600">
                  <th className="py-2.5 px-3 font-medium w-[148px]">{ui.when}</th>
                  <th className="py-2.5 px-3 font-medium min-w-[120px]">{ui.customer}</th>
                  <th className="py-2.5 px-3 font-medium w-[100px]">{ui.amount}</th>
                  <th className="py-2.5 px-3 font-medium w-[110px]">{ui.method}</th>
                  <th className="py-2.5 px-3 font-medium w-[88px]">{ui.status}</th>
                  <th className="py-2.5 px-3 font-medium min-w-[260px] lg:min-w-[300px] lg:w-[32%]">{ui.paymentIds}</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => {
                  const displayStatus = resolveEffectiveUrubutoPaymentStatus(p.status)
                  const guestPayer = /^guest$/i.test((p.payerNames ?? "").trim())
                  const customerLabel =
                    p.orderBuyerName?.trim() ||
                    (!guestPayer && p.payerNames?.trim()) ||
                    (guestPayer ? ui.guest : ui.customerFallback)
                  const compactRow = isCompactUrubutoReferencePanel(p, displayStatus)
                  return (
                    <tr
                      key={p.id}
                      className={cn(
                        "border-b border-gray-100 hover:bg-violet-50/30 align-top",
                        compactRow && "text-[13px]",
                      )}
                    >
                      <td className={cn("px-3 text-gray-700 align-top", compactRow ? "py-2" : "py-2.5 lg:py-3")}>
                        <PaymentWhenCell p={p} displayStatus={displayStatus} ui={ui} />
                      </td>
                      <td className={cn("px-3", compactRow ? "py-2" : "py-2.5 lg:py-3")}>
                        <p className="font-medium text-gray-900">{customerLabel}</p>
                        {p.payerCode ? <p className="text-xs text-gray-500 font-mono mt-0.5">{p.payerCode}</p> : null}
                        {p.orderId ? (
                          <Link
                            href={`/supplier/orders/${p.orderId}`}
                            className="text-xs text-violet-700 hover:underline mt-1 inline-block font-medium"
                          >
                            {ui.orderNumber(p.orderId)}
                          </Link>
                        ) : null}
                      </td>
                      <td
                        className={cn(
                          "px-3 font-semibold text-gray-900 whitespace-nowrap",
                          compactRow ? "py-2" : "py-2.5 lg:py-3",
                        )}
                      >
                        {(p.amount ?? 0).toLocaleString()} {p.currency || "RWF"}
                      </td>
                      <td className={cn("px-3", compactRow ? "py-2" : "py-2.5 lg:py-3")}>
                        <MethodBadge method={p.paymentMethod} ui={ui} />
                      </td>
                      <td className={cn("px-3", compactRow ? "py-2" : "py-2.5 lg:py-3")}>
                        <StatusBadge status={displayStatus} ui={ui} />
                      </td>
                      <td className={cn("px-3", compactRow ? "py-2" : "py-2.5 lg:py-3")}>
                        <PaymentReferences p={p} displayStatus={displayStatus} onCopy={copyRef} ui={ui} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {filteredTotal > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">{ui.perPage}</span>
              {([10, 20, 50] as const).map((n) => (
                <Button
                  key={n}
                  type="button"
                  size="sm"
                  variant={pageSize === n ? "secondary" : "outline"}
                  className="h-8 px-2.5"
                  onClick={() => setPageSize(n)}
                >
                  {n}
                </Button>
              ))}
            </div>
            <div className="flex items-center justify-center sm:justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={loading || page <= 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                {ui.previous}
              </Button>
              <span className="text-xs text-gray-600 min-w-[88px] text-center">
                {ui.pageOf(page + 1, totalPages)}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={loading || page + 1 >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                {ui.next}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
