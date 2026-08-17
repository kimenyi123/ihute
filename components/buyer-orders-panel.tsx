"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/lib/auth-store"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useOrdersStore, type Order, type OrderItem } from "@/lib/orders-store"
import { isInvoiceFinanced, canRequestInvoiceFinancing } from "@/lib/order-financing"
import { mapBackendOrderStatusToStore } from "@/lib/order-status-map"
import { Calendar, Clock, Package, Plus, Store, Truck } from "lucide-react"
import { GRANDMA_PATHS } from "@/lib/grandma-urls"
import {
  GRANDMA_REORDER_STORAGE_KEY,
  buildGrandmaShopId,
  inferGrandmaCategoryFromHint,
  type GrandmaReorderPayload,
} from "@/lib/grandma-reorder"
import { NO_IMAGE_URL } from "@/lib/image-utils"
import {
  GRANDMA_ORDER_PLACED_EVENT,
  type GrandmaOrderPlacedDetail,
} from "@/lib/grandma-order-live"
import {
  clearGrandmaPendingOrderIfMatched,
  elevateJustPlacedGrandmaOrder,
  getGrandmaJustPlacedOrderId,
  isGrandmaJustPlaced,
  loadGrandmaPendingOrder,
  orderIdKey,
  saveGrandmaPendingOrder,
} from "@/lib/grandma-pending-order"

const GRANDMA_ORDERS_POLL_MS = 12_000
const GRANDMA_NOW_TICK_MS = 15_000
/** Grandma: fetch enough rows that the full buyer history fits on one list. */
const GRANDMA_FETCH_PAGE_SIZE = 100
/** Always in status dropdown (OPEN must not disappear when API uses other spellings). */
const GRANDMA_STATUS_FILTER_OPTIONS = [
  "OPEN",
  "DELIVERED",
  "IN TRANSIT",
  "CANCELLED",
] as const

type RawTxn = {
  ID_ORDER?: string
  BUYER_NAME?: string
  SELLER_NAMES?: string
  SELLER_ISHYIGA_ACCOUNT?: string
  AMOUNT?: number
  ORDER_STATUS?: string
  PAYMENT_STATUS?: string
  PAYMENT_NAME?: string
  REKISIYO_STATUS?: string
  CREATED_AT?: number
  BUYER_OWNER?: string
  buyerTIN?: string
  BUYER_TIN?: string
  SUPPLIER_TIN?: string
  SELLER_TIN?: string
  subtotal?: number
  BUYER_ISHYIGA_ACCOUNT?: string
  [key: string]: unknown
}

function pickRawStr(raw: RawTxn, ...keys: string[]): string {
  const o = raw as Record<string, unknown>
  for (const k of keys) {
    const v = o[k]
    if (v != null && String(v).trim() !== "") return String(v).trim()
  }
  return ""
}

function paymentStatusFromRaw(raw: RawTxn): string {
  const direct = raw.PAYMENT_STATUS
  if (direct != null && String(direct).trim() !== "") return String(direct).trim()
  return pickRawStr(raw, "payment_status", "paymentStatus", "PaymentStatus")
}

function toIso(v?: number | string) {
  if (v == null || v === "") return new Date().toISOString()
  if (typeof v === "number" && Number.isFinite(v)) {
    const ms = v < 1e12 ? v * 1000 : v
    return new Date(ms).toISOString()
  }
  const ms = Number(v)
  if (Number.isFinite(ms) && ms > 0) {
    const asMs = ms < 1e12 ? ms * 1000 : ms
    return new Date(asMs).toISOString()
  }
  const parsed = Date.parse(String(v))
  if (Number.isFinite(parsed)) return new Date(parsed).toISOString()
  return new Date().toISOString()
}

function orderIdNumeric(id: string): number {
  const n = parseInt(String(id).replace(/\D/g, ""), 10)
  return Number.isFinite(n) ? n : 0
}

/** Newest orders first (date, then higher order id). */
function compareOrdersNewestFirst(a: Order, b: Order): number {
  const ta = Date.parse(a.createdAt)
  const tb = Date.parse(b.createdAt)
  const aMs = Number.isFinite(ta) ? ta : 0
  const bMs = Number.isFinite(tb) ? tb : 0
  if (bMs !== aMs) return bMs - aMs
  return orderIdNumeric(b.id) - orderIdNumeric(a.id)
}

function sortOrdersNewestFirst(list: Order[]): Order[] {
  return [...list].sort(compareOrdersNewestFirst)
}

function mergeOrderRow(
  byId: Map<string, Order>,
  cached: Order,
  buyerAcc: string,
) {
  if (!cached.id) return
  if (buyerAcc && cached.buyerAccount && cached.buyerAccount !== buyerAcc) return
  const key = orderIdKey(cached.id)
  const existing = byId.get(key)
  if (!existing) {
    byId.set(key, cached)
    return
  }
  const cachedMs = Date.parse(cached.createdAt)
  const existingMs = Date.parse(existing.createdAt)
  const preferCached =
    isGrandmaJustPlaced(cached.id) ||
    (Number.isFinite(cachedMs) && (!Number.isFinite(existingMs) || cachedMs >= existingMs))
  const merged = preferCached
    ? { ...existing, ...cached, createdAt: cached.createdAt }
    : {
        ...cached,
        ...existing,
        items:
          (existing.items?.length ?? 0) >= (cached.items?.length ?? 0)
            ? existing.items
            : cached.items,
        publicToken: existing.publicToken ?? cached.publicToken,
      }
  byId.set(key, merged)
}

/** Keep brand-new Grandma orders visible before the list API catches up. */
function mergeApiOrdersWithLocal(fromApi: Order[], buyerAcc: string): Order[] {
  const byId = new Map<string, Order>()
  for (const o of fromApi) {
    if (o.id) byId.set(orderIdKey(o.id), o)
  }
  const pending = loadGrandmaPendingOrder()
  const localSources = [
    ...useOrdersStore.getState().orders,
    ...(pending ? [pending] : []),
  ]
  for (const cached of localSources) {
    mergeOrderRow(byId, cached, buyerAcc)
  }
  return sortOrdersNewestFirst([...byId.values()])
}

/** Pin last placed + pending order — never drop from the visible list. */
function applyGrandmaListFixups(list: Order[], buyerAcc: string): Order[] {
  let next = mergeApiOrdersWithLocal(list, buyerAcc)
  try {
    const lastId = localStorage.getItem("grandma:lastOrderId")?.trim()
    const lastKey = lastId ? orderIdKey(lastId) : ""
    const hasLast = lastKey && next.some((o) => orderIdKey(o.id) === lastKey)
    if (lastId && lastKey && !hasLast) {
      const pending = loadGrandmaPendingOrder()
      if (pending && orderIdKey(pending.id) === lastKey) {
        next = [pending, ...next.filter((o) => orderIdKey(o.id) !== lastKey)]
      }
    }
  } catch {
    /* ignore */
  }
  next = sortOrdersNewestFirst(next)
  return elevateJustPlacedGrandmaOrder(next)
}

