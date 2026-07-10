import { postAdminApi } from "@/lib/admin-client"

export type DailyTrendPoint = {
  date: string
  orderCount: number
  gmv: number
}

export type BreakdownPoint = {
  label: string
  value: number
}

export type TopSellerPoint = {
  sellerName: string
  sellerAccount: string
  orderCount: number
  gmv: number
}

export type OrderMonitorStats = {
  dailyTrend: DailyTrendPoint[]
  statusBreakdown: BreakdownPoint[]
  paymentBreakdown: BreakdownPoint[]
  topSellers: TopSellerPoint[]
  attentionCount: number
  paidOpenCount: number
  todayOrders: number
  todayGmv: number
  gmv30d: number
  trendDays: number
  awaitingSellerCount: number
  sellerServingCount: number
  completedCount: number
  fulfillmentBreakdown: BreakdownPoint[]
}

export async function fetchOrderMonitorStats(): Promise<OrderMonitorStats | null> {
  try {
    const res = await postAdminApi({ action: "getOrderMonitorStats" })
    const data = await res.json()
    if (!data.ok) return null
    return {
      dailyTrend: (data.dailyTrend ?? []) as DailyTrendPoint[],
      statusBreakdown: (data.statusBreakdown ?? []) as BreakdownPoint[],
      paymentBreakdown: (data.paymentBreakdown ?? []) as BreakdownPoint[],
      topSellers: (data.topSellers ?? []) as TopSellerPoint[],
      attentionCount: Number(data.attentionCount ?? 0),
      paidOpenCount: Number(data.paidOpenCount ?? 0),
      todayOrders: Number(data.todayOrders ?? 0),
      todayGmv: Number(data.todayGmv ?? 0),
      gmv30d: Number(data.gmv30d ?? 0),
      trendDays: Number(data.trendDays ?? 14),
      awaitingSellerCount: Number(data.awaitingSellerCount ?? 0),
      sellerServingCount: Number(data.sellerServingCount ?? 0),
      completedCount: Number(data.completedCount ?? 0),
      fulfillmentBreakdown: (data.fulfillmentBreakdown ?? []) as BreakdownPoint[],
    }
  } catch {
    return null
  }
}

export function formatChartDate(isoDate: string): string {
  const d = new Date(isoDate)
  if (Number.isNaN(d.getTime())) return isoDate
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

/** Monochrome palette — no rainbow AI gradients */
export const CHART_SLATE = ["#0f172a", "#1e293b", "#334155", "#475569", "#64748b", "#94a3b8", "#cbd5e1"] as const
