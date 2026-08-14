"use client"

import Link from "next/link"
import type { ReactNode } from "react"
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
import { formatAdminCurrency } from "@/lib/admin-order-monitor"
import {
  CHART_SLATE,
  formatChartDate,
  type OrderMonitorStats,
} from "@/lib/admin-order-stats"

type OrderMonitorChartsProps = {
  stats: OrderMonitorStats | null
  loading: boolean
  totalRevenue?: number
  filteredCount?: number
  platformCommission?: number
  openRevenue?: number
  openOrderCount?: number
  paidRevenue?: number
  paidOrderCount?: number
}

function ChartShell({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string
  subtitle?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`rounded-lg border border-slate-200 bg-white p-4 ${className}`}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
      </div>
      {children}
    </div>
  )
}

function TrendTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { dataKey: string; value: number; color: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  const orders = payload.find((p) => p.dataKey === "orderCount")?.value ?? 0
  const gmv = payload.find((p) => p.dataKey === "gmv")?.value ?? 0
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="font-medium text-slate-900">{label ? formatChartDate(String(label)) : ""}</p>
      <p className="mt-1 text-slate-600">{orders} orders</p>
      <p className="text-slate-600">{formatAdminCurrency(gmv)}</p>
    </div>
  )
}

function CountTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: { payload: { label: string; value: number } }[]
}) {
  if (!active || !payload?.[0]) return null
  const { label, value } = payload[0].payload
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="font-medium text-slate-900">{label}</p>
      <p className="text-slate-600">{value} orders</p>
    </div>
  )
}