/** Enrich line items without removing orders when track API fails. */
async function enrichOrdersMissingItems(orders: Order[], userOwner?: string): Promise<Order[]> {
  const needsItems = orders.filter((o) => !(o.items?.length))
  if (needsItems.length === 0) return orders

  const enriched = await enrichOrdersFromTrack(needsItems)
  const byId = new Map<string, Order>()
  for (const o of orders) {
    if (o.id) byId.set(orderIdKey(o.id), o)
  }
  for (const row of enriched) {
    const key = orderIdKey(row.id)
    const prev = byId.get(key)
    byId.set(key, prev ? { ...prev, ...row, items: row.items?.length ? row.items : prev.items } : row)
  }
  return sortOrdersNewestFirst([...byId.values()])
}

async function fetchOrderFromTrackWithRetry(
  orderId: string,
  userOwner?: string,
  attempts = 3,
): Promise<Order | null> {
  for (let i = 0; i < attempts; i++) {
    const row = await fetchOrderFromTrack(orderId, userOwner)
    if (row) return row
    if (i < attempts - 1) {
      await new Promise((r) => setTimeout(r, 800 * (i + 1)))
    }
  }
  return null
}

function rawTxnToOrder(raw: RawTxn, userOwner?: string): Order {
  const payRaw = paymentStatusFromRaw(raw)
  return {
    id: raw.ID_ORDER?.toString() || crypto.randomUUID(),
    buyerName: raw.BUYER_NAME || "Unknown Buyer",
    buyerOwner: raw.BUYER_OWNER || userOwner || "N/A",
    buyerAccount: raw.BUYER_ISHYIGA_ACCOUNT || "",
    sellerAccount: raw.SELLER_ISHYIGA_ACCOUNT || "",
    sellerId: raw.SELLER_ISHYIGA_ACCOUNT || "",
    sellerName: raw.SELLER_NAMES || "Unknown Seller",
    seller: raw.SELLER_NAMES || "Unknown Seller",
    amount: raw.AMOUNT ?? 0,
    orderStatus: (raw.ORDER_STATUS ?? "").toString().trim() || "—",
    status: mapOrderStatus(raw.ORDER_STATUS),
    paymentStatus: mapPaymentStoreStatus(payRaw),
    paymentStatusRaw: payRaw,
    createdAt: toIso(raw.CREATED_AT),
    items: [],
    subtotal: raw.subtotal ?? raw.AMOUNT ?? 0,
    buyerTIN: raw.buyerTIN || raw.BUYER_TIN || "",
    SUPPLIER_TIN: raw.SUPPLIER_TIN || raw.SELLER_TIN || "",
    sellerCategoryHint:
      pickRawStr(raw, "DEPARTMENT", "PREFERRED_CATEGORIES", "SELLER_DEPARTMENT", "department", "seller_department") ||
      undefined,
  }
}

async function fetchOrderFromTrack(orderId: string, userOwner?: string): Promise<Order | null> {
  const id = String(orderId).trim()
  if (!id) return null
  try {
    const tr = await fetch("/api/orders/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: id }),
      cache: "no-store",
    })
    const data = await tr.json()
    if (!tr.ok || !data?.ok || !data.order) return null
    const ord = data.order as Record<string, unknown>
    const payRaw = String(ord.PAYMENT_STATUS ?? ord.paymentStatus ?? "").trim()
    const itemsRaw = Array.isArray(data.order.items) ? data.order.items : []
    const items: OrderItem[] = itemsRaw.map((item: Record<string, unknown>, idx: number) => ({
      id: String(item.ITEM_CODE ?? item.item_code ?? `${id}-${idx}`),
      name: String(item.ITEM_NAME ?? item.name ?? "Product"),
      price: Number(item.UNIT_PRICE ?? item.unitPrice ?? 0),
      qty: Number(item.QUANTITY ?? item.qty ?? item.QTY ?? 1),
      unit: (item.UNIT ?? item.unit) as string | undefined,
    }))
    const createdRaw = ord.CREATED_AT ?? ord.createdAt ?? ord.created_at
    return {
      id: String(ord.ID_ORDER ?? ord.id ?? id),
      buyerName: String(ord.BUYER_NAME ?? ord.buyerName ?? "Buyer"),
      buyerOwner: String(ord.BUYER_OWNER ?? userOwner ?? "N/A"),
      buyerAccount: String(ord.BUYER_ISHYIGA_ACCOUNT ?? ord.buyerAccount ?? ""),
      sellerAccount: String(ord.SELLER_ISHYIGA_ACCOUNT ?? ord.sellerAccount ?? ""),
      sellerId: String(ord.SELLER_ISHYIGA_ACCOUNT ?? ord.sellerAccount ?? ""),
      sellerName: String(ord.SELLER_NAMES ?? ord.sellerName ?? "Store"),
      seller: String(ord.SELLER_NAMES ?? ord.sellerName ?? "Store"),
      amount: Number(ord.AMOUNT ?? ord.amount ?? 0),
      orderStatus: String(ord.ORDER_STATUS ?? ord.orderStatus ?? "OPEN").trim() || "OPEN",
      status: mapOrderStatus(String(ord.ORDER_STATUS ?? ord.orderStatus ?? "")),
      paymentStatus: mapPaymentStoreStatus(payRaw),
      paymentStatusRaw: payRaw,
      createdAt: toIso(createdRaw as number | string | undefined),
      items,
      itemsCount: items.length,
      subtotal: Number(ord.subtotal ?? ord.AMOUNT ?? 0),
      publicToken:
        typeof data.publicToken === "string" && data.publicToken.trim() !== ""
          ? data.publicToken.trim()
          : undefined,
    }
  } catch {
    return null
  }
}

function mapOrderStatus(raw?: string): Order["status"] {
  return mapBackendOrderStatusToStore(raw)
}

function mapPaymentStoreStatus(raw?: string): Order["paymentStatus"] {
  const p = (raw || "").toLowerCase()
  if (p === "paid" || p.includes("umusada") || p.includes("financ")) return "paid"
  if (p === "failed") return "failed"
  if (p === "unpaid") return "unpaid"
  return "pending"
}

function buildTrackHref(orderId: string, publicToken?: string) {
  return `/track-order/${encodeURIComponent((publicToken || orderId).trim())}`
}

/** Not yet delivered / cancelled — show Track as primary when token or id is available. */
function orderCanTrack(o: Order): boolean {
  return o.status !== "delivered" && o.status !== "cancelled"
}

function friendlyStatusLabel(o: Order): string {
  const raw = (o.orderStatus ?? "").trim()
  if (raw && raw !== "—") return raw
  const s = o.status
  if (s === "in-transit") return "In transit"
  return s.charAt(0).toUpperCase() + s.slice(1)
}

