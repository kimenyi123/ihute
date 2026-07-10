"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  Activity,
  Download,
  Eye,
  RefreshCw,
  Search,
  ShoppingBag,
  Store,
  Users,
  Wallet,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  ActivityAnalyticsNav,
  AnalyticsHero,
  BreakdownBars,
  CollapsibleHelp,
  DateRangeControls,
  EmptyState,
  FilterChip,
  GlossaryGrid,
  MetricCard,
  SectionCard,
  StagePill,
  StatusPill,
  type SellerOption,
  fmtNum,
  fmtRwf,
  isoDateDaysAgo,
  todayIso,
} from "@/components/admin/activity-analytics-shell"
import { fetchAdminProtectedApi } from "@/lib/admin-client"
import { useAuthStore } from "@/lib/auth-store"

type StageTotals = Record<string, { events: number; sessions: number; accounts: number }>

type ActivityLogItem = {
  stage?: string
  status?: string
  source?: string
  environment?: string
  message?: string
  createdAt?: string
  createdAtIso?: string
  actor?: {
    type?: string
    userId?: string
    ishyigaAccount?: string
    sessionId?: string
    displayName?: string
    role?: string
  }
  context?: { path?: string; warContext?: string }
  entity?: { type?: string; id?: string; name?: string }
}

type ShopWithMeSummary = {
  orderCount?: number
  gmvTotal?: number
  shopPageViews?: number
  tableOrders?: number
  taggedOrders?: number
}

type ShopOrder = {
  orderId?: number
  orderNumber?: string
  buyerName?: string
  sellerName?: string
  sellerAccount?: string
  amount?: number
  status?: string
  timestamp?: string
  shopNickname?: string
  isTableCommand?: boolean
  tableName?: string
}

const kigaliTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Kigali",
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
})

function formatTime(iso?: string): string {
  if (!iso?.trim()) return "—"
  const d = new Date(iso.trim())
  if (Number.isNaN(d.getTime())) return iso
  return kigaliTime.format(d)
}

function eventTime(item: ActivityLogItem): string {
  return formatTime(item.createdAtIso || item.createdAt)
}

function isShopPath(item: ActivityLogItem): boolean {
  const path = item.context?.path || item.message || ""
  return path.includes("/shop-with-me/")
}

