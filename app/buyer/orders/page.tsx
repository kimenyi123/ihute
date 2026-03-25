"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/lib/auth-store"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useOrdersStore, type Order } from "@/lib/orders-store"
import { isInvoiceFinanced, canRequestInvoiceFinancing } from "@/lib/order-financing"

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
  /** Backend may use camelCase or other keys; indexed access in pickRawStr */
  [key: string]: unknown
}

/** First non-empty string among known backend key spellings (legacy list payloads vary). */
function pickRawStr(raw: RawTxn, ...keys: string[]): string {
  const o = raw as Record<string, unknown>
  for (const k of keys) {
    const v = o[k]
    if (v != null && String(v).trim() !== "") return String(v).trim()
  }
  return ""
}

/** Java list rows use PAYMENT_STATUS; only fall back to alternate keys if it is missing. */
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
  const s = (raw || "").toLowerCase()
  if (s === "delivered") return "delivered"
  if (s === "cancelled" || s === "canceled") return "cancelled"
  if (s === "open") return "open"
  if (s === "processing" || s === "in-transit") return s as Order["status"]
  if (s === "invoice") return "invoice"
  return "pending"
}

function mapPaymentStoreStatus(raw?: string): Order["paymentStatus"] {
  const p = (raw || "").toLowerCase()
  if (p === "paid" || p.includes("umusada") || p.includes("financ")) return "paid"
  if (p === "failed") return "failed"
  if (p === "unpaid") return "unpaid"
  return "pending"
}

/**
 * Order list (fetchSuggestions) often omits or stale-fills PAYMENT_STATUS. For OPEN rows that
 * are not already financed per the list, merge PAYMENT_STATUS from /api/orders/track so the
 * Financing button matches getOrderDetails / buyer order view.
 */
async function enrichOpenOrdersPaymentFromTrack(orders: Order[]): Promise<Order[]> {
  const targets = orders.filter(
    (o) =>
      (o.orderStatus ?? "").trim().toUpperCase() === "OPEN" && !isInvoiceFinanced(o.paymentStatusRaw),
  )
  if (targets.length === 0) return orders

  const fetched = await Promise.all(
    targets.map(async (o) => {
      try {
        const tr = await fetch("/api/orders/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: o.id }),
          cache: "no-store",
        })
        const data = await tr.json()
        if (!tr.ok || !data?.ok || !data.order) return null
        const ps = data.order.PAYMENT_STATUS ?? data.order.paymentStatus
        if (ps == null || String(ps).trim() === "") return null
        return { id: o.id, payRaw: String(ps).trim() }
      } catch {
        return null
      }
    }),
  )

  const byId = new Map<string, string>()
  for (const row of fetched) {
    if (row?.payRaw) byId.set(row.id, row.payRaw)
  }

  return orders.map((o) => {
    const payRaw = byId.get(o.id)
    if (!payRaw) return o
    return {
      ...o,
      paymentStatusRaw: payRaw,
      paymentStatus: mapPaymentStoreStatus(payRaw),
    }
  })
}

async function requestLoan(order: Order, upsertOrder: (o: Order) => void) {
  const financed = isInvoiceFinanced(order.paymentStatusRaw)
  if (!canRequestInvoiceFinancing(order.orderStatus, financed)) {
    alert(`Financing not allowed for orders with status "${order.orderStatus}"`)
    return
  }

  const buyerAccount = (order as any).buyerAccount || ""
  const sellerAccount = (order as any).sellerAccount || ""
  const buyerTIN = (order as any).buyerTIN || ""
  const supplierTIN = (order as any).supplierTIN || ""

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
        invoiceAmount: (order as any).subtotal || order.amount,
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
          `Amount: ${((order as any).subtotal || order.amount).toLocaleString()} RWF`
      )
    } else {
      alert(`❌ Loan Request Failed\n\n${result.error || "Unknown error"}`)
    }
  } catch (err: any) {
    alert(`❌ Error\n\n${err.message || "Unknown error"}`)
  }
}

export default function BuyerOrdersPage() {
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
    if (!isAuthenticated) router.push("/login")
  }, [isAuthenticated, router])

  useEffect(() => {
    async function load() {
      if (!user?.email) return

      setLoading(true)
      setErr(null)

      try {
        const res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: user.email, page, pageSize }),
          cache: "no-store",
        })

        const json = await res.json()

        if (json?.ok === false) {
          setErr(json.message || "Failed to load orders")
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
            supplierTIN: raw.SUPPLIER_TIN || raw.SELLER_TIN || "",
          }
          })

          const enriched = await enrichOpenOrdersPaymentFromTrack(finalOrders)
          setOrders(enriched)
          setTotal(json.count ?? null)
        }
      } catch (e: any) {
        setErr(e.message || "Error loading orders")
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [user?.email, page, pageSize, setOrders, user?.owner])

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
    const buttons = []
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

  if (!isAuthenticated) return null

  const getStatusColor = (status?: string) => {
    const s = status?.toLowerCase() || ""
    if (s.includes("open")) return "bg-yellow-600"
    if (s.includes("closed") || s.includes("delivered")) return "bg-green-600"
    if (s.includes("transit")) return "bg-blue-600"
    return "bg-gray-500"
  }

  const rowCanFinance = (o: Order) => {
    const financed = isInvoiceFinanced(o.paymentStatusRaw)
    return canRequestInvoiceFinancing(o.orderStatus, financed)
  }

  return (
    <div className="min-h-screen w-full flex flex-col bg-slate-50">
      <Header />

      <main className="flex-1 w-full max-w-7xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4 text-slate-800">Order Reports</h1>

        <div className="mb-4 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
          <input
            type="text"
            placeholder="Search by buyer, seller, or order ID..."
            className="border border-slate-300 px-3 py-2 rounded-lg w-full sm:max-w-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[200px] border-slate-300">
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
        </div>

        {loading && <p className="text-slate-600">Loading...</p>}
        {err && <p className="text-red-600">{err}</p>}

        {!loading && filteredOrders.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Order ID</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Seller</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Amount</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Date</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                {filteredOrders.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold">{o.id}</td>
                    <td className="px-4 py-3">{o.seller}</td>
                    <td className="px-4 py-3 font-medium">
                      {(o.amount ?? o.subtotal ?? 0).toLocaleString()} RWF
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded text-white text-sm ${getStatusColor(o.orderStatus)}`}
                        title="Status from your account orders (backend)"
                      >
                        {o.orderStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3">{new Date(o.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3 flex gap-2">
                      <Button size="sm" variant="default" onClick={() => router.push(`/orders/${o.id}`)}>
                        View
                      </Button>

                      <Button
                        size="sm"
                        className={
                          !rowCanFinance(o)
                            ? "opacity-50 cursor-not-allowed bg-blue-600 hover:bg-blue-600"
                            : "bg-blue-600 hover:bg-blue-700"
                        }
                        onClick={() => requestLoan(o, upsertOrder)}
                        disabled={!rowCanFinance(o)}
                      >
                        Financing
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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

      <Footer />
    </div>
  )
}