type GrandmaWhenParts = {
  dateLine: string
  /** Big line — relative (“2 hours ago”) or calendar date. */
  timeLine: string
  /** Smaller line — exact clock (“Yesterday at 12:47 PM”). */
  timeDetail: string | null
  isToday: boolean
  isYesterday: boolean
  isRecent: boolean
  /** Order within ~48h — show highlighted “when” block. */
  isFresh: boolean
}

/** Clear “when” labels for Grandma; `nowMs` ticks for live relative text. */
function formatGrandmaWhen(createdAt: string, nowMs = Date.now()): GrandmaWhenParts {
  const d = new Date(createdAt)
  const now = new Date(nowMs)
  const isToday = d.toDateString() === now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday = d.toDateString() === yesterday.toDateString()
  const diffMs = nowMs - d.getTime()
  const isRecent = diffMs >= 0 && diffMs < 7 * 24 * 60 * 60 * 1000
  const isFresh = diffMs >= 0 && diffMs < 48 * 60 * 60 * 1000

  const clock = d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
  const calendarDate = isToday
    ? "Today"
    : isYesterday
      ? "Yesterday"
      : d.toLocaleDateString(undefined, {
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric",
        })

  let timeLine: string
  let timeDetail: string | null = null

  if (diffMs < 0) {
    timeLine = calendarDate
    timeDetail = `At ${clock}`
  } else if (diffMs < 60_000) {
    timeLine = "Just now"
    timeDetail = `Today at ${clock}`
  } else if (diffMs < 3_600_000) {
    const mins = Math.max(1, Math.floor(diffMs / 60_000))
    timeLine = mins === 1 ? "1 minute ago" : `${mins} minutes ago`
    timeDetail = isToday ? `Today at ${clock}` : `${calendarDate} at ${clock}`
  } else if (diffMs < 24 * 3_600_000) {
    const hrs = Math.max(1, Math.floor(diffMs / 3_600_000))
    timeLine = hrs === 1 ? "About 1 hour ago" : `${hrs} hours ago`
    timeDetail = isToday ? `Today at ${clock}` : `${calendarDate} at ${clock}`
  } else if (diffMs < 48 * 3_600_000) {
    timeLine = "About 1 day ago"
    timeDetail = isYesterday ? `Yesterday at ${clock}` : `${calendarDate} at ${clock}`
  } else if (isRecent) {
    const days = Math.max(1, Math.floor(diffMs / (24 * 3_600_000)))
    timeLine = days === 1 ? "1 day ago" : `${days} days ago`
    timeDetail = `${calendarDate} at ${clock}`
  } else {
    timeLine = calendarDate
    timeDetail = `At ${clock}`
  }

  return { dateLine: calendarDate, timeLine, timeDetail, isToday, isYesterday, isRecent, isFresh }
}

/** Map API / store status to a filter bucket (OPEN, DELIVERED, …). */
function statusFilterBucket(o: Order): string | null {
  const raw = (o.orderStatus ?? "").trim().toUpperCase()
  if (raw && raw !== "—") {
    if (raw.includes("OPEN")) return "OPEN"
    if (raw.includes("DELIVER")) return "DELIVERED"
    if (raw.includes("TRANSIT")) return "IN TRANSIT"
    if (raw.includes("CANCEL")) return "CANCELLED"
    return (o.orderStatus ?? "").trim()
  }
  if (o.status === "open") return "OPEN"
  if (o.status === "delivered") return "DELIVERED"
  if (o.status === "in-transit") return "IN TRANSIT"
  if (o.status === "cancelled") return "CANCELLED"
  return null
}

function orderMatchesStatusFilter(o: Order, filter: string): boolean {
  if (filter === "all") return true
  const bucket = statusFilterBucket(o)
  if (!bucket) return false
  return bucket.toUpperCase() === filter.trim().toUpperCase()
}

