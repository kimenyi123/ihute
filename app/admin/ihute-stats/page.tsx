"use client"

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import {
  Copy,
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
  CollapsibleHelp,
  DateRangeControls,
  EmptyState,
  GlossaryGrid,
  MetricCard,
  SectionCard,
  type SellerOption,
  fmtChartDate,
  fmtNum,
  fmtRwf,
  isoDateDaysAgo,
  todayIso,
} from "@/components/admin/activity-analytics-shell"
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { ShopAnalyticsPanels } from "@/components/admin/shop-analytics-panels"
import { fetchAdminProtectedApi } from "@/lib/admin-client"
import type { ShopAnalyticsBundle } from "@/lib/shop-analytics-types"
import { useAuthStore } from "@/lib/auth-store"
import { cn } from "@/lib/utils"

type TabId = "overview" | "sales" | "engagement" | "insights"

type Engagement = {
  pageViews?: number
  uniqueSessions?: number
  sessionStarts?: number
  searches?: number
  productViews?: number
  addToCart?: number
  checkouts?: number
  logins?: number
  source?: string
}

type Orders = {
  orderCount?: number
  gmvTotal?: number
  gmvMin?: number
  gmvMax?: number
  gmvAvg?: number
  uniqueBuyers?: number
  activeSellers?: number
}

type ShopWithMe = {
  orderCount?: number
  gmvTotal?: number
  uniqueBuyers?: number
  activeSellers?: number
  tableOrders?: number
  taggedOrders?: number
  shopPageViews?: number
}

type ShopWithMeOrder = {
  orderId?: number
  orderNumber?: string
  sellerName?: string
  sellerAccount?: string
  buyerName?: string
  amount?: number
  status?: string
  paymentStatus?: string
  timestamp?: string
  deliveryLocation?: string
  isTableCommand?: boolean
  tableName?: string
  shopNickname?: string
}

type TopShop = {
  sellerAccount?: string
  sellerName?: string
  orderCount?: number
  gmv?: number
}

type DailyPoint = {
  date: string
  pageViews?: number
  searches?: number
  productViews?: number
  orders?: number
  gmv?: number
  shopWithMeOrders?: number
  shopWithMeGmv?: number
}

type ChartDaily = DailyPoint & { label: string }
type PieSlice = { name: string; value: number }

const PIE_COLORS = ["#6366f1", "#8b5cf6", "#2563eb", "#059669", "#d97706", "#db2777", "#0ea5e9", "#64748b"]

function pieSlices(data: PieSlice[]): PieSlice[] {
  return data.filter((d) => d.value > 0)
}

