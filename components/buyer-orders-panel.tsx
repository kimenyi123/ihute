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
import { Package, Plus, Truck } from "lucide-react"
import { GRANDMA_PATHS } from "@/lib/grandma-urls"
import {
  GRANDMA_REORDER_STORAGE_KEY,
  buildGrandmaShopId,
  inferGrandmaCategoryFromHint,
  type GrandmaReorderPayload,
} from "@/lib/grandma-reorder"
import { NO_IMAGE_URL } from "@/lib/image-utils"

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
  if (!v) return new Date().toISOString()
  if (typeof v === "number") return new Date(v).toISOString()
  const ms = Number(v)
  if (!isNaN(ms)) return new Date(ms).toISOString()
  return new Date().toISOString()
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
}

export function BuyerOrdersPanel({
  loginRedirect = "/login",
  variant = "buyer",
}: BuyerOrdersPanelProps) {
  const router = useRouter()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const user = useAuthStore((s) => s.user)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState<number | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const orders = useOrdersStore((s) => s.orders)
  const setOrders = useOrdersStore((s) => s.setOrders)
  const upsertOrder = useOrdersStore((s) => s.upsertOrder)

  useEffect(() => {
    if (!isAuthenticated) router.push(loginRedirect)
  }, [isAuthenticated, router, loginRedirect])

  useEffect(() => {
    async function load() {
      if (!user?.ishyigaAccount) return

      setLoading(true)
      setErr(null)

      try {
        const res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            buyerAccount: user.ishyigaAccount,
            page,
            pageSize,
          }),
          cache: "no-store",
        })

        const json = await res.json()

        if (json?.ok === false) {
          setErr(json.message || "Failed to load orders")
          setOrders([])
        } else {
          const rawList: RawTxn[] = Array.isArray(json.transactions)
            ? json.transactions
            : Array.isArray(json.orders)
              ? json.orders
              : []

          const finalOrders: Order[] = rawList.map((raw) => {
            const payRaw = paymentStatusFromRaw(raw)
            return {
              id: raw.ID_ORDER?.toString() || crypto.randomUUID(),
              buyerName: raw.BUYER_NAME || "Unknown Buyer",
              buyerOwner: raw.BUYER_OWNER || user?.owner || "N/A",
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
          })

          const enriched = await enrichOrdersFromTrack(finalOrders)
          setOrders(enriched)
          setTotal(json.count ?? null)
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Error loading orders"
        setErr(msg)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [user?.ishyigaAccount, page, pageSize, setOrders, user?.owner])

  const distinctStatuses = useMemo(() => {
    const set = new Set<string>()
    for (const o of orders) {
      const st = (o.orderStatus ?? "").trim()
      if (st && st !== "—") set.add(st)
    }
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    )
  }, [orders])

  const filteredOrders = useMemo(() => {
    let list = orders
    if (statusFilter !== "all") {
      list = list.filter(
        (o) =>
          (o.orderStatus ?? "").trim().toUpperCase() === statusFilter.toUpperCase(),
      )
    }
    if (!search.trim()) return list
    const s = search.toLowerCase()
    return list.filter(
      (o) =>
        (o.buyerName ?? "").toLowerCase().includes(s) ||
        (o.seller ?? "").toLowerCase().includes(s) ||
        o.id.includes(s),
    )
  }, [orders, search, statusFilter])

  const totalPages = useMemo(() => {
    if (!total || total <= 0) return 1
    return Math.ceil(total / pageSize)
  }, [total, pageSize])

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
    if (s.includes("open")) return "bg-amber-500"
    if (s.includes("closed") || s.includes("delivered")) return "bg-emerald-600"
    if (s.includes("transit")) return "bg-sky-600"
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
          <p className="mb-3 text-xs text-slate-600">
            Past orders and line items — same product may repeat across different orders.
          </p>
        )}

        <div className="mb-4 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
          <input
            type="text"
            placeholder="Search by buyer, seller, or order ID…"
            className="border border-slate-300 px-3 py-2 rounded-lg w-full sm:max-w-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
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
        </div>

        {loading && <p className="text-slate-600">Loading orders…</p>}
        {err && <p className="text-red-600">{err}</p>}

        {!loading && filteredOrders.length > 0 && (
          <Tabs defaultValue="past-orders" className="w-full gap-4">
            <TabsList className="w-full sm:w-auto grid grid-cols-2 sm:inline-flex">
              <TabsTrigger value="past-orders">Past orders</TabsTrigger>
              <TabsTrigger value="past-items">Past items</TabsTrigger>
            </TabsList>

            <TabsContent value="past-orders" className="mt-4 space-y-3">
              <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 shadow-sm">
                {filteredOrders.map((o) => {
                  const n = o.items?.length ?? o.itemsCount ?? 0
                  const amt = o.amount ?? o.subtotal ?? 0
                  const initial = (sellerDisplayName(o).slice(0, 1) || "?").toUpperCase()
                  const track = orderCanTrack(o)
                  return (
                    <div
                      key={o.id}
                      className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 hover:bg-slate-50/80"
                    >
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div
                          className="h-11 w-11 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-sm font-semibold shrink-0"
                          aria-hidden
                        >
                          {initial}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 truncate">
                            {sellerDisplayName(o)}
                          </div>
                          <div className="text-sm text-slate-600">
                            {n} {n === 1 ? "item" : "items"} · {amt.toLocaleString()} RWF
                          </div>
                          <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-x-2 gap-y-1 items-center">
                            <span>{new Date(o.createdAt).toLocaleString()}</span>
                            <span className="text-slate-300">·</span>
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-white ${getStatusColor(o.orderStatus)}`}
                            >
                              {friendlyStatusLabel(o)}
                            </span>
                            <span className="text-slate-400">Order #{o.id}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 sm:justify-end shrink-0">
                        {track ? (
                          <Button asChild size="sm" className="gap-1">
                            <Link href={buildTrackHref(o.id, o.publicToken)}>
                              <Truck className="h-4 w-4" />
                              Track order
                            </Link>
                          </Button>
                        ) : null}
                        {variant === "grandma" ? (
                          <Button
                            size="sm"
                            className="bg-orange-500 hover:bg-orange-600 text-white font-semibold shadow-sm border-0"
                            onClick={() => queueGrandmaReorderFromLines(o, o.items ?? [])}
                          >
                            Reorder
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant={track ? "outline" : "default"}
                            onClick={() => router.push(orderDetailsHref(o.id))}
                          >
                            View order
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="secondary"
                          className={
                            !rowCanFinance(o)
                              ? "opacity-50 cursor-not-allowed"
                              : ""
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
            </TabsContent>

            <TabsContent value="past-items" className="mt-4 space-y-8">
              {itemsBySeller.map(([key, group]) => (
                <section key={key} className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <Package className="h-4 w-4 text-slate-500" />
                    <h2 className="text-lg font-semibold text-slate-800">{group.label}</h2>
                  </div>
                  <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory">
                    {group.lines.map(({ order, item, lineIndex }) => {
                      const lineKey = `${order.id}-${lineIndex}-${item.id}`
                      const lineTotal = (item.price || 0) * (item.qty || 0)
                      const imgSrc = (item.image && item.image.trim() !== "" ? item.image : NO_IMAGE_URL) as string
                      return (
                        <div
                          key={lineKey}
                          className="snap-start shrink-0 w-[160px] sm:w-[176px] rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col overflow-hidden"
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
                          <div className="p-3 flex flex-col gap-1 min-h-0">
                            <div className="text-sm font-semibold text-slate-900 line-clamp-2 leading-snug">
                              {item.name}
                            </div>
                            <div className="text-sm font-medium text-slate-800">
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
                <p className="text-slate-500 text-sm">No line items on this page yet.</p>
              )}
            </TabsContent>
          </Tabs>
        )}

        {!loading && filteredOrders.length === 0 && !err && (
          <p className="text-slate-500">No orders found.</p>
        )}

        <div className="flex justify-center items-center gap-2 mt-6 flex-wrap">
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            Prev
          </Button>

          {pageButtons.map((n) => (
            <Button key={n} variant={n === page ? "default" : "outline"} onClick={() => setPage(n)}>
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
    </main>
  )
}