/** Client-side search across fields the API may not match. */
function orderMatchesSearch(o: Order, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const tokens = q.split(/\s+/).filter(Boolean)
  const haystack = [
    o.id,
    o.buyerName,
    o.buyerOwner,
    o.seller,
    o.sellerName,
    o.sellerAccount,
    o.orderStatus,
    ...(o.items ?? []).map((it) => it.name),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
  const idDigits = o.id.replace(/\D/g, "")
  const qDigits = q.replace(/\D/g, "")
  if (qDigits.length >= 3 && idDigits.includes(qDigits)) return true
  return tokens.every((tok) => haystack.includes(tok))
}

function grandmaStatusVisual(o: Order): { badgeBg: string; badgeText: string } {
  const raw = (o.orderStatus ?? "").trim().toUpperCase()
  const label = friendlyStatusLabel(o).toUpperCase()
  if (raw.includes("OPEN") || o.status === "open") {
    return { badgeBg: "bg-orange-500", badgeText: label.includes("OPEN") ? label : "OPEN" }
  }
  if (raw.includes("DELIVER") || o.status === "delivered") {
    return {
      badgeBg: "bg-emerald-600",
      badgeText: label.includes("DELIVER") ? label : "DELIVERED",
    }
  }
  if (raw.includes("TRANSIT") || o.status === "in-transit") {
    return { badgeBg: "bg-[#1897e0]", badgeText: label.includes("TRANSIT") ? label : "IN TRANSIT" }
  }
  if (raw.includes("CANCEL") || o.status === "cancelled") {
    return { badgeBg: "bg-slate-500", badgeText: label.includes("CANCEL") ? label : "CANCELLED" }
  }
  return { badgeBg: "bg-[#1897e0]", badgeText: label || "ORDER" }
}

type GrandmaOrderCardProps = {
  order: Order
  track: boolean
  canFinance: boolean
  onReorder: () => void
  onFinance: () => void
  trackHref: string
  nowMs: number
  isJustPlaced?: boolean
}

function GrandmaOrderCard({
  order: o,
  track,
  canFinance,
  onReorder,
  onFinance,
  trackHref,
  nowMs,
  isJustPlaced = false,
}: GrandmaOrderCardProps) {
  const n = o.items?.length ?? o.itemsCount ?? 0
  const amt = o.amount ?? o.subtotal ?? 0
  const initial = (sellerDisplayName(o).slice(0, 1) || "?").toUpperCase()
  const when = formatGrandmaWhen(o.createdAt, nowMs)
  const status = grandmaStatusVisual(o)
  const highlightRecent = when.isFresh || when.isToday || when.isYesterday

  return (
    <article
      className={cn(
        "overflow-hidden rounded-2xl border bg-white shadow-sm",
        isJustPlaced
          ? "border-orange-400 ring-2 ring-orange-300/50"
          : highlightRecent
            ? "border-[#1897e0]/45 ring-2 ring-[#1897e0]/15"
            : "border-slate-200",
      )}
    >
      <div className={cn("px-4 py-3 text-white", status.badgeBg)}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-base font-bold tracking-wide sm:text-lg">{status.badgeText}</span>
          <span className="shrink-0 rounded-lg bg-white/20 px-2.5 py-1 text-sm font-semibold">
            #{o.id}
          </span>
        </div>
      </div>

      <div
        className={cn(
          "border-b px-4 py-3",
          highlightRecent ? "border-[#1897e0]/20 bg-[#eef4fb]" : "border-slate-100 bg-slate-50",
        )}
      >
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
              highlightRecent ? "bg-[#1897e0]/15 text-[#127fc0]" : "bg-slate-200 text-slate-600",
            )}
            aria-hidden
          >
            <Clock className="h-5 w-5" strokeWidth={2.25} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              When ordered
            </p>
            <p className="text-xl font-bold leading-tight text-[#17324d]">{when.timeLine}</p>
            {when.timeDetail ? (
              <p className="mt-0.5 text-base font-medium text-slate-600">{when.timeDetail}</p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-200 text-base font-bold text-slate-700"
          aria-hidden
        >
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <Store className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Shop
          </div>
          <p className="truncate text-base font-bold text-[#17324d]">{sellerDisplayName(o)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5">
          <Package className="h-5 w-5 shrink-0 text-[#127fc0]" aria-hidden />
          <div>
            <p className="text-[11px] font-semibold uppercase text-slate-500">Items</p>
            <p className="text-lg font-bold text-[#17324d]">
              {n} <span className="text-sm font-semibold">{n === 1 ? "item" : "items"}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5">
          <span className="text-lg font-bold text-[#127fc0]" aria-hidden>
            RWF
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase text-slate-500">Total</p>
            <p className="truncate text-lg font-bold text-[#17324d]">{amt.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 px-4 py-3">
        {track ? (
          <Button
            asChild
            size="lg"
            className="h-11 w-full gap-2 bg-[#127fc0] text-base font-semibold hover:bg-[#0f6da3]"
          >
            <Link href={trackHref}>
              <Truck className="h-5 w-5" aria-hidden />
              Track order
            </Link>
          </Button>
        ) : null}
        <div className={cn("grid gap-2", track ? "grid-cols-2" : "grid-cols-1")}>
          <Button
            size="lg"
            className="h-11 gap-2 bg-orange-500 text-base font-semibold text-white hover:bg-orange-600"
            onClick={onReorder}
          >
            Reorder
          </Button>
          <Button
            size="lg"
            variant="secondary"
            className={cn(
              "h-11 text-base font-semibold",
              !canFinance && "cursor-not-allowed opacity-50",
            )}
            onClick={onFinance}
            disabled={!canFinance}
          >
            Financing
          </Button>
        </div>
      </div>
    </article>
  )
}

async function fetchGrandmaBuyerOrderPages(
  buyerAccount: string,
  searchQuery: string,
): Promise<{ rows: RawTxn[]; total: number | null }> {
  const merged: RawTxn[] = []
  const seen = new Set<string>()
  let total: number | null = null
  const chunk = GRANDMA_FETCH_PAGE_SIZE
  const maxPages = 5

  for (let p = 1; p <= maxPages; p++) {
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        buyerAccount,
        page: p,
        pageSize: chunk,
        ...(searchQuery ? { CLIENT: searchQuery } : {}),
      }),
      cache: "no-store",
    })
    const json = await res.json()
    if (json?.ok === false) {
      return { rows: merged, total }
    }
    const rawList: RawTxn[] = Array.isArray(json.transactions)
      ? json.transactions
      : Array.isArray(json.orders)
        ? json.orders
        : []
    total = json.count ?? total
    for (const raw of rawList) {
      const id = raw.ID_ORDER?.toString() ?? ""
      const key = orderIdKey(id)
      if (!key || seen.has(key)) continue
      seen.add(key)
      merged.push(raw)
    }
    if (rawList.length < chunk) break
    if (total != null && merged.length >= total) break
  }

  return { rows: merged, total }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  const workers = Math.min(Math.max(1, concurrency), Math.max(1, items.length))

  async function worker() {
    for (;;) {
      const idx = next++
      if (idx >= items.length) return
      results[idx] = await fn(items[idx], idx)
    }
  }

  await Promise.all(Array.from({ length: workers }, () => worker()))
  return results
}

function pickOrderStr(ord: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = ord[k]
    if (v != null && String(v).trim() !== "") return String(v).trim()
  }
  return ""
}

type TrackFetchRow = {
  id: string
  payRaw: string | null
  items: OrderItem[]
  publicToken?: string
  sellerCategoryHint?: string
}

/**
 * One POST /api/orders/track per order (pooled). Merges OPEN payment from track; fills items + publicToken.
 */
async function enrichOrdersFromTrack(orders: Order[]): Promise<Order[]> {
  if (orders.length === 0) return orders

  const rows = await mapWithConcurrency(orders, 5, async (o): Promise<TrackFetchRow> => {
    try {
      const tr = await fetch("/api/orders/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: o.id }),
        cache: "no-store",
      })
      const data = await tr.json()
      if (!tr.ok || !data?.ok || !data.order) {
        return { id: o.id, payRaw: null, items: [], publicToken: undefined }
      }
      const ps = data.order.PAYMENT_STATUS ?? data.order.paymentStatus
      const payRaw =
        ps != null && String(ps).trim() !== "" ? String(ps).trim() : null
      const itemsRaw = Array.isArray(data.order.items) ? data.order.items : []
      const pickItemImage = (item: Record<string, unknown>): string | undefined => {
        const keys = [
          "IMAGE_URL",
          "image_url",
          "ITEM_IMAGE",
          "item_image",
          "item_image_url",
          "image",
          "itemImage",
          "PHOTO_URL",
          "photo",
        ]
        for (const k of keys) {
          const v = item[k]
          if (v != null && String(v).trim() !== "") return String(v).trim()
        }
        return undefined
      }
      const items: OrderItem[] = itemsRaw.map((item: Record<string, unknown>, idx: number) => ({
        id: String(item.ITEM_CODE ?? item.item_code ?? `${o.id}-${idx}`),
        name: String(item.ITEM_NAME ?? item.name ?? "Product"),
        price: Number(item.UNIT_PRICE ?? item.unitPrice ?? 0),
        qty: Number(item.QUANTITY ?? item.qty ?? item.QTY ?? 1),
        unit: (item.UNIT ?? item.unit) as string | undefined,
        image: pickItemImage(item),
      }))
      const publicToken =
        typeof data.publicToken === "string" && data.publicToken.trim() !== ""
          ? data.publicToken.trim()
          : undefined
      const ord = data.order as Record<string, unknown>
      const sellerCategoryHint =
        pickOrderStr(ord, "DEPARTMENT", "PREFERRED_CATEGORIES", "SELLER_DEPARTMENT", "department", "seller_department") ||
        undefined
      return { id: o.id, payRaw, items, publicToken, sellerCategoryHint }
    } catch {
      return { id: o.id, payRaw: null, items: [], publicToken: undefined }
    }
  })

  const payById = new Map<string, string>()
  const itemsById = new Map<string, OrderItem[]>()
  const tokenById = new Map<string, string>()
  const hintById = new Map<string, string>()
  for (const r of rows) {
    if (r.payRaw) payById.set(r.id, r.payRaw)
    itemsById.set(r.id, r.items)
    if (r.publicToken) tokenById.set(r.id, r.publicToken)
    if (r.sellerCategoryHint) hintById.set(r.id, r.sellerCategoryHint)
  }

  return orders.map((o) => {
    const payRaw = payById.get(o.id)
    const items = itemsById.get(o.id) ?? o.items ?? []
    const publicToken = tokenById.get(o.id)
    const trackHint = hintById.get(o.id)
    const updateOpen =
      (o.orderStatus ?? "").trim().toUpperCase() === "OPEN" &&
      !isInvoiceFinanced(o.paymentStatusRaw) &&
      payRaw

    let next: Order = {
      ...o,
      items,
      itemsCount: items.length,
      ...(publicToken ? { publicToken } : {}),
      ...(trackHint || o.sellerCategoryHint
        ? { sellerCategoryHint: trackHint ?? o.sellerCategoryHint }
        : {}),
    }

    if (updateOpen && payRaw) {
      next = {
        ...next,
        paymentStatusRaw: payRaw,
        paymentStatus: mapPaymentStoreStatus(payRaw),
      }
    }

    return next
  })
}

