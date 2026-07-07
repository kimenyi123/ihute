/** Types for extended shop-with-me analytics API (`analytics` key on commercial-stats). */

export type ShopProductRow = {
  itemName?: string
  itemCode?: string
  nikiCode?: string
  quantitySold?: number
  revenue?: number
}

export type ShopFunnel = {
  shopVisits?: number
  addToCart?: number
  checkoutStarted?: number
  checkoutSubmit?: number
  paidOrders?: number
  visitToOrderRate?: number
}

export type BuyerLoyalty = {
  uniqueBuyers?: number
  oneTimeInPeriod?: number
  repeatInPeriod?: number
  returningFromBefore?: number
}

export type HeatmapCell = {
  dayOfWeek?: number
  hour?: number
  orderCount?: number
  gmv?: number
}

export type ChannelSplit = {
  tableOrders?: number
  onlineTagged?: number
  otherShop?: number
  tableGmv?: number
  onlineGmv?: number
}

export type CompareSellerRow = {
  sellerAccount?: string
  sellerName?: string
  shopNickname?: string
  orderCount?: number
  gmvTotal?: number
  uniqueBuyers?: number
  shopPageViews?: number
}

export type CommissionSummary = {
  commissionRate?: number
  commissionRatePercent?: number
  gmv?: number
  platformCommission?: number
  netPayout?: number
  orderCount?: number
}

export type CartAbandonment = {
  addToCart?: number
  checkoutSubmit?: number
  paidOrders?: number
  abandonedAfterCart?: number
  abandonedAfterCheckout?: number
  cartAbandonRate?: number
  checkoutAbandonRate?: number
}

export type SearchTermRow = {
  term?: string
  count?: number
}

export type AccountingRow = {
  orderId?: number
  orderNumber?: string
  timestamp?: string
  amount?: number
  orderStatus?: string
  paymentStatus?: string
  buyerName?: string
  buyerEmail?: string
  sellerName?: string
  sellerAccount?: string
  sellerTin?: string
  sellerMomo?: string
  sellerEmail?: string
  conditions?: string
  deliveryLocation?: string
}

export type ShopAnalyticsBundle = {
  topProducts?: ShopProductRow[]
  funnel?: ShopFunnel
  buyerLoyalty?: BuyerLoyalty
  heatmap?: HeatmapCell[]
  channelSplit?: ChannelSplit
  compareSellers?: CompareSellerRow[]
  commission?: CommissionSummary
  cartAbandonment?: CartAbandonment
  searchTerms?: SearchTermRow[]
  accountingRows?: AccountingRow[]
}

export type ReportSchedule = {
  enabled?: boolean
  frequency?: string
  recipientEmail?: string
  sellerAccount?: string
}

export const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
