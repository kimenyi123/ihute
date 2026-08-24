"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Bar,
  BarChart,
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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  EmptyState,
  SectionCard,
  fmtNum,
  fmtRwf,
  type SellerOption,
} from "@/components/admin/activity-analytics-shell"
import { fetchAdminProtectedApi } from "@/lib/admin-client"
import { useAuthStore } from "@/lib/auth-store"
import {
  DOW_LABELS,
  type ReportSchedule,
  type ShopAnalyticsBundle,
} from "@/lib/shop-analytics-types"
import { cn } from "@/lib/utils"
import { Download, Mail, Save } from "lucide-react"

const PIE_COLORS = ["#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#ec4899", "#94a3b8"]

type Props = {
  analytics: ShopAnalyticsBundle
  sellerOptions: SellerOption[]
  sellerAccount: string
  compareSellers: string[]
  onCompareChange: (accounts: string[]) => void
  from: string
  to: string
  loading?: boolean
}

export function ShopAnalyticsPanels({
  analytics,
  sellerOptions,
  sellerAccount,
  compareSellers,
  onCompareChange,
  from,
  to,
  loading,
}: Props) {
  const user = useAuthStore((s) => s.user)
  const [section, setSection] = useState("products")
  const [reportEmail, setReportEmail] = useState(user?.email || "")
  const [schedule, setSchedule] = useState<ReportSchedule>({ enabled: false, frequency: "weekly" })
  const [reportMsg, setReportMsg] = useState("")

  const sections = [
    { id: "products", label: "Products" },
    { id: "funnel", label: "Funnel" },
    { id: "buyers", label: "Buyers" },
    { id: "heatmap", label: "Heatmap" },
    { id: "channels", label: "Channels" },
    { id: "compare", label: "Compare" },
    { id: "commission", label: "Commission" },
    { id: "abandon", label: "Abandonment" },
    { id: "search", label: "Search" },
    { id: "reports", label: "Reports" },
    { id: "accounting", label: "Accounting" },
  ]

  const funnelSteps = useMemo(() => {
    const f = analytics.funnel || {}
    return [
      { step: "Shop visits", count: f.shopVisits ?? 0 },
      { step: "Add to cart", count: f.addToCart ?? 0 },
      { step: "Checkout", count: f.checkoutSubmit ?? 0 },
      { step: "Paid orders", count: f.paidOrders ?? 0 },
    ]
  }, [analytics.funnel])

  const heatmapGrid = useMemo(() => {
    const grid: Record<string, number> = {}
    for (const c of analytics.heatmap || []) {
      const key = `${c.dayOfWeek}-${c.hour}`
      grid[key] = c.orderCount ?? 0
    }
    return grid
  }, [analytics.heatmap])

  const channelPie = useMemo(() => {
    const c = analytics.channelSplit || {}
    return [
      { name: "Table / in-venue", value: c.tableOrders ?? 0 },
      { name: "Online tagged", value: c.onlineTagged ?? 0 },
      { name: "QR attributed", value: c.qrOrders ?? 0 },
      { name: "Other shop", value: c.otherShop ?? 0 },
    ].filter((x) => x.value > 0)
  }, [analytics.channelSplit])

  const loadSchedule = useCallback(async () => {
    const res = await fetchAdminProtectedApi("/api/activity/shop-report?action=getShopReportSchedule")
    const json = (await res.json().catch(() => ({}))) as ReportSchedule & { ok?: boolean }
    if (json.ok !== false) {
      setSchedule({
        enabled: !!json.enabled,
        frequency: json.frequency || "weekly",
        recipientEmail: json.recipientEmail || "",
        sellerAccount: json.sellerAccount || "",
      })
      if (json.recipientEmail) setReportEmail(json.recipientEmail)
    }
  }, [])

  useEffect(() => {
    void loadSchedule()
  }, [loadSchedule])

  async function sendReport() {
    setReportMsg("")
    const res = await fetchAdminProtectedApi("/api/activity/shop-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "sendShopAnalyticsReport",
        recipientEmail: reportEmail,
        from,
        to,
        sellerAccount,
        compareSellers: compareSellers.join(","),
      }),
    })
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
    setReportMsg(json.ok ? "Report email sent." : json.error || "Send failed")
  }

  async function saveSchedule() {
    setReportMsg("")
    const res = await fetchAdminProtectedApi("/api/activity/shop-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "saveShopReportSchedule",
        enabled: schedule.enabled,
        frequency: schedule.frequency,
        recipientEmail: reportEmail,
        sellerAccount: sellerAccount || schedule.sellerAccount,
      }),
    })
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean }
    setReportMsg(json.ok ? "Schedule saved." : "Could not save schedule")
  }

  function exportAccountingCsv() {
    const rows = analytics.accountingRows || []
    const header = [
      "order",
      "date",
      "amount",
      "payment_status",
      "buyer",
      "seller",
      "seller_account",
      "seller_tin",
      "seller_momo",
      "delivery",
    ]
    const body = rows.map((r) => [
      r.orderNumber || String(r.orderId ?? ""),
      r.timestamp || "",
      String(r.amount ?? 0),
      r.paymentStatus || "",
      r.buyerName || "",
      r.sellerName || "",
      r.sellerAccount || "",
      r.sellerTin || "",
      r.sellerMomo || "",
      r.deliveryLocation || "",
    ])
    const csv = [header, ...body].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `ihute_accounting_${from}_${to}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function toggleCompare(acc: string) {
    if (compareSellers.includes(acc)) {
      onCompareChange(compareSellers.filter((a) => a !== acc))
    } else if (compareSellers.length < 3) {
      onCompareChange([...compareSellers, acc])
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSection(s.id)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition sm:text-sm",
              section === s.id ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {section === "products" && (
        <SectionCard title="Top products (shop-with-me)" subtitle="Line items from shop orders in range">
          {(analytics.topProducts || []).length === 0 ? (
            <EmptyState title="No product lines" description="Orders need line items in order_transaction_list." />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">Qty</th>
                    <th className="px-4 py-3">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(analytics.topProducts || []).map((p, i) => (
                    <tr key={`${p.itemCode}-${i}`} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{p.itemName || "—"}</td>
                      <td className="px-4 py-3 text-slate-600">{p.itemCode || p.nikiCode || "—"}</td>
                      <td className="px-4 py-3 tabular-nums">{fmtNum(p.quantitySold ?? 0)}</td>
                      <td className="px-4 py-3 font-semibold tabular-nums">{fmtRwf(p.revenue ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      )}

      {section === "funnel" && (
        <SectionCard title="Shop funnel" subtitle="Visits → cart → checkout → paid (per shop when seller selected)">
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelSteps} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="step" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => fmtNum(v)} />
                <Bar dataKey="count" fill="#7c3aed" radius={[4, 4, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 text-sm text-slate-600">
            Visit → order rate: <strong>{analytics.funnel?.visitToOrderRate ?? 0}%</strong>
          </p>
        </SectionCard>
      )}

      {section === "buyers" && (
        <SectionCard title="Buyer loyalty" subtitle="New vs repeat buyers in period">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Mini label="Unique buyers" value={fmtNum(analytics.buyerLoyalty?.uniqueBuyers ?? 0)} />
            <Mini label="One order in period" value={fmtNum(analytics.buyerLoyalty?.oneTimeInPeriod ?? 0)} />
            <Mini label="Repeat in period" value={fmtNum(analytics.buyerLoyalty?.repeatInPeriod ?? 0)} />
            <Mini label="Returned (prior orders)" value={fmtNum(analytics.buyerLoyalty?.returningFromBefore ?? 0)} />
          </div>
        </SectionCard>
      )}

      {section === "heatmap" && (
        <SectionCard title="Orders by hour & day" subtitle="When buyers order from shop-with-me">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className="p-1 text-left text-slate-500">Day \\ Hour</th>
                  {Array.from({ length: 24 }, (_, h) => (
                    <th key={h} className="p-1 text-center font-normal text-slate-400">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4, 5, 6, 7].map((dow) => (
                  <tr key={dow}>
                    <td className="whitespace-nowrap p-1 font-medium text-slate-700">{DOW_LABELS[dow - 1]}</td>
                    {Array.from({ length: 24 }, (_, h) => {
                      const n = heatmapGrid[`${dow}-${h}`] || 0
                      const intensity = n === 0 ? 0 : Math.min(1, n / 10)
                      return (
                        <td
                          key={h}
                          className="p-0.5 text-center tabular-nums"
                          style={{
                            backgroundColor: n ? `rgba(99, 102, 241, ${0.15 + intensity * 0.75})` : undefined,
                          }}
                          title={`${n} orders`}
                        >
                          {n > 0 ? n : ""}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {section === "channels" && (
        <SectionCard title="Table vs online" subtitle="In-venue table orders vs tagged online shop checkouts">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="h-[240px]">
              {channelPie.length === 0 ? (
                <EmptyState title="No channel data" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={channelPie} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                      {channelPie.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmtNum(v)} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="grid gap-2">
              <Mini label="Table orders" value={fmtNum(analytics.channelSplit?.tableOrders ?? 0)} />
              <Mini label="Table GMV" value={fmtRwf(analytics.channelSplit?.tableGmv ?? 0)} />
              <Mini label="Online tagged" value={fmtNum(analytics.channelSplit?.onlineTagged ?? 0)} />
              <Mini label="Online GMV" value={fmtRwf(analytics.channelSplit?.onlineGmv ?? 0)} />
            </div>
          </div>
        </SectionCard>
      )}

      {section === "compare" && (
        <SectionCard
          title="Compare sellers (up to 3)"
          subtitle="Pick pharmacies to compare GMV and orders side-by-side"
        >
          <div className="mb-4 flex flex-wrap gap-2">
            {sellerOptions.slice(0, 30).map((s) => (
              <button
                key={s.sellerAccount}
                type="button"
                onClick={() => toggleCompare(s.sellerAccount)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition",
                  compareSellers.includes(s.sellerAccount)
                    ? "border-indigo-600 bg-indigo-50 text-indigo-800"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50",
                )}
              >
                {(s.sellerName || s.sellerAccount).slice(0, 24)}
              </button>
            ))}
          </div>
          {(analytics.compareSellers || []).length === 0 ? (
            <EmptyState title="Select sellers to compare" description="Click up to 3 seller chips above." />
          ) : (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={(analytics.compareSellers || []).map((s) => ({
                    name: (s.sellerName || s.sellerAccount || "").slice(0, 16),
                    gmv: s.gmvTotal ?? 0,
                    orders: s.orderCount ?? 0,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="l" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar yAxisId="l" dataKey="orders" fill="#6366f1" name="Orders" />
                  <Line yAxisId="r" type="monotone" dataKey="gmv" stroke="#db2777" name="GMV" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>
      )}

      {section === "commission" && (
        <SectionCard title="Commission & net payout" subtitle="Platform fee on shop-with-me GMV">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Mini label="GMV" value={fmtRwf(analytics.commission?.gmv ?? 0)} />
            <Mini
              label="Rate"
              value={`${analytics.commission?.commissionRatePercent ?? 0}%`}
            />
            <Mini label="IHUTE commission" value={fmtRwf(analytics.commission?.platformCommission ?? 0)} />
            <Mini label="Net to seller" value={fmtRwf(analytics.commission?.netPayout ?? 0)} />
          </div>
        </SectionCard>
      )}

      {section === "abandon" && (
        <SectionCard title="Cart abandonment" subtitle="Sessions that added to cart or checked out without paying">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Mini label="Add to cart events" value={fmtNum(analytics.cartAbandonment?.addToCart ?? 0)} />
            <Mini label="Checkout submits" value={fmtNum(analytics.cartAbandonment?.checkoutSubmit ?? 0)} />
            <Mini label="Paid orders" value={fmtNum(analytics.cartAbandonment?.paidOrders ?? 0)} />
            <Mini label="Abandoned after cart" value={fmtNum(analytics.cartAbandonment?.abandonedAfterCart ?? 0)} />
            <Mini label="Cart abandon %" value={`${analytics.cartAbandonment?.cartAbandonRate ?? 0}%`} />
            <Mini label="Checkout abandon %" value={`${analytics.cartAbandonment?.checkoutAbandonRate ?? 0}%`} />
          </div>
        </SectionCard>
      )}

      {section === "search" && (
        <SectionCard title="Search terms on shop" subtitle="Queries from shop-with-me pages (activity_events)">
          {(analytics.searchTerms || []).length === 0 ? (
            <EmptyState title="No shop searches logged" description="Search tracking improves as buyers search on /shop-with-me." />
          ) : (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {(analytics.searchTerms || []).map((t) => (
                <li key={t.term} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="font-medium text-slate-800">{t.term}</span>
                  <span className="tabular-nums text-slate-500">{fmtNum(t.count ?? 0)}</span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      )}

      {section === "reports" && (
        <SectionCard title="Email & scheduled reports" subtitle="Send now or save a weekly schedule (cron can call /api/activity/shop-report)">
          <div className="grid max-w-lg gap-3">
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium uppercase text-slate-500">Recipient email</span>
              <Input value={reportEmail} onChange={(e) => setReportEmail(e.target.value)} type="email" />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={() => void sendReport()} disabled={loading}>
                <Mail className="mr-2 h-4 w-4" />
                Email report now
              </Button>
            </div>
            <hr className="border-slate-200" />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!schedule.enabled}
                onChange={(e) => setSchedule((s) => ({ ...s, enabled: e.target.checked }))}
              />
              Enable weekly scheduled report
            </label>
            <Button type="button" variant="outline" size="sm" onClick={() => void saveSchedule()}>
              <Save className="mr-2 h-4 w-4" />
              Save schedule
            </Button>
            {reportMsg ? <p className="text-sm text-slate-600">{reportMsg}</p> : null}
            <p className="text-xs text-slate-500">
              For automation, call POST /api/activity/shop-report with Bearer STOCK_SYNC_LOGS_API_SECRET and action
              sendShopAnalyticsReport on a cron (e.g. every Monday).
            </p>
          </div>
        </SectionCard>
      )}

      {section === "accounting" && (
        <SectionCard
          title="Accounting export"
          subtitle="Orders with TIN, MoMo, payment status — for finance"
          action={
            <Button type="button" variant="outline" size="sm" onClick={exportAccountingCsv}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          }
        >
          {(analytics.accountingRows || []).length === 0 ? (
            <EmptyState title="No rows" />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-96">
              <table className="min-w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Order</th>
                    <th className="px-3 py-2">Amount</th>
                    <th className="px-3 py-2">Payment</th>
                    <th className="px-3 py-2">TIN</th>
                    <th className="px-3 py-2">MoMo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(analytics.accountingRows || []).slice(0, 50).map((r) => (
                    <tr key={r.orderId}>
                      <td className="px-3 py-2">{r.orderNumber || r.orderId}</td>
                      <td className="px-3 py-2 tabular-nums">{fmtRwf(r.amount ?? 0)}</td>
                      <td className="px-3 py-2">{r.paymentStatus || "—"}</td>
                      <td className="px-3 py-2">{r.sellerTin || "—"}</td>
                      <td className="px-3 py-2">{r.sellerMomo || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      )}
    </div>
  )
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-bold tabular-nums text-slate-900">{value}</p>
    </div>
  )
}