async function requestLoan(order: Order, upsertOrder: (o: Order) => void) {
  const financed = isInvoiceFinanced(order.paymentStatusRaw)
  if (!canRequestInvoiceFinancing(order.orderStatus, financed)) {
    alert(`Financing not allowed for orders with status "${order.orderStatus}"`)
    return
  }

  const buyerAccount = (order as { buyerAccount?: string }).buyerAccount || ""
  const sellerAccount = (order as { sellerAccount?: string }).sellerAccount || ""
  const buyerTIN = order.buyerTIN || ""
  const supplierTIN = order.SUPPLIER_TIN || ""

  if (!buyerAccount) {
    alert("Buyer account not available. Cannot proceed with financing.")
    return
  }

  if (!sellerAccount) {
    alert("Seller account not available. Cannot proceed with financing.")
    return
  }

  if (!confirm("You are about to request a loan for this order. Continue?")) return

  try {
    const res = await fetch("/api/request-loan-with-details", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: order.id,
        buyerAccount,
        sellerAccount,
        buyerTIN,
        supplierTIN,
        invoiceAmount: (order as { subtotal?: number }).subtotal || order.amount,
      }),
    })

    const result = await res.json()
    if (res.ok && result.success) {
      upsertOrder({
        ...order,
        paymentStatusRaw: "UMUSADA",
        paymentStatus: "paid",
        paymentName: order.paymentName || "UMUSADA",
      })
      alert(
        `✅ Loan request submitted\n\n` +
          `Order #: ${order.id}\n` +
          `Amount: ${((order as { subtotal?: number }).subtotal || order.amount || 0).toLocaleString()} RWF`,
      )
    } else {
      alert(`❌ Loan Request Failed\n\n${result.error || "Unknown error"}`)
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    alert(`❌ Error\n\n${msg}`)
  }
}

function sellerKey(o: Order): string {
  return (o.sellerAccount || o.sellerName || o.seller || "unknown").trim() || "unknown"
}

function sellerDisplayName(o: Order): string {
  return (o.sellerName || o.seller || "Store").trim() || "Store"
}

export type BuyerOrdersPanelProps = {
  /** Where to send users who are not signed in (include `?redirect=` when needed). */
  loginRedirect?: string
  /** `buyer` = full-width buyer panel chrome; `grandma` = narrow shell under Grandma header */
  variant?: "buyer" | "grandma"
  /** From `/grandma/orders?orderId=` after checkout — pin that order first. */
  highlightOrderId?: string | null
}