export default function AdminActivityLogsPage() {
  const hasHydrated = useAuthStore((s) => s.hasHydrated)
  const [summaryFrom, setSummaryFrom] = useState(isoDateDaysAgo(30))
  const [summaryTo, setSummaryTo] = useState(todayIso())
  const [environment, setEnvironment] = useState("")
  const [sellerAccount, setSellerAccount] = useState("")
  const [sellerOptions, setSellerOptions] = useState<SellerOption[]>([])

  const [totals, setTotals] = useState({ events: 0, sessions: 0, accounts: 0 })
  const [totalsByStage, setTotalsByStage] = useState<StageTotals>({})
  const [totalsByActorType, setTotalsByActorType] = useState<StageTotals>({})
  const [summaryError, setSummaryError] = useState("")
  const [summaryHint, setSummaryHint] = useState("")
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [shopSummary, setShopSummary] = useState<ShopWithMeSummary>({})
  const [recentShopOrders, setRecentShopOrders] = useState<ShopOrder[]>([])
  const [shopSummaryLoading, setShopSummaryLoading] = useState(false)
  const [shopSummaryError, setShopSummaryError] = useState("")
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const [items, setItems] = useState<ActivityLogItem[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsError, setLogsError] = useState("")
  const [logsHint, setLogsHint] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [pageSize] = useState(25)

  const [stage, setStage] = useState("")
  const [status, setStatus] = useState("")
  const [source, setSource] = useState("")
  const [actorType, setActorType] = useState("")
  const [account, setAccount] = useState("")
  const [shopOnly, setShopOnly] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)

  const logsQuery = useMemo(() => {
    const p = new URLSearchParams()
    if (stage.trim()) p.set("stage", stage.trim())
    if (status.trim()) p.set("status", status.trim())
    if (source.trim()) p.set("source", source.trim())
    if (environment.trim()) p.set("environment", environment.trim())
    if (actorType.trim()) p.set("actorType", actorType.trim())
    if (account.trim()) p.set("account", account.trim())
    else if (sellerAccount.trim()) p.set("account", sellerAccount.trim())
    p.set("page", String(page))
    p.set("pageSize", String(pageSize))
    return p.toString()
  }, [stage, status, source, environment, actorType, account, sellerAccount, page, pageSize])

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true)
    setSummaryError("")
    try {
      const p = new URLSearchParams({ from: summaryFrom, to: summaryTo })
      if (environment.trim()) p.set("environment", environment.trim())
      const res = await fetchAdminProtectedApi(`/api/activity/summary?${p}`)
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
        hint?: string
        totals?: { events: number; sessions: number; accounts: number }
        totalsByStage?: StageTotals
        totalsByActorType?: StageTotals
      }
      if (!res.ok || !json.ok) {
        setSummaryHint("")
        setSummaryError(json.error || (res.status === 401 ? "Sign in as admin" : "Failed to load summary"))
        return
      }
      setSummaryHint(typeof json.hint === "string" ? json.hint : "")
      setTotals(json.totals ?? { events: 0, sessions: 0, accounts: 0 })
      setTotalsByStage(json.totalsByStage ?? {})
      setTotalsByActorType(json.totalsByActorType ?? {})
    } catch (e) {
      setSummaryError(e instanceof Error ? e.message : "Failed to load summary")
    } finally {
      setSummaryLoading(false)
    }
  }, [summaryFrom, summaryTo, environment])

  const loadShopSummary = useCallback(async () => {
    setShopSummaryLoading(true)
    setShopSummaryError("")
    try {
      const p = new URLSearchParams({ from: summaryFrom, to: summaryTo })
      if (environment.trim()) p.set("environment", environment.trim())
      if (sellerAccount.trim()) p.set("sellerAccount", sellerAccount.trim())
      const res = await fetchAdminProtectedApi(`/api/activity/commercial-stats?${p}`)
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
        shopWithMe?: ShopWithMeSummary
        recentShopWithMeOrders?: ShopOrder[]
        sellerOptions?: SellerOption[]
      }
      if (!res.ok || !json.ok) {
        setShopSummary({})
        setRecentShopOrders([])
        setShopSummaryError(json.error || "Failed to load shop-with-me sales")
        return
      }
      setShopSummary(json.shopWithMe ?? {})
      setRecentShopOrders(Array.isArray(json.recentShopWithMeOrders) ? json.recentShopWithMeOrders.slice(0, 8) : [])
      setSellerOptions(
        Array.isArray(json.sellerOptions)
          ? json.sellerOptions
              .filter((s) => s.sellerAccount)
              .map((s) => ({
                sellerAccount: String(s.sellerAccount),
                sellerName: String(s.sellerName || s.sellerAccount),
                shopNickname: s.shopNickname ? String(s.shopNickname) : undefined,
                orderCount: s.orderCount,
              }))
          : [],
      )
    } catch (e) {
      setShopSummaryError(e instanceof Error ? e.message : "Failed to load shop sales")
    } finally {
      setShopSummaryLoading(false)
    }
  }, [summaryFrom, summaryTo, environment, sellerAccount])

  const loadLogs = useCallback(async () => {
    setLogsLoading(true)
    setLogsError("")
    try {
      const res = await fetchAdminProtectedApi(`/api/activity/logs?${logsQuery}`)
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
        hint?: string
        items?: ActivityLogItem[]
        total?: number
        totalPages?: number
      }
      if (!res.ok || !json.ok) {
        setItems([])
        setTotal(0)
        setTotalPages(1)
        setLogsHint("")
        setLogsError(json.error || (res.status === 401 ? "Sign in as admin" : "Failed to load logs"))
        return
      }
      setLogsHint(typeof json.hint === "string" ? json.hint : "")
      setItems(Array.isArray(json.items) ? json.items : [])
      setTotal(typeof json.total === "number" ? json.total : 0)
      setTotalPages(typeof json.totalPages === "number" ? Math.max(1, json.totalPages) : 1)
    } catch (e) {
      setItems([])
      setLogsError(e instanceof Error ? e.message : "Failed to load logs")
    } finally {
      setLogsLoading(false)
    }
  }, [logsQuery])

  const refreshAll = useCallback(async () => {
    await Promise.all([loadSummary(), loadShopSummary(), loadLogs()])
    setLastUpdated(new Date())
  }, [loadSummary, loadShopSummary, loadLogs])

  useEffect(() => {
    if (!hasHydrated) return
    void refreshAll()
  }, [hasHydrated, summaryFrom, summaryTo, environment, sellerAccount])

  useEffect(() => {
    if (!hasHydrated) return
    void loadLogs()
  }, [hasHydrated, loadLogs])

  useEffect(() => {
    if (!autoRefresh) return
    const id = setInterval(() => void refreshAll(), 30_000)
    return () => clearInterval(id)
  }, [autoRefresh, refreshAll])

  const topStages = Object.entries(totalsByStage)
    .sort((a, b) => b[1].events - a[1].events)
    .slice(0, 8)
    .map(([name, row]) => ({ name, value: row.events }))

  const topActors = Object.entries(totalsByActorType)
    .sort((a, b) => b[1].events - a[1].events)
    .slice(0, 6)
    .map(([name, row]) => ({ name, value: row.events }))

  const conversionRate =
    (shopSummary.shopPageViews ?? 0) > 0
      ? (((shopSummary.orderCount ?? 0) / (shopSummary.shopPageViews ?? 1)) * 100).toFixed(1)
      : "0"

  const displayedItems = shopOnly ? items.filter(isShopPath) : items

  function exportEventsCsv() {
    const rows = [
      ["time", "stage", "status", "source", "actor", "entity", "message", "path"],
      ...displayedItems.map((it) => [
        eventTime(it),
        it.stage || "",
        it.status || "",
        it.source || "",
        it.actor?.type || "",
        it.entity?.name || it.entity?.id || "",
        it.message || "",
        it.context?.path || "",
      ]),
    ]
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `ihute_activity_${summaryFrom}_${summaryTo}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6 pb-8">
      <ActivityAnalyticsNav active="visitors" from={summaryFrom} to={summaryTo} environment={environment} />

      <AnalyticsHero
        title="Visitor tracking"
        subtitle="Real-time buyer journeys, shop-with-me visits, and sales — pick a seller to drill into their shop activity."
        icon={Eye}
        actions={
          <>
            <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <input
                type="checkbox"
                className="rounded"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              Live · 30s
            </label>
            <Button type="button" variant="outline" size="sm" onClick={() => void refreshAll()} disabled={summaryLoading || logsLoading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${summaryLoading || logsLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={exportEventsCsv} disabled={displayedItems.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </>
        }
      />

      {lastUpdated ? (
        <p className="text-xs text-slate-500">
          Last updated {kigaliTime.format(lastUpdated)} (Kigali)
        </p>
      ) : null}

      <DateRangeControls
        from={summaryFrom}
        to={summaryTo}
        environment={environment}
        sellerAccount={sellerAccount}
        sellerOptions={sellerOptions}
        onFromChange={setSummaryFrom}
        onToChange={setSummaryTo}
        onEnvironmentChange={(v) => {
          setEnvironment(v)
          setPage(1)
        }}
        onSellerChange={(v) => {
          setSellerAccount(v)
          setAccount(v)
          setPage(1)
        }}
        onApply={() => void refreshAll()}
        loading={summaryLoading || shopSummaryLoading}
        showDevEnv
      />

      {sellerAccount ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
          <span>
            Seller filter: <strong>{sellerOptions.find((s) => s.sellerAccount === sellerAccount)?.sellerName || sellerAccount}</strong>
          </span>
          <div className="flex gap-2">
            <Link
              href={`/admin/ihute-stats?from=${encodeURIComponent(summaryFrom)}&to=${encodeURIComponent(summaryTo)}&sellerAccount=${encodeURIComponent(sellerAccount)}`}
              className="text-sm font-medium text-slate-700 underline-offset-2 hover:underline"
            >
              Full sales report →
            </Link>
            <Button type="button" variant="ghost" size="sm" onClick={() => { setSellerAccount(""); setAccount("") }}>
              Clear
            </Button>
          </div>
        </div>
      ) : null}

      {(summaryError || shopSummaryError) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {summaryError || shopSummaryError}
        </div>
      )}
      {summaryHint && !summaryError ? (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">{summaryHint}</div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Shop-with-me orders"
          value={fmtNum(shopSummary.orderCount ?? 0)}
          hint={`${conversionRate}% visit → order`}
          icon={ShoppingBag}
          tone="shop"
          loading={shopSummaryLoading}
        />
        <MetricCard
          label="Shop GMV"
          value={fmtRwf(shopSummary.gmvTotal ?? 0)}
          hint={`${fmtNum(shopSummary.tableOrders ?? 0)} table · ${fmtNum(shopSummary.taggedOrders ?? 0)} tagged`}
          icon={Wallet}
          tone="shop"
          loading={shopSummaryLoading}
        />
        <MetricCard
          label="Shop page views"
          value={fmtNum(shopSummary.shopPageViews ?? 0)}
          icon={Store}
          tone="info"
          loading={shopSummaryLoading}
        />
        <MetricCard
          label="Total events"
          value={fmtNum(totals.events)}
          hint={`${fmtNum(totals.sessions)} sessions · ${fmtNum(totals.accounts)} accounts`}
          icon={Activity}
          loading={summaryLoading}
        />
      </div>

      {recentShopOrders.length > 0 ? (
        <SectionCard
          title="Latest shop-with-me sales"
          subtitle="Most recent orders from table menus and tagged checkouts"
          action={
            <Link
              href={`/admin/ihute-stats?from=${encodeURIComponent(summaryFrom)}&to=${encodeURIComponent(summaryTo)}`}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
            >
              View all sales →
            </Link>
          }
        >
          <div className="overflow-x-auto -mx-1">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2 font-medium">Order</th>
                  <th className="px-3 py-2 font-medium">Buyer</th>
                  <th className="px-3 py-2 font-medium">Seller</th>
                  <th className="px-3 py-2 font-medium">Amount</th>
                  <th className="px-3 py-2 font-medium">Source</th>
                </tr>
              </thead>
              <tbody>
                {recentShopOrders.map((o) => (
                  <tr key={`${o.orderId}-${o.orderNumber}`} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-3 py-3 font-medium text-slate-900">{o.orderNumber || o.orderId}</td>
                    <td className="px-3 py-3 text-slate-700">{o.buyerName || "—"}</td>
                    <td className="px-3 py-3 text-slate-700">{o.sellerName || o.sellerAccount || "—"}</td>
                    <td className="px-3 py-3 font-semibold tabular-nums text-violet-800">{fmtRwf(o.amount ?? 0)}</td>
                    <td className="px-3 py-3 text-slate-600">
                      {o.isTableCommand ? `Table ${o.tableName || ""}`.trim() : o.shopNickname ? `@${o.shopNickname}` : "Shop"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <BreakdownBars title="Events by stage" items={topStages} color="#6366f1" emptyLabel="No rollup data for this range" />
        <BreakdownBars title="Events by actor" items={topActors} color="#8b5cf6" emptyLabel="No actor data for this range" />
      </div>

      <SectionCard
        title="Live event stream"
        subtitle={`${fmtNum(total)} events total · page ${page} of ${totalPages}`}
        action={
          <div className="flex flex-wrap gap-2">
            <FilterChip label="All" active={!stage && !shopOnly} onClick={() => { setStage(""); setShopOnly(false); setPage(1) }} />
            <FilterChip label="Page views" active={stage === "page_view"} onClick={() => { setStage("page_view"); setShopOnly(false); setPage(1) }} />
            <FilterChip label="Search" active={stage === "search"} onClick={() => { setStage("search"); setShopOnly(false); setPage(1) }} />
            <FilterChip label="Add to cart" active={stage === "add_to_cart"} onClick={() => { setStage("add_to_cart"); setShopOnly(false); setPage(1) }} />
            <FilterChip label="Shop pages" active={shopOnly} onClick={() => { setShopOnly((v) => !v); setPage(1) }} />
          </div>
        }
      >
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Filter stage (page_view, search…)"
              value={stage}
              onChange={(e) => { setStage(e.target.value); setPage(1) }}
            />
          </div>
          <select
            className="rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm"
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1) }}
          >
            <option value="">All statuses</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
          </select>
          <select
            className="rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm"
            value={source}
            onChange={(e) => { setSource(e.target.value); setPage(1) }}
          >
            <option value="">All sources</option>
            <option value="frontend">Frontend</option>
            <option value="kaos">Kaos</option>
            <option value="pos">POS</option>
          </select>
          <select
            className="rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm"
            value={actorType}
            onChange={(e) => { setActorType(e.target.value); setPage(1) }}
          >
            <option value="">All actors</option>
            <option value="anonymous">Anonymous</option>
            <option value="buyer">Buyer</option>
            <option value="supplier">Supplier</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        {logsError ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{logsError}</div>
        ) : logsHint ? (
          <div className="mb-4 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">{logsHint}</div>
        ) : null}

        {logsLoading && displayedItems.length === 0 ? (
          <EmptyState title="Loading events…" />
        ) : displayedItems.length === 0 ? (
          <EmptyState
            title="No events match your filters"
            description="Try widening the date range or clearing stage filters."
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Time</th>
                  <th className="px-4 py-3 font-medium">Stage</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Source</th>
                  <th className="px-4 py-3 font-medium">Actor</th>
                  <th className="px-4 py-3 font-medium">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedItems.map((it, idx) => (
                  <tr
                    key={`${eventTime(it)}-${idx}`}
                    className={isShopPath(it) ? "bg-slate-50/80 hover:bg-slate-100" : "hover:bg-slate-50"}
                  >
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-600">{eventTime(it)}</td>
                    <td className="px-4 py-3"><StagePill stage={it.stage} /></td>
                    <td className="px-4 py-3"><StatusPill status={it.status} /></td>
                    <td className="px-4 py-3 text-slate-600">{it.source || "—"}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-slate-700">
                        <Users className="h-3.5 w-3.5 text-slate-400" />
                        {it.actor?.displayName || it.actor?.type || "—"}
                      </span>
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {[
                          it.actor?.type === "supplier"
                            ? "Seller"
                            : it.actor?.type === "admin"
                              ? "Admin"
                              : it.actor?.type === "buyer"
                                ? "Buyer"
                                : it.actor?.type,
                          it.actor?.ishyigaAccount,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </td>
                    <td className="max-w-[240px] px-4 py-3">
                      <p className="truncate font-medium text-slate-800" title={it.message}>
                        {it.message || it.entity?.name || "—"}
                      </p>
                      {it.context?.path ? (
                        <p className="mt-0.5 truncate text-xs text-indigo-600">{it.context.path}</p>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-slate-500">
            Showing {displayedItems.length} on this page
            {shopOnly ? " (shop-with-me paths only)" : ""}
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" disabled={page <= 1 || logsLoading} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Previous
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={page >= totalPages || logsLoading} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      </SectionCard>

      <CollapsibleHelp title="What do these metrics mean?">
        <GlossaryGrid
          items={[
            { term: "Shop-with-me", def: "Curated seller menus at /shop-with-me/{nickname}." },
            { term: "GMV", def: "Gross Merchandise Value — total order amount in RWF." },
            { term: "Stage", def: "Event type: page_view, search, add_to_cart, checkout_submit, auth…" },
            { term: "Sessions", def: "Distinct browser visits in the date range." },
            { term: "Seller deep dive", def: "Pick a seller in the filter — stats, orders, and events narrow to that Ishyiga account." },
          ]}
        />
      </CollapsibleHelp>
    </div>
  )
}
