/**
 * Maps Java / DB ORDER_STATUS strings (including B2B truck flows) to canonical UI slugs.
 * Handles: INVOICE, FACTURE, INVOICE>>LOADED, FACTURE>>LOADED, comma-separated stages, DELIVERED, etc.
 */

export type TrackOrderStatus =
  | "open"
  | "pending"
  | "processing"
  | "invoice"
  | "in-transit"
  | "delivered"
  | "cancelled"

/** Aligns with `Order["status"]` in orders-store */
export type StoreOrderStatus =
  | "pending"
  | "processing"
  | "in-transit"
  | "delivered"
  | "cancelled"
  | "open"
  | "invoice"

const CANCEL_RE = /\bcancel(l)?ed\b/i

function tokenRank(t: string): number {
  const x = t.trim().toLowerCase()
  if (!x) return 0
  if (CANCEL_RE.test(x)) return -1
  if (
    /\bdelivered\b/.test(x) ||
    x.includes("completed") ||
    x === "complete"
  )
    return 5
  if (
    x.includes("loaded") ||
    x.includes("transit") ||
    x.includes("shipped") ||
    x.includes("en route") ||
    x.includes("dispatch") ||
    x.includes("out for delivery") ||
    x.includes("out_for_delivery")
  )
    return 4
  if (x.includes("invoice") || x.includes("facture")) return 3
  if (
    x.includes("processing") ||
    x.includes("preparing") ||
    x.includes("preparation") ||
    x.includes("confirm")
  )
    return 2
  if (x === "open") return 1
  if (x.includes("pending") || x.includes("await")) return 0.5
  return 0
}

/**
 * Parse raw ORDER_STATUS: comma-separated stages; each stage may use >> as a sub-chain.
 * Returns null if nothing recognized (caller may fall back to payment rules).
 */
export function rankFromOrderStatusRaw(raw: string): number | null {
  const s = raw.trim()
  if (!s) return null

  let max = 0
  let sawCancel = false
  const commaParts = s.split(",").map((p) => p.trim()).filter(Boolean)

  for (const part of commaParts) {
    const stages = part.split(">>").map((x) => x.trim()).filter(Boolean)
    for (const st of stages) {
      const r = tokenRank(st)
      if (r === -1) sawCancel = true
      else if (r > max) max = r
    }
  }

  if (sawCancel) return -1
  return max > 0 ? max : null
}

function legacyOrderStatusHints(orderStatus: string): TrackOrderStatus | null {
  const s = orderStatus.toLowerCase()
  if (/\b(cancel|canceled|reject|rejected|refused)\b/.test(s)) return "cancelled"
  if (/\bdelivered\b/.test(s) || s.includes("completed")) return "delivered"
  if (
    s.includes("transit") ||
    s.includes("shipped") ||
    s.includes("out for delivery") ||
    s.includes("out_for_delivery")
  )
    return "in-transit"
  if (s.includes("invoice") || s.includes("facture")) return "invoice"
  if (s.includes("processing") || s.includes("preparing") || s.includes("confirm")) return "processing"
  if (s.includes("open")) return "open"
  return null
}

/**
 * Canonical status for /api/orders/track and track-order UI (includes payment fallback).
 */
export function mapBackendOrderStatusToTrack(
  orderStatus?: string,
  paymentStatus?: string
): TrackOrderStatus {
  if (orderStatus) {
    const hintFirst = legacyOrderStatusHints(orderStatus)
    if (hintFirst === "cancelled") return "cancelled"
    const rank = rankFromOrderStatusRaw(orderStatus)
    if (rank === -1) return "cancelled"
    if (rank != null) {
      if (rank >= 5) return "delivered"
      if (rank >= 4) return "in-transit"
      if (rank >= 3) return "invoice"
      if (rank >= 2) return "processing"
      if (rank >= 1) return "open"
      if (rank >= 0.5) return "pending"
    }
    const hint = legacyOrderStatusHints(orderStatus)
    if (hint) return hint
  }

  if (paymentStatus) {
    const p = paymentStatus.toLowerCase()
    if (p === "paid" || p === "success") return "processing"
    if (p === "pending") return "pending"
    if (p === "failed") return "open"
  }

  return "open"
}

/** orders-store Order["status"] — includes cancelled */
export function mapBackendOrderStatusToStore(raw?: string): StoreOrderStatus {
  if (!raw?.trim()) return "pending"
  const rank = rankFromOrderStatusRaw(raw)
  if (rank === -1) return "cancelled"
  if (rank != null) {
    if (rank >= 5) return "delivered"
    if (rank >= 4) return "in-transit"
    if (rank >= 3) return "invoice"
    if (rank >= 2) return "processing"
    if (rank >= 1) return "open"
    if (rank >= 0.5) return "pending"
  }

  const s = raw.toLowerCase()
  if (s === "delivered") return "delivered"
  if (s === "cancelled" || s === "canceled") return "cancelled"
  if (s === "open") return "open"
  if (s === "processing" || s === "in-transit") return s as StoreOrderStatus
  if (s === "invoice") return "invoice"
  return "pending"
}

/** True when raw or canonical slug means delivery is complete */
export function statusIndicatesDelivered(status?: string | null): boolean {
  if (status == null || status === "") return false
  if (status === "delivered") return true
  const r = rankFromOrderStatusRaw(status)
  return r != null && r >= 5
}