export function BuyerOrdersPanel({
  loginRedirect = "/login",
  variant = "buyer",
  highlightOrderId = null,
}: BuyerOrdersPanelProps) {
  const router = useRouter()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const user = useAuthStore((s) => s.user)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(variant === "grandma" ? 50 : 10)
  const [total, setTotal] = useState<number | null>(null)
  const [search, setSearch] = useState("")
  const [searchDebounced, setSearchDebounced] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [refreshTick, setRefreshTick] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [ordersTab, setOrdersTab] = useState("past-orders")
  const orders = useOrdersStore((s) => s.orders)
  const setOrders = useOrdersStore((s) => s.setOrders)
  const upsertOrder = useOrdersStore((s) => s.upsertOrder)

  useEffect(() => {
    const id = window.setTimeout(() => setSearchDebounced(search.trim()), 350)
    return () => window.clearTimeout(id)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [searchDebounced, statusFilter])

  useEffect(() => {
    const bump = () => setRefreshTick((t) => t + 1)
    window.addEventListener("focus", bump)
    const onVis = () => {
      if (document.visibilityState === "visible") bump()
    }
    document.addEventListener("visibilitychange", onVis)
    return () => {
      window.removeEventListener("focus", bump)
      document.removeEventListener("visibilitychange", onVis)
    }
  }, [])

  useEffect(() => {
    if (variant !== "grandma") return
    const tick = () => setNowMs(Date.now())
    tick()
    const id = window.setInterval(tick, GRANDMA_NOW_TICK_MS)
    return () => window.clearInterval(id)
  }, [variant])

  useEffect(() => {
    if (!isAuthenticated) router.push(loginRedirect)
  }, [isAuthenticated, router, loginRedirect])

  useEffect(() => {
    if (variant !== "grandma") return
    const pending = loadGrandmaPendingOrder()
    const focusId = highlightOrderId?.trim() || pending?.id
    if (pending) upsertOrder(pending)
    if (focusId) {
      setSearch("")
      setStatusFilter("all")
      setPage(1)
      setOrdersTab("past-orders")
      setNowMs(Date.now())
      void (async () => {
        const tracked = await fetchOrderFromTrackWithRetry(focusId, user?.owner, 3)
        if (tracked) {
          const merged = pending
            ? { ...tracked, ...pending, createdAt: pending.createdAt }
            : tracked
          saveGrandmaPendingOrder(merged)
          upsertOrder(merged)
        }
      })()
    }
  }, [variant, upsertOrder, highlightOrderId, user?.owner])

  /** Don’t hide a brand-new order behind a status filter (e.g. only “OPEN”). */
  useEffect(() => {
    if (variant !== "grandma" || statusFilter === "all") return
    const justId = getGrandmaJustPlacedOrderId()
    if (!justId) return
    const placed = orders.find((o) => orderIdKey(o.id) === orderIdKey(justId))
    if (!placed) return
    if (!orderMatchesStatusFilter(placed, statusFilter)) {
      setStatusFilter("all")
    }
  }, [variant, statusFilter, orders])

  useEffect(() => {
    async function loadOrders() {
      if (!user?.ishyigaAccount) return

      const silent =
        variant === "grandma" && (refreshTick > 0 || useOrdersStore.getState().orders.length > 0)
      if (!silent) setLoading(true)
      else setRefreshing(true)
      setErr(null)

      try {
        const buyerAcc = user.ishyigaAccount?.trim() || ""
        let rawList: RawTxn[] = []
        let apiTotal: number | null = null

        if (variant === "grandma") {
          const bulk = await fetchGrandmaBuyerOrderPages(buyerAcc, searchDebounced)
          rawList = bulk.rows
          apiTotal = bulk.total
        } else {
          const effectivePageSize = pageSize
          const res = await fetch("/api/orders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              buyerAccount: user.ishyigaAccount,
              page: searchDebounced ? 1 : page,
              pageSize: effectivePageSize,
              ...(searchDebounced ? { CLIENT: searchDebounced } : {}),
            }),
            cache: "no-store",
          })
          const json = await res.json()
          if (json?.ok === false) {
            setErr(json.message || "Failed to load orders")
            if (!silent) setOrders([])
            return
          }
          rawList = Array.isArray(json.transactions)
            ? json.transactions
            : Array.isArray(json.orders)
              ? json.orders
              : []
          apiTotal = json.count ?? null
        }

        const finalOrders: Order[] = rawList.map((raw) => rawTxnToOrder(raw, user?.owner))

        let displayList = sortOrdersNewestFirst(finalOrders)
        if (variant === "grandma") {
          try {
            const lastId = localStorage.getItem("grandma:lastOrderId")?.trim()
            const lastKey = lastId ? orderIdKey(lastId) : ""
            const hasLast =
              lastKey && displayList.some((o) => orderIdKey(o.id) === lastKey)
            if (lastId && lastKey && !hasLast) {
              const pinned = await fetchOrderFromTrackWithRetry(lastId, user?.owner, 3)
              if (pinned) {
                displayList = [pinned, ...displayList]
              }
            }
          } catch {
            /* ignore */
          }
          displayList = applyGrandmaListFixups(displayList, buyerAcc)
        } else {
          displayList = mergeApiOrdersWithLocal(displayList, buyerAcc)
        }

        setOrders(displayList)
        setTotal(apiTotal ?? displayList.length ?? null)
        setLoading(false)
        setRefreshing(false)

        const snapshotForEnrich = displayList
        void enrichOrdersMissingItems(snapshotForEnrich)
          .then((withItems) => {
            let next = withItems
            if (variant === "grandma") {
              next = applyGrandmaListFixups(withItems, buyerAcc)
              const lastId = localStorage.getItem("grandma:lastOrderId")?.trim()
              if (lastId && next.some((o) => orderIdKey(o.id) === orderIdKey(lastId))) {
                const row = next.find((o) => orderIdKey(o.id) === orderIdKey(lastId))
                clearGrandmaPendingOrderIfMatched(lastId, row?.createdAt)
              }
            } else {
              next = mergeApiOrdersWithLocal(withItems, buyerAcc)
            }
            setOrders(next)
          })
          .catch(() => {
            /* keep list on screen if enrich fails */
          })
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Error loading orders"
        setErr(msg)
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    }

    loadOrders()
  }, [
    user?.ishyigaAccount,
    pageSize,
    setOrders,
    user?.owner,
    refreshTick,
    variant,
    searchDebounced,
    variant === "buyer" ? page : 0,
  ])

  useEffect(() => {
    if (variant !== "grandma" || !user?.ishyigaAccount) return

    const bumpRefresh = () => setRefreshTick((t) => t + 1)

    const onOrderPlaced = (ev: Event) => {
      const orderId = (ev as CustomEvent<GrandmaOrderPlacedDetail>).detail?.orderId?.trim()
      if (!orderId) return
      setPage(1)
      setNowMs(Date.now())
      setSearch("")
      setStatusFilter("all")
      void (async () => {
        const pending = loadGrandmaPendingOrder()
        if (pending && orderIdKey(pending.id) === orderIdKey(orderId)) {
          upsertOrder(pending)
        }
        const pinned = await fetchOrderFromTrackWithRetry(orderId, user?.owner, 2)
        if (pinned) upsertOrder(pinned)
        bumpRefresh()
      })()
    }

    const onStorage = (e: StorageEvent) => {
      if (e.key === "grandma:lastOrderId" && e.newValue?.trim()) {
        setPage(1)
        setNowMs(Date.now())
        bumpRefresh()
      }
    }

    window.addEventListener(GRANDMA_ORDER_PLACED_EVENT, onOrderPlaced)
    window.addEventListener("storage", onStorage)

    const pollId = window.setInterval(() => {
      if (document.visibilityState === "visible") bumpRefresh()
    }, GRANDMA_ORDERS_POLL_MS)

    return () => {
      window.removeEventListener(GRANDMA_ORDER_PLACED_EVENT, onOrderPlaced)
      window.removeEventListener("storage", onStorage)
      window.clearInterval(pollId)
    }
  }, [variant, user?.ishyigaAccount, user?.owner, upsertOrder])

  const distinctStatuses = useMemo(() => {
    const set = new Set<string>(
      variant === "grandma" ? [...GRANDMA_STATUS_FILTER_OPTIONS] : [],
    )
    for (const o of orders) {
      const bucket = statusFilterBucket(o)
      if (bucket) set.add(bucket)
      else {
        const st = (o.orderStatus ?? "").trim()
        if (st && st !== "—") set.add(st)
      }
    }
    return Array.from(set).sort((a, b) => {
      const rank = (s: string) => {
        const i = GRANDMA_STATUS_FILTER_OPTIONS.indexOf(
          s.toUpperCase() as (typeof GRANDMA_STATUS_FILTER_OPTIONS)[number],
        )
        return i === -1 ? 99 : i
      }
      const ra = rank(a)
      const rb = rank(b)
      if (ra !== rb) return ra - rb
      return a.localeCompare(b, undefined, { sensitivity: "base" })
    })
  }, [orders, variant])

  const filteredOrders = useMemo(() => {
    let list = orders
    if (statusFilter !== "all") {
      list = list.filter((o) => orderMatchesStatusFilter(o, statusFilter))
    }
    if (search.trim()) {
      list = list.filter((o) => orderMatchesSearch(o, search))
    }
    list = sortOrdersNewestFirst(list)
    if (variant === "grandma") {
      list = elevateJustPlacedGrandmaOrder(list)
    }
    return list
  }, [orders, search, statusFilter, variant])

  const totalPages = useMemo(() => {
    if (variant === "grandma") {
      return Math.max(1, Math.ceil(filteredOrders.length / pageSize))
    }
    if (!total || total <= 0) return 1
    return Math.ceil(total / pageSize)
  }, [total, pageSize, variant, filteredOrders.length])

  /** Grandma: show every loaded order (scroll); buyer uses server page via filtered list. */
  const ordersForDisplay = filteredOrders

  const pageButtons = useMemo(() => {
    const buttons: number[] = []
    let start = page - 2
    let end = page + 2
    if (start < 1) {
      end += 1 - start
      start = 1
    }
    if (end > totalPages) end = totalPages
    for (let n = start; n <= end; n++) buttons.push(n)
    return buttons
  }, [page, totalPages])

  const itemsBySeller = useMemo(() => {
    const map = new Map<
      string,
      { label: string; lines: Array<{ order: Order; item: OrderItem; lineIndex: number }> }
    >()
    for (const o of filteredOrders) {
      const key = sellerKey(o)
      const label = sellerDisplayName(o)
      if (!map.has(key)) map.set(key, { label, lines: [] })
      const entry = map.get(key)!
      if (entry.label === "Store" && label !== "Store") entry.label = label
      const items = o.items ?? []
      items.forEach((item, lineIndex) => {
        entry.lines.push({ order: o, item, lineIndex })
      })
    }
    for (const v of map.values()) {
      v.lines.sort(
        (a, b) =>
          new Date(b.order.createdAt).getTime() - new Date(a.order.createdAt).getTime(),
      )
    }
    return Array.from(map.entries()).sort((a, b) =>
      a[1].label.localeCompare(b[1].label, undefined, { sensitivity: "base" }),
    )
  }, [filteredOrders])

  if (!isAuthenticated) return null

  const orderDetailsHref = (orderId: string) =>
    variant === "grandma" ? `${GRANDMA_PATHS.buyerOrders}/${orderId}` : `/orders/${orderId}`

  const queueGrandmaReorderFromLines = (o: Order, lines: OrderItem[]) => {
    const shopId = buildGrandmaShopId(o.sellerAccount || o.sellerId || "")
    if (!shopId) {
      alert("Cannot reorder: missing seller.")
      return
    }
    if (lines.length === 0) {
      alert("No items to add.")
      return
    }
    const fromOrder = inferGrandmaCategoryFromHint(o.sellerCategoryHint)
    const payload: GrandmaReorderPayload = {
      v: 1,
      shopId,
      lines: lines.map((it) => ({
        itemCode: String(it.id ?? ""),
        name: it.name,
        qty: Math.max(1, Number(it.qty) || 1),
        unitPrice: Number(it.price) || 0,
      })),
      ...(fromOrder ? { grandmaCategory: fromOrder } : {}),
    }
    try {
      sessionStorage.setItem(GRANDMA_REORDER_STORAGE_KEY, JSON.stringify(payload))
    } catch {
      alert("Could not save reorder. Try again.")
      return
    }
    router.push(GRANDMA_PATHS.appRoot)
  }

  const reorderHome = () => {
    router.push(variant === "grandma" ? GRANDMA_PATHS.appRoot : "/")
  }

  const getStatusColor = (status?: string) => {
    const s = status?.toLowerCase() || ""
    if (s.includes("open")) return "bg-orange-500"
    if (s.includes("closed") || s.includes("delivered")) return "bg-emerald-600"
    if (s.includes("transit")) return "bg-[#1897e0]"
    if (s.includes("cancel")) return "bg-slate-500"
    return "bg-slate-500"
  }

  const rowCanFinance = (o: Order) => {
    const financed = isInvoiceFinanced(o.paymentStatusRaw)
    return canRequestInvoiceFinancing(o.orderStatus, financed)
  }

  return (
    <main
      className={cn(
        "flex-1 w-full min-w-0",
        variant === "grandma"
          ? "max-w-[430px] mx-auto px-3 pb-8 pt-2"
          : "max-w-7xl mx-auto p-4 sm:p-6",
      )}
    >
        {variant !== "grandma" ? (
          <div className="mb-4">
            <h1 className="text-2xl font-bold text-slate-800">Orders</h1>
            <p className="text-sm text-slate-600 mt-1">
              Past orders and line items (the same product may appear more than once when it was ordered in
              different events).
            </p>
          </div>
        ) : (
          <p className="mb-3 rounded-xl border border-[#1897e0]/20 bg-white px-3 py-2.5 text-sm leading-snug text-[#17324d]">
            Each card shows <strong>status</strong>, <strong>when</strong>, <strong>shop</strong>, and{" "}
            <strong>total</strong>. New orders appear at the top.
          </p>
        )}

        <div
          className={cn(
            "mb-4 flex flex-col gap-2",
            variant === "grandma" ? "" : "sm:flex-row sm:flex-wrap sm:items-center",
          )}
        >
          <div className="w-full">
            <input
              type="search"
              placeholder={
                variant === "grandma"
                  ? "Search shop name or order number…"
                  : "Search by buyer, seller, or order ID…"
              }
              aria-label={
                variant === "grandma"
                  ? "Search shop name or order number"
                  : "Search orders"
              }
              className={cn(
                "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#1897e0]",
                variant === "grandma" ? "text-base" : "sm:max-w-xs focus:ring-blue-500",
              )}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search.trim() && variant === "grandma" ? (
              <p className="mt-1 text-xs text-slate-600" aria-live="polite">
                {filteredOrders.length === 0
                  ? "No order matches — try shop name or #3631"
                  : `${filteredOrders.length} order${filteredOrders.length === 1 ? "" : "s"} found`}
              </p>
            ) : null}
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[200px] border-slate-300 bg-white">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {distinctStatuses.map((st) => (
                <SelectItem key={st} value={st}>
                  {st}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {variant !== "grandma" ? (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <span className="whitespace-nowrap">Rows per page</span>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => {
                  setPageSize(Number(v))
                  setPage(1)
                }}
              >
                <SelectTrigger className="w-[88px] border-slate-300 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[10, 20, 50].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>

        {loading && filteredOrders.length === 0 && (
          <p className="text-slate-600">Loading orders…</p>
        )}
        {refreshing && variant === "grandma" && filteredOrders.length > 0 && (
          <p className="mb-2 text-center text-xs font-semibold text-[#127fc0]" aria-live="polite">
            Updating…
          </p>
        )}
        {err && <p className="text-red-600">{err}</p>}

        {variant === "grandma" && getGrandmaJustPlacedOrderId() ? (
          <div
            className="mb-3 rounded-xl border border-orange-300/60 bg-orange-50 px-3 py-2.5 text-sm font-semibold text-[#17324d]"
            aria-live="polite"
          >
            Order placed successfully — #{getGrandmaJustPlacedOrderId()} is first on this list (today).
          </div>
        ) : null}

        {variant === "grandma" && filteredOrders.length > 0 ? (
          <p className="mb-2 text-center text-sm font-medium text-slate-600">
            {filteredOrders.length} order{filteredOrders.length === 1 ? "" : "s"} — scroll to see all
            {statusFilter !== "all" ? ` · filter: ${statusFilter}` : ""}
          </p>
        ) : null}

        {filteredOrders.length > 0 && (
          <Tabs value={ordersTab} onValueChange={setOrdersTab} className="w-full gap-4">
            <TabsList
              className={cn(
                "grid w-full grid-cols-2 rounded-xl p-1",
                variant === "grandma"
                  ? "bg-slate-200/80"
                  : "sm:inline-flex sm:w-auto",
              )}
            >
              <TabsTrigger
                value="past-orders"
                className={cn(
                  variant === "grandma" &&
                    "rounded-lg py-2.5 text-sm font-semibold data-[state=active]:bg-white data-[state=active]:text-[#127fc0] data-[state=active]:shadow-sm",
                )}
              >
                Past orders
              </TabsTrigger>
              <TabsTrigger
                value="past-items"
                className={cn(
                  variant === "grandma" &&
                    "rounded-lg py-2.5 text-sm font-semibold data-[state=active]:bg-white data-[state=active]:text-[#127fc0] data-[state=active]:shadow-sm",
                )}
              >
                Past items
              </TabsTrigger>
            </TabsList>

            <TabsContent value="past-orders" className="mt-4 space-y-3 data-[state=inactive]:hidden">
              {variant === "grandma" ? (
                <div className="space-y-4">
                  {ordersForDisplay.length === 0 ? (
                    <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                      No orders match this filter. Set status to <strong>All statuses</strong> or clear
                      search.
                    </p>
                  ) : null}
                  {ordersForDisplay.map((o) => (
                    <GrandmaOrderCard
                      key={o.id}
                      order={o}
                      track={orderCanTrack(o)}
                      canFinance={rowCanFinance(o)}
                      trackHref={buildTrackHref(o.id, o.publicToken)}
                      onReorder={() => queueGrandmaReorderFromLines(o, o.items ?? [])}
                      onFinance={() => requestLoan(o, upsertOrder)}
                      nowMs={nowMs}
                      isJustPlaced={isGrandmaJustPlaced(o.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 shadow-sm">
                  {ordersForDisplay.map((o) => {
                    const n = o.items?.length ?? o.itemsCount ?? 0
                    const amt = o.amount ?? o.subtotal ?? 0
                    const initial = (sellerDisplayName(o).slice(0, 1) || "?").toUpperCase()
                    const track = orderCanTrack(o)
                    return (
                      <div
                        key={o.id}
                        className="flex flex-col gap-3 p-4 hover:bg-slate-50/80 sm:flex-row sm:items-center"
                      >
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                          <div
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-700"
                            aria-hidden
                          >
                            {initial}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-slate-900">
                              {sellerDisplayName(o)}
                            </div>
                            <div className="text-sm text-slate-600">
                              {n} {n === 1 ? "item" : "items"} · {amt.toLocaleString()} RWF
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                              <span>{new Date(o.createdAt).toLocaleString()}</span>
                              <span className="text-slate-300">·</span>
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-white",
                                  getStatusColor(o.orderStatus),
                                )}
                              >
                                {friendlyStatusLabel(o)}
                              </span>
                              <span className="text-slate-400">Order #{o.id}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                          {track ? (
                            <Button asChild size="sm" className="gap-1">
                              <Link href={buildTrackHref(o.id, o.publicToken)}>
                                <Truck className="h-4 w-4" />
                                Track order
                              </Link>
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            variant={track ? "outline" : "default"}
                            onClick={() => router.push(orderDetailsHref(o.id))}
                          >
                            View order
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            className={
                              !rowCanFinance(o) ? "cursor-not-allowed opacity-50" : ""
                            }
                            onClick={() => requestLoan(o, upsertOrder)}
                            disabled={!rowCanFinance(o)}
                          >
                            Financing
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="past-items" className="mt-4 space-y-8 data-[state=inactive]:hidden">
              {variant === "grandma" && ordersTab === "past-items" ? (
                <p className="rounded-xl border border-[#1897e0]/20 bg-[#eef4fb] px-3 py-2 text-sm text-[#17324d]">
                  Product photos appear here. For full order cards (status, time, total), open the{" "}
                  <button
                    type="button"
                    className="font-semibold text-[#127fc0] underline"
                    onClick={() => setOrdersTab("past-orders")}
                  >
                    Past orders
                  </button>{" "}
                  tab.
                </p>
              ) : null}
              {itemsBySeller.map(([key, group]) => (
                <section key={key} className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <Package className="h-4 w-4 text-slate-500" />
                    <h2
                      className={cn(
                        "font-semibold text-slate-800",
                        variant === "grandma" ? "text-base" : "text-lg",
                      )}
                    >
                      {group.label}
                    </h2>
                  </div>
                  <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory">
                    {group.lines.map(({ order, item, lineIndex }) => {
                      const lineKey = `${order.id}-${lineIndex}-${item.id}`
                      const lineTotal = (item.price || 0) * (item.qty || 0)
                      const imgSrc = (item.image && item.image.trim() !== "" ? item.image : NO_IMAGE_URL) as string
                      const when =
                        variant === "grandma" ? formatGrandmaWhen(order.createdAt, nowMs) : null
                      return (
                        <div
                          key={lineKey}
                          className={cn(
                            "snap-start shrink-0 flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm",
                            variant === "grandma" ? "w-[172px]" : "w-[160px] sm:w-[176px]",
                          )}
                        >
                          <div className="relative aspect-square w-full bg-slate-100">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={imgSrc}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                variant === "grandma"
                                  ? queueGrandmaReorderFromLines(order, [item])
                                  : reorderHome()
                              }
                              className="absolute bottom-2 right-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-900 shadow-md ring-1 ring-slate-200/80 hover:bg-slate-50"
                              aria-label="Add to cart"
                              title={variant === "grandma" ? "Add to Grandma cart" : "Shop again"}
                            >
                              <Plus className="h-5 w-5" strokeWidth={2.5} />
                            </button>
                          </div>
                          <div className="flex min-h-0 flex-col gap-1 p-3">
                            {when ? (
                              <div className="mb-1 text-[11px] font-semibold leading-snug text-[#127fc0]">
                                <span className="line-clamp-2">{when.timeLine}</span>
                                {when.timeDetail ? (
                                  <span className="block font-medium text-slate-500">{when.timeDetail}</span>
                                ) : null}
                              </div>
                            ) : null}
                            <div className="text-sm font-semibold text-slate-900 line-clamp-2 leading-snug">
                              {item.name}
                            </div>
                            <div className="text-sm font-bold text-[#17324d]">
                              {lineTotal.toLocaleString()} RWF
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>
              ))}
              {itemsBySeller.length === 0 && (
                <p className="text-slate-500 text-sm">
                  No product lines yet — open{" "}
                  <button
                    type="button"
                    className="font-medium text-[#127fc0] underline"
                    onClick={() => setOrdersTab("past-orders")}
                  >
                    Past orders
                  </button>{" "}
                  to see your orders as cards.
                </p>
              )}
            </TabsContent>
          </Tabs>
        )}

        {!loading && !refreshing && filteredOrders.length === 0 && !err && (
          <p className="text-slate-500">
            {search.trim()
              ? "No order matches your search. Try the shop name or order number (example: 3631)."
              : "No orders found."}
          </p>
        )}

        {variant !== "grandma" ? (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <Button
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </Button>

            {pageButtons.map((n) => (
              <Button
                key={n}
                variant={n === page ? "default" : "outline"}
                onClick={() => setPage(n)}
              >
                {n}
              </Button>
            ))}

            <Button
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        ) : null}
    </main>
  )
}