export function OrderMonitorCharts({
  stats,
  loading,
  totalRevenue,
  filteredCount,
  platformCommission,
  openRevenue,
  openOrderCount,
  paidRevenue,
  paidOrderCount,
}: OrderMonitorChartsProps) {
  const trend = stats?.dailyTrend ?? []
  const statusData = stats?.statusBreakdown ?? []
  const paymentData = stats?.paymentBreakdown ?? []
  const fulfillmentData =
    stats?.fulfillmentBreakdown?.length
      ? stats.fulfillmentBreakdown
      : stats
        ? [
            { label: "Awaiting seller", value: stats.awaitingSellerCount },
            { label: "Seller serving", value: stats.sellerServingCount },
            { label: "Completed", value: stats.completedCount },
          ].filter((r) => r.value > 0)
        : []
  const topSellers = stats?.topSellers ?? []

  const kpis = [
    {
      label: "Awaiting seller",
      value: stats ? String(stats.awaitingSellerCount) : "—",
      hint: "Not served — still OPEN, no served qty",
    },
    {
      label: "Seller serving",
      value: stats ? String(stats.sellerServingCount) : "—",
      hint: "Status moved or items confirmed",
    },
    {
      label: "Completed",
      value: stats ? String(stats.completedCount) : "—",
      hint: "Delivered to buyer",
    },
    {
      label: "Paid · still open",
      value: stats ? String(stats.paidOpenCount) : "—",
      hint: "Buyer paid, seller status OPEN",
    },
  ]

  const moneyKpis = [
    {
      label: "Open GMV",
      value: openRevenue != null ? formatAdminCurrency(openRevenue) : "—",
      hint:
        openOrderCount != null
          ? `${openOrderCount.toLocaleString()} unpaid · no commission`
          : "Unpaid (non-cancelled)",
    },
    {
      label: "Paid GMV",
      value: paidRevenue != null ? formatAdminCurrency(paidRevenue) : totalRevenue != null ? formatAdminCurrency(totalRevenue) : "—",
      hint:
        paidOrderCount != null
          ? `${paidOrderCount.toLocaleString()} paid orders`
          : filteredCount != null
            ? `${filteredCount.toLocaleString()} in filter`
            : "PAID payment status",
    },
    {
      label: "Paid commission",
      value: platformCommission != null ? formatAdminCurrency(platformCommission) : "—",
      hint: "AMOUNT × platform rate on PAID only",
    },
  ]

  return (
    <div className="mb-8 space-y-4">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-white px-4 py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{kpi.label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{kpi.value}</p>
            {kpi.hint ? <p className="mt-1 text-[11px] leading-snug text-slate-500">{kpi.hint}</p> : null}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 sm:grid-cols-3">
        {moneyKpis.map((kpi) => (
          <div key={kpi.label} className="bg-white px-4 py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{kpi.label}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{kpi.value}</p>
            {kpi.hint ? <p className="mt-1 text-[11px] leading-snug text-slate-500">{kpi.hint}</p> : null}
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <ChartShell
          title="Orders & GMV"
          subtitle={stats ? `Last ${stats.trendDays} days` : "Loading trend…"}
          className="lg:col-span-7"
        >
          {loading && trend.length === 0 ? (
            <div className="flex h-[260px] items-center justify-center text-sm text-slate-400">Loading chart…</div>
          ) : trend.length === 0 ? (
            <div className="flex h-[260px] items-center justify-center text-sm text-slate-400">No orders in this period</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatChartDate}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  axisLine={{ stroke: "#e2e8f0" }}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="orders"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                  width={32}
                  allowDecimals={false}
                />
                <YAxis
                  yAxisId="gmv"
                  orientation="right"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                  tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
                />
                <Tooltip content={<TrendTooltip />} />
                <Bar yAxisId="orders" dataKey="orderCount" fill="#334155" radius={[2, 2, 0, 0]} maxBarSize={28} name="Orders" />
                <Line
                  yAxisId="gmv"
                  type="monotone"
                  dataKey="gmv"
                  stroke="#0f172a"
                  strokeWidth={2}
                  dot={false}
                  name="GMV"
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </ChartShell>

        <ChartShell title="Seller fulfillment" subtitle="Has the seller served the order?" className="lg:col-span-5">
          {loading && fulfillmentData.length === 0 ? (
            <div className="flex h-[260px] items-center justify-center text-sm text-slate-400">Loading…</div>
          ) : fulfillmentData.length === 0 ? (
            <div className="flex h-[260px] items-center justify-center text-sm text-slate-400">No data</div>
          ) : (
            <div className="flex h-[260px] items-center">
              <ResponsiveContainer width="55%" height="100%">
                <PieChart>
                  <Pie
                    data={fulfillmentData}
                    dataKey="value"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={78}
                    paddingAngle={2}
                    stroke="#fff"
                    strokeWidth={2}
                  >
                    {fulfillmentData.map((_, i) => (
                      <Cell key={i} fill={CHART_SLATE[i % CHART_SLATE.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CountTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <ul className="flex-1 space-y-2 pr-2 text-xs">
                {fulfillmentData.map((row, i) => (
                  <li key={row.label} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-slate-700">
                      <span
                        className="h-2 w-2 shrink-0 rounded-sm"
                        style={{ backgroundColor: CHART_SLATE[i % CHART_SLATE.length] }}
                      />
                      {row.label}
                    </span>
                    <span className="tabular-nums text-slate-500">{row.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </ChartShell>

        <ChartShell title="Payment status" subtitle="Last 30 days" className="lg:col-span-7">
          {loading && paymentData.length === 0 ? (
            <div className="flex h-[260px] items-center justify-center text-sm text-slate-400">Loading…</div>
          ) : paymentData.length === 0 ? (
            <div className="flex h-[260px] items-center justify-center text-sm text-slate-400">No data</div>
          ) : (
            <div className="flex h-[260px] items-center">
              <ResponsiveContainer width="55%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentData}
                    dataKey="value"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={78}
                    paddingAngle={2}
                    stroke="#fff"
                    strokeWidth={2}
                  >
                    {paymentData.map((_, i) => (
                      <Cell key={i} fill={CHART_SLATE[i % CHART_SLATE.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CountTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <ul className="flex-1 space-y-2 pr-2 text-xs">
                {paymentData.map((row, i) => (
                  <li key={row.label} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-slate-700">
                      <span
                        className="h-2 w-2 shrink-0 rounded-sm"
                        style={{ backgroundColor: CHART_SLATE[i % CHART_SLATE.length] }}
                      />
                      {row.label}
                    </span>
                    <span className="tabular-nums text-slate-500">{row.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </ChartShell>

        <ChartShell title="Order status" subtitle="Last 30 days" className="lg:col-span-4">
          {loading && statusData.length === 0 ? (
            <div className="flex h-[220px] items-center justify-center text-sm text-slate-400">Loading…</div>
          ) : statusData.length === 0 ? (
            <div className="flex h-[220px] items-center justify-center text-sm text-slate-400">No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={statusData} layout="vertical" margin={{ top: 0, right: 8, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={88}
                  tick={{ fontSize: 11, fill: "#475569" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CountTooltip />} />
                <Bar dataKey="value" fill="#475569" radius={[0, 2, 2, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartShell>

        <ChartShell title="Top sellers" subtitle="Last 7 days by order count" className="lg:col-span-8">
          {loading && topSellers.length === 0 ? (
            <div className="flex h-[220px] items-center justify-center text-sm text-slate-400">Loading…</div>
          ) : topSellers.length === 0 ? (
            <div className="flex h-[220px] items-center justify-center text-sm text-slate-400">No seller activity</div>
          ) : (
            <div className="space-y-2">
              {topSellers.map((s, i) => {
                const max = topSellers[0]?.orderCount || 1
                const pct = Math.round((s.orderCount / max) * 100)
                return (
                  <div key={s.sellerAccount || i}>
                    <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                      <Link
                        href={`/admin/orders?sellerAccount=${encodeURIComponent(s.sellerAccount)}`}
                        className="truncate font-medium text-slate-800 hover:underline"
                      >
                        {s.sellerName || s.sellerAccount}
                      </Link>
                      <span className="shrink-0 tabular-nums text-slate-500">
                        {s.orderCount} · {formatAdminCurrency(s.gmv)}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-slate-700" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </ChartShell>
      </div>
    </div>
  )
}