function emptyDailyRange(from: string, to: string): DailyPoint[] {
  const out: DailyPoint[] = []
  const cur = new Date(`${from}T00:00:00Z`)
  const end = new Date(`${to}T00:00:00Z`)
  while (cur <= end) {
    out.push({ date: cur.toISOString().slice(0, 10), pageViews: 0, searches: 0, orders: 0, gmv: 0, shopWithMeOrders: 0, shopWithMeGmv: 0 })
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return out
}

function toChartDaily(daily: DailyPoint[]): ChartDaily[] {
  return daily.map((row) => ({
    ...row,
    label: fmtChartDate(row.date),
    pageViews: row.pageViews ?? 0,
    searches: row.searches ?? 0,
    productViews: row.productViews ?? 0,
    orders: row.orders ?? 0,
    gmv: row.gmv ?? 0,
    shopWithMeOrders: row.shopWithMeOrders ?? 0,
    shopWithMeGmv: row.shopWithMeGmv ?? 0,
  }))
}

export default function AdminIhuteStatsPage() {
  const searchParams = useSearchParams()
  const hasHydrated = useAuthStore((s) => s.hasHydrated)
  const [from, setFrom] = useState(() => searchParams.get("from") || isoDateDaysAgo(30))
  const [to, setTo] = useState(() => searchParams.get("to") || todayIso())
  const [environment, setEnvironment] = useState(() => searchParams.get("environment") || "")
  const [sellerAccount, setSellerAccount] = useState(() => searchParams.get("sellerAccount") || "")
  const [compareSellers, setCompareSellers] = useState<string[]>(() => {
    const raw = searchParams.get("compareSellers") || ""
    return raw ? raw.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 3) : []
  })
  const [analytics, setAnalytics] = useState<ShopAnalyticsBundle>({})
  const [sellerOptions, setSellerOptions] = useState<SellerOption[]>([])
  const [tab, setTab] = useState<TabId>("overview")
  const [orderSearch, setOrderSearch] = useState("")
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [engagement, setEngagement] = useState<Engagement>({})
  const [orders, setOrders] = useState<Orders>({})
  const [shopWithMe, setShopWithMe] = useState<ShopWithMe>({})
  const [recentShopOrders, setRecentShopOrders] = useState<ShopWithMeOrder[]>([])
  const [topShops, setTopShops] = useState<TopShop[]>([])
  const [daily, setDaily] = useState<DailyPoint[]>([])
  const [pitchSummary, setPitchSummary] = useState("")
  const [currency, setCurrency] = useState("RWF")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const p = new URLSearchParams({ from, to })
      if (environment.trim()) p.set("environment", environment.trim())
      if (sellerAccount.trim()) p.set("sellerAccount", sellerAccount.trim())
      if (compareSellers.length) p.set("compareSellers", compareSellers.join(","))
      const res = await fetchAdminProtectedApi(`/api/activity/commercial-stats?${p}`)
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
        engagement?: Engagement
        orders?: Orders
        shopWithMe?: ShopWithMe
        recentShopWithMeOrders?: ShopWithMeOrder[]
        topShopWithMeShops?: TopShop[]
        sellerOptions?: SellerOption[]
        daily?: DailyPoint[]
        pitchSummary?: string
        currency?: string
        analytics?: ShopAnalyticsBundle
      }
      if (!res.ok || !json.ok) {
        setError(json.error || "Failed to load stats")
        return
      }
      setEngagement(json.engagement ?? {})
      setOrders(json.orders ?? {})
      setShopWithMe(json.shopWithMe ?? {})
      setRecentShopOrders(Array.isArray(json.recentShopWithMeOrders) ? json.recentShopWithMeOrders : [])
      setTopShops(Array.isArray(json.topShopWithMeShops) ? json.topShopWithMeShops : [])
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
      setDaily(Array.isArray(json.daily) ? json.daily : [])
      setPitchSummary(typeof json.pitchSummary === "string" ? json.pitchSummary : "")
      setCurrency(json.currency || "RWF")
      setAnalytics(json.analytics && typeof json.analytics === "object" ? json.analytics : {})
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }, [from, to, environment, sellerAccount, compareSellers])

  useEffect(() => {
    if (!hasHydrated) return
    void load()
  }, [hasHydrated, load])

  useEffect(() => {
    const p = new URLSearchParams()
    p.set("from", from)
    p.set("to", to)
    if (environment.trim()) p.set("environment", environment.trim())
    if (sellerAccount.trim()) p.set("sellerAccount", sellerAccount.trim())
    if (compareSellers.length) p.set("compareSellers", compareSellers.join(","))
    const qs = p.toString()
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname)
  }, [from, to, environment, sellerAccount, compareSellers])

  const sessions = (engagement.uniqueSessions ?? 0) > 0 ? engagement.uniqueSessions! : engagement.sessionStarts ?? 0
  const chartDaily = useMemo(() => toChartDaily(daily.length > 0 ? daily : emptyDailyRange(from, to)), [daily, from, to])
  const conversionRate =
    (shopWithMe.shopPageViews ?? 0) > 0
      ? (((shopWithMe.orderCount ?? 0) / (shopWithMe.shopPageViews ?? 1)) * 100).toFixed(1)
      : "0"

  const filteredOrders = useMemo(() => {
    const q = orderSearch.trim().toLowerCase()
    if (!q) return recentShopOrders
    return recentShopOrders.filter((o) =>
      [o.orderNumber, o.buyerName, o.sellerName, o.sellerAccount, o.shopNickname, o.tableName]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    )
  }, [recentShopOrders, orderSearch])

  const engagementMixPie = useMemo(
    () =>
      pieSlices([
        { name: "Page views", value: engagement.pageViews ?? 0 },
        { name: "Searches", value: engagement.searches ?? 0 },
        { name: "Product views", value: engagement.productViews ?? 0 },
        { name: "Add to cart", value: engagement.addToCart ?? 0 },
        { name: "Checkouts", value: engagement.checkouts ?? 0 },
        { name: "Logins", value: engagement.logins ?? 0 },
      ]),
    [engagement],
  )

  const shopShare =
    (orders.orderCount ?? 0) > 0
      ? (((shopWithMe.orderCount ?? 0) / (orders.orderCount ?? 1)) * 100).toFixed(0)
      : "0"

  async function copyPitch() {
    const text =
      pitchSummary ||
      `IHUTE ${from}–${to}: ${fmtNum(shopWithMe.orderCount ?? 0)} shop orders, ${fmtRwf(shopWithMe.gmvTotal ?? 0)} shop GMV.`
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function exportCsv() {
    const rows = [
      ["IHUTE Commercial Stats", ""],
      ["From", from],
      ["To", to],
      ["Shop orders", String(shopWithMe.orderCount ?? 0)],
      ["Shop GMV", String(shopWithMe.gmvTotal ?? 0)],
      ["All orders", String(orders.orderCount ?? 0)],
      ["All GMV", String(orders.gmvTotal ?? 0)],
      [""],
      ["order", "buyer", "seller", "amount", "status", "source", "time"],
      ...filteredOrders.map((o) => [
        o.orderNumber || String(o.orderId ?? ""),
        o.buyerName || "",
        o.sellerName || o.sellerAccount || "",
        String(o.amount ?? 0),
        o.status || "",
        o.isTableCommand ? `table:${o.tableName}` : o.shopNickname || "shop",
        o.timestamp || "",
      ]),
      [""],
      ["Pitch", pitchSummary],
    ]
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `ihute_shop_sales_${from}_${to}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const selectedSellerName =
    sellerOptions.find((s) => s.sellerAccount === sellerAccount)?.sellerName || sellerAccount

  const selectedSeller = sellerOptions.find((s) => s.sellerAccount === sellerAccount)
  const shopNickname = selectedSeller?.shopNickname?.trim()
  const sellerMode = Boolean(sellerAccount.trim())

  const tabs: { id: TabId; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "sales", label: "All sales" },
    { id: "insights", label: "Insights" },
    { id: "engagement", label: "Engagement" },
  ]

  return (
    <div className="space-y-6 pb-8">
      <ActivityAnalyticsNav active="sales" from={from} to={to} environment={environment} />

      <AnalyticsHero
        title={sellerAccount ? `Shop-with-me: ${selectedSellerName}` : "Shop-with-me sales"}
        subtitle={
          sellerAccount
            ? `Deep dive for seller account ${sellerAccount} — orders, GMV, and buyer activity in the selected period.`
            : "Every sale from curated shop menus, table orders, and tagged checkouts — pick a seller below to drill down."
        }
        icon={Store}
        actions={
          <>
            <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={copyPitch}>
              <Copy className="mr-2 h-4 w-4" />
              {copied ? "Copied!" : "Copy pitch"}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={exportCsv}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </>
        }
      />

      <DateRangeControls
        from={from}
        to={to}
        environment={environment}
        sellerAccount={sellerAccount}
        sellerOptions={sellerOptions}
        onFromChange={setFrom}
        onToChange={setTo}
        onEnvironmentChange={setEnvironment}
        onSellerChange={setSellerAccount}
        onApply={() => void load()}
        loading={loading}
      />

      {sellerAccount ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
          <span>
            Showing stats for: <strong className="text-slate-900">{selectedSellerName}</strong>
            <span className="text-slate-500"> ({sellerAccount})</span>
            {shopNickname ? (
              <>
                {" "}
                ·{" "}
                <Link
                  href={`/shop-with-me/${encodeURIComponent(shopNickname)}`}
                  className="font-medium text-indigo-600 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  @{shopNickname}
                </Link>
              </>
            ) : null}
          </span>
          <Button type="button" variant="ghost" size="sm" onClick={() => setSellerAccount("")}>
            View all sellers
          </Button>
        </div>
      ) : null}

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div> : null}

      {pitchSummary ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Partner pitch</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-800">{pitchSummary}</p>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label={sellerMode ? "This shop's orders" : "Shop orders"}
          value={fmtNum(shopWithMe.orderCount ?? 0)}
          hint={sellerMode ? `${fmtNum(shopWithMe.uniqueBuyers ?? 0)} buyers` : `${shopShare}% of all orders`}
          icon={ShoppingBag}
          tone="shop"
          loading={loading}
        />
        <MetricCard
          label={sellerMode ? "This shop's GMV" : "Shop GMV"}
          value={fmtRwf(shopWithMe.gmvTotal ?? 0)}
          hint={`Avg ${fmtRwf((shopWithMe.orderCount ?? 0) > 0 ? (shopWithMe.gmvTotal ?? 0) / (shopWithMe.orderCount ?? 1) : 0)}`}
          icon={Wallet}
          tone="shop"
          loading={loading}
        />
        <MetricCard
          label={sellerMode ? "Shop page visits" : "Shop visits"}
          value={fmtNum(shopWithMe.shopPageViews ?? 0)}
          hint={`${conversionRate}% conversion`}
          icon={Eye}
          tone="info"
          loading={loading}
        />
        <MetricCard
          label={sellerMode ? "Shop buyers" : "Shop sellers"}
          value={fmtNum(sellerMode ? (shopWithMe.uniqueBuyers ?? 0) : (shopWithMe.activeSellers ?? 0))}
          hint={sellerMode ? "Unique buyers in range" : `${fmtNum(shopWithMe.uniqueBuyers ?? 0)} buyers`}
          icon={Users}
          tone="success"
          loading={loading}
        />
      </div>

      <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition",
              tab === t.id ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="space-y-6">
          <ChartPanel title="Shop-with-me trend" subtitle="Daily orders and GMV from shop menus">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartDaily} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis yAxisId="orders" tick={{ fontSize: 11 }} allowDecimals={false} width={36} />
                  <YAxis yAxisId="gmv" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => fmtNum(Number(v))} width={56} />
                  <Tooltip content={<DualTooltip gmvKey="shopWithMeGmv" ordersKey="shopWithMeOrders" ordersLabel="Shop orders" gmvLabel="Shop GMV" />} />
                  <Bar yAxisId="orders" dataKey="shopWithMeOrders" fill="#7c3aed" name="Shop orders" radius={[4, 4, 0, 0]} maxBarSize={32} />
                  <Line yAxisId="gmv" type="monotone" dataKey="shopWithMeGmv" stroke="#db2777" strokeWidth={2.5} dot={false} name="Shop GMV" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </ChartPanel>

          <div className="grid gap-4 lg:grid-cols-2">
            {!sellerMode ? (
              <ChartPanel title="Top shop sellers" subtitle="Click a seller in the dropdown above to drill down">
                <div className="h-[280px]">
                  {topShops.length === 0 ? (
                    <EmptyState title="No shop sales yet" description="Sales appear when buyers order from shop-with-me or table menus." />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={topShops.map((s) => ({
                          name: (s.sellerName || s.sellerAccount || "Shop").slice(0, 20),
                          gmv: s.gmv ?? 0,
                          orders: s.orderCount ?? 0,
                        }))}
                        layout="vertical"
                        margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => fmtNum(Number(v))} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
                        <Tooltip formatter={(v: number) => fmtRwf(v)} />
                        <Bar dataKey="gmv" fill="#6366f1" radius={[0, 4, 4, 0]} maxBarSize={22} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </ChartPanel>
            ) : (
              <ChartPanel title="Order channels" subtitle="How buyers ordered from this shop">
                <div className="grid gap-3 sm:grid-cols-2">
                  <MiniStat label="Table orders" value={fmtNum(shopWithMe.tableOrders ?? 0)} />
                  <MiniStat label="Tagged checkouts" value={fmtNum(shopWithMe.taggedOrders ?? 0)} />
                  <MiniStat label="Shop GMV share" value={`${shopShare}%`} />
                  <MiniStat label="Avg order" value={fmtRwf((shopWithMe.orderCount ?? 0) > 0 ? (shopWithMe.gmvTotal ?? 0) / (shopWithMe.orderCount ?? 1) : 0)} />
                </div>
              </ChartPanel>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              {!sellerMode ? (
                <>
                  <MiniStat label="Table orders" value={fmtNum(shopWithMe.tableOrders ?? 0)} />
                  <MiniStat label="Tagged checkouts" value={fmtNum(shopWithMe.taggedOrders ?? 0)} />
                  <MiniStat label="All IHUTE orders" value={fmtNum(orders.orderCount ?? 0)} />
                  <MiniStat label="All GMV" value={fmtRwf(orders.gmvTotal ?? 0)} />
                  <MiniStat label="Page views" value={fmtNum(engagement.pageViews ?? 0)} />
                  <MiniStat label="Sessions" value={fmtNum(sessions)} />
                </>
              ) : (
                <>
                  <MiniStat label="This shop's buyers" value={fmtNum(shopWithMe.uniqueBuyers ?? 0)} />
                  <MiniStat label="Table orders" value={fmtNum(shopWithMe.tableOrders ?? 0)} />
                  <MiniStat label="Tagged checkouts" value={fmtNum(shopWithMe.taggedOrders ?? 0)} />
                  <MiniStat label="Shop visits" value={fmtNum(shopWithMe.shopPageViews ?? 0)} />
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === "sales" && (
        <SectionCard
          title={sellerMode ? `${selectedSellerName} — shop sales` : "All shop-with-me sales"}
          subtitle={`${fmtNum(filteredOrders.length)} orders in range`}
          action={
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input className="pl-9" placeholder="Search order, buyer, seller…" value={orderSearch} onChange={(e) => setOrderSearch(e.target.value)} />
            </div>
          }
        >
          {filteredOrders.length === 0 ? (
            <EmptyState title="No shop-with-me orders" description="Widen the date range or wait for new checkouts from /shop-with-me." icon={ShoppingBag} />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Order</th>
                    <th className="px-4 py-3 font-medium">Buyer</th>
                    <th className="px-4 py-3 font-medium">Seller</th>
                    <th className="px-4 py-3 font-medium">Amount</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Channel</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOrders.map((o) => (
                    <tr key={`${o.orderId}-${o.orderNumber}`} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-600">
                        {o.timestamp ? fmtChartDate(o.timestamp.slice(0, 10)) : "—"}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{o.orderNumber || o.orderId}</td>
                      <td className="px-4 py-3 text-slate-700">{o.buyerName || "—"}</td>
                      <td className="px-4 py-3 text-slate-700">{o.sellerName || o.sellerAccount || "—"}</td>
                      <td className="px-4 py-3 font-bold tabular-nums text-slate-900">{fmtRwf(o.amount ?? 0)}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">{o.status || "—"}</span>
                      </td>
                      <td className="px-4 py-3">
                        {o.isTableCommand ? (
                          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">Table {o.tableName || ""}</span>
                        ) : o.shopNickname ? (
                          <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-800">@{o.shopNickname}</span>
                        ) : (
                          <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-800">Shop-with-me</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      )}

      {tab === "insights" && (
        <ShopAnalyticsPanels
          analytics={analytics}
          sellerOptions={sellerOptions}
          sellerAccount={sellerAccount}
          compareSellers={compareSellers}
          onCompareChange={setCompareSellers}
          from={from}
          to={to}
          loading={loading}
        />
      )}

      {tab === "engagement" && (
        <div className="space-y-6">
          {sellerMode ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Engagement below is marketplace-wide. For this seller, use <strong>Overview</strong> and{" "}
              <strong>All sales</strong> tabs — orders, GMV, and shop visits are already filtered.
            </div>
          ) : null}
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartPanel title="Engagement mix" subtitle="Buyer activity in period">
              <StatsPie data={engagementMixPie} loading={loading} valueFormatter={fmtNum} centerLabel="Events" />
            </ChartPanel>
            <ChartPanel title="Marketplace orders" subtitle="All IHUTE commerce">
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartDaily} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                    <YAxis yAxisId="orders" tick={{ fontSize: 11 }} allowDecimals={false} width={36} />
                    <YAxis yAxisId="gmv" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => fmtNum(Number(v))} width={56} />
                    <Tooltip content={<DualTooltip gmvKey="gmv" ordersKey="orders" ordersLabel="Orders" gmvLabel="GMV" />} />
                    <Bar yAxisId="orders" dataKey="orders" fill="#059669" radius={[4, 4, 0, 0]} maxBarSize={28} />
                    <Line yAxisId="gmv" type="monotone" dataKey="gmv" stroke="#2563eb" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </ChartPanel>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MiniStat label="Searches" value={fmtNum(engagement.searches ?? 0)} />
            <MiniStat label="Add to cart" value={fmtNum(engagement.addToCart ?? 0)} />
            <MiniStat label="Checkouts" value={fmtNum(engagement.checkouts ?? 0)} />
            <MiniStat label="Avg order (all)" value={fmtRwf(orders.gmvAvg ?? 0)} />
          </div>
        </div>
      )}

      <CollapsibleHelp title="Metric definitions">
        <GlossaryGrid
          items={[
            { term: "Shop-with-me", def: "Sales from /shop-with-me menus, table commands, or tagged checkouts." },
            { term: "GMV", def: "Gross Merchandise Value — sum of order amounts in RWF." },
            { term: "Conversion", def: "Shop orders divided by shop page views." },
            { term: "Table orders", def: "In-venue orders via table menu (IS_TABLE_COMMAND)." },
            { term: "Tagged checkouts", def: "Orders stamped [IHUTE:shop_with_me:nickname] at checkout." },
          ]}
        />
      </CollapsibleHelp>

      <p className="text-xs text-slate-500">
        Data: activity_events + order_transaction ({currency}). {chartDaily.length} days charted.
      </p>
    </div>
  )
}

function ChartPanel({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      {subtitle ? <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p> : null}
      <div className="mt-4">{children}</div>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-bold tabular-nums text-slate-900">{value}</p>
    </div>
  )
}

function DualTooltip({
  active,
  payload,
  label,
  ordersKey,
  gmvKey,
  ordersLabel,
  gmvLabel,
}: {
  active?: boolean
  payload?: { dataKey: string; value: number; color: string }[]
  label?: string
  ordersKey: string
  gmvKey: string
  ordersLabel: string
  gmvLabel: string
}) {
  if (!active || !payload?.length) return null
  const orders = payload.find((p) => p.dataKey === ordersKey)?.value ?? 0
  const gmv = payload.find((p) => p.dataKey === gmvKey)?.value ?? 0
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-lg">
      <p className="font-medium text-slate-900">{label}</p>
      <p className="mt-1 text-violet-700">{ordersLabel}: {fmtNum(orders)}</p>
      <p className="text-indigo-700">{gmvLabel}: {fmtRwf(gmv)}</p>
    </div>
  )
}

function StatsPie({
  data,
  loading,
  valueFormatter,
  centerLabel,
}: {
  data: PieSlice[]
  loading: boolean
  valueFormatter: (n: number) => string
  centerLabel: string
}) {
  const total = data.reduce((sum, row) => sum + row.value, 0)
  if (loading && data.length === 0) {
    return <div className="flex h-[240px] items-center justify-center text-sm text-slate-500">Loading…</div>
  }
  if (data.length === 0 || total === 0) {
    return <EmptyState title="No engagement data" />
  }
  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
      <div className="relative mx-auto h-[200px] w-[200px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={62} outerRadius={88} paddingAngle={data.length > 1 ? 3 : 0} dataKey="value" nameKey="name" isAnimationActive={false}>
              {data.map((entry, index) => (
                <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} stroke="#fff" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip formatter={(value: number, name: string) => [valueFormatter(value), name]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{centerLabel}</span>
          <span className="mt-0.5 text-base font-bold text-slate-900">{valueFormatter(total)}</span>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-2">
        {data.map((item, index) => (
          <li key={item.name} className="flex items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
              <span className="text-slate-700">{item.name}</span>
            </span>
            <span className="font-medium tabular-nums text-slate-900">{valueFormatter(item.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
