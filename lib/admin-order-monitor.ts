import { mapBackendOrderStatusToTrack, type TrackOrderStatus } from "@/lib/order-status-map"

export type AdminMonitorOrder = {
  id: number
  orderNumber?: string
  sellerName?: string
  sellerIshyigaAccount?: string
  sellerPhone?: string
  buyerName?: string
  buyerPhone?: string
  buyerEmail?: string
  amount: number
  status: string
  paymentStatus?: string
  paymentName?: string
  paymentId?: string
  timestamp: string
  deliveryLocation?: string
  needsAttention?: boolean
  servedAmount?: number
  servedQtyTotal?: number
  sellerFulfillment?: SellerFulfillment
}

/** Whether the seller has acted on the order (served items / moved status). */
export type SellerFulfillment = "awaiting_seller" | "seller_serving" | "completed" | "cancelled"

export type OrderAttentionReason = "paid_open" | "missing_buyer_phone" | "guest_buyer"

export function deriveSellerFulfillment(order: AdminMonitorOrder): SellerFulfillment {
  if (order.sellerFulfillment) return order.sellerFulfillment
  const st = (order.status ?? "").toUpperCase()
  if (st.includes("CANCEL")) return "cancelled"
  if (st.includes("DELIVERED") || st.includes("COMPLET")) return "completed"
  const servedAmount = Number(order.servedAmount ?? 0)
  const servedQty = Number(order.servedQtyTotal ?? 0)
  if (servedAmount > 0 || servedQty > 0) return "seller_serving"
  if (st === "OPEN" || st === "PENDING" || !st) return "awaiting_seller"
  return "seller_serving"
}

export function sellerFulfillmentLabel(f: SellerFulfillment): string {
  switch (f) {
    case "awaiting_seller":
      return "Not served yet"
    case "seller_serving":
      return "Seller serving"
    case "completed":
      return "Completed"
    case "cancelled":
      return "Cancelled"
    default:
      return "Unknown"
  }
}

export function sellerFulfillmentHint(f: SellerFulfillment): string {
  switch (f) {
    case "awaiting_seller":
      return "Seller has not updated status or confirmed items"
    case "seller_serving":
      return "Seller moved order forward or recorded served qty"
    case "completed":
      return "Delivered / completed"
    case "cancelled":
      return "Order cancelled"
    default:
      return ""
  }
}

export function getOrderAttentionReasons(order: AdminMonitorOrder): OrderAttentionReason[] {
  const reasons: OrderAttentionReason[] = []
  const pay = (order.paymentStatus ?? "").toUpperCase()
  const st = (order.status ?? "").toUpperCase()
  const phone = (order.buyerPhone ?? "").trim()
  const name = (order.buyerName ?? "").trim()

  if (pay === "PAID" && st === "OPEN") reasons.push("paid_open")
  if (!phone || phone.toUpperCase() === "NA" || phone.toUpperCase() === "N/A") {
    reasons.push("missing_buyer_phone")
  }
  if (!name || name.toLowerCase() === "guest" || name.toUpperCase() === "NA") {
    reasons.push("guest_buyer")
  }
  return reasons
}

export function orderNeedsAttention(order: AdminMonitorOrder): boolean {
  if (order.needsAttention === true) return true
  return getOrderAttentionReasons(order).length > 0
}

export function attentionReasonLabel(reason: OrderAttentionReason): string {
  switch (reason) {
    case "paid_open":
      return "Paid — seller not updated"
    case "missing_buyer_phone":
      return "Buyer phone missing"
    case "guest_buyer":
      return "Guest / unnamed buyer"
    default:
      return "Needs follow-up"
  }
}

export function formatAdminCurrency(amount: number): string {
  return new Intl.NumberFormat("en-RW", {
    style: "currency",
    currency: "RWF",
    currencyDisplay: "code",
    minimumFractionDigits: 0,
  }).format(amount)
}

export function formatOrderTime(ts: string): string {
  const d = new Date(ts)
  return Number.isNaN(d.getTime()) ? ts : d.toLocaleString()
}

export function formatOrderTimeRelative(ts: string): string {
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ts
  const diffMs = Date.now() - d.getTime()
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString()
}

export function getStatusLabel(status: TrackOrderStatus): string {
  switch (status) {
    case "pending":
      return "Pending"
    case "open":
      return "Open"
    case "processing":
      return "Processing"
    case "invoice":
      return "Invoice"
    case "in-transit":
      return "Out for delivery"
    case "delivered":
      return "Delivered"
    default:
      return "Open"
  }
}

/** Neutral admin UI — no colored status pills */
export function getStatusBadgeClass(status?: TrackOrderStatus): string {
  switch (status) {
    case "open":
      return "inline-flex items-center whitespace-nowrap rounded border border-sky-200 bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700"
    case "delivered":
      return "inline-flex items-center whitespace-nowrap rounded border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700"
    default:
      return "inline-flex items-center whitespace-nowrap rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700"
  }
}

export function getPaymentBadgeClass(paid?: boolean): string {
  return paid
    ? "inline-flex items-center whitespace-nowrap rounded border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700"
    : "inline-flex items-center whitespace-nowrap rounded border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-700"
}

export function normalizeOrderStatus(order: AdminMonitorOrder): TrackOrderStatus {
  return mapBackendOrderStatusToTrack(order.status, order.paymentStatus)
}

export function buyerTrackHref(orderId: number | string): string {
  return `/track-order/${orderId}`
}

export function whatsAppHref(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, "")
  const normalized = digits.startsWith("250") ? digits : digits.startsWith("0") ? `250${digits.slice(1)}` : digits
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`
}
