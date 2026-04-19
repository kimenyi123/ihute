"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/lib/auth-store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { SdcInfoCell, sdcRaw } from "@/components/sdc-info-cell"
import { Loader2 } from "lucide-react"
import { ResponsiveTable } from "@/components/ui/responsive-table"
import { useOrdersStore, type Order } from "@/lib/orders-store"
import { isInvoiceFinanced, canRequestInvoiceFinancing } from "@/lib/order-financing"
import { mapBackendOrderStatusToStore } from "@/lib/order-status-map"
import { useAuthPersistHydrated } from "@/lib/use-auth-persist-hydrated"

type RawTxn = {
  ID_ORDER?: string
  BUYER_NAME?: string
  BUYER_NAMES?: string
  SELLER_NAMES?: string
  SELLER_ISHYIGA_ACCOUNT?: string
  AMOUNT?: number
  SERVED_AMOUNT?: number | string
  SERVED_QTY?: number | string
  servedAmount?: number | string
  servedQty?: number | string
  CONDITIONS?: string
  ORDER_NOTE?: string
  ORDER_STATUS?: string
  PAYMENT_STATUS?: string
  PAYMENT_NAME?: string
  REKISIYO_STATUS?: string
  CREATED_AT?: number
  BUYER_OWNER?: string
  BUYER_OWNER_NAME?: string
  buyerTIN?: string
  BUYER_TIN?: string
  SUPPLIER_TIN?: string
  SELLER_TIN?: string
  subtotal?: number
  BUYER_ISHYIGA_ACCOUNT?: string
  TIME_SDC?: string
  SDC_ID?: string
  RECEIPT_NUMBER?: string
  SDC_INTERNAL_DATA?: string
  RECEIPT_SIGNATURE?: string
  INTERNAL_DATA?: string
  /** Backend may use camelCase or other keys; indexed access in pickRawStr */
  [key: string]: unknown
}

function pickRawNum(raw: RawTxn, ...keys: string[]): number | null {
  const o = raw as Record<string, unknown>
  for (const k of keys) {
    const v = o[k]
    if (v == null || String(v).trim() === "") continue
    const n = Number(v)
    if (!Number.isNaN(n)) return n
  }
  return null
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
  return mapBackendOrderStatusToStore(raw)
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
          body: JSON.stringify({ orderId: o.id, buyerAccount: (o as any).buyerAccount }),
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
  const authHydrated = useAuthPersistHydrated()
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState<number | null>(null)
  const [search, setSearch] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [criteria, setCriteria] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const orders = useOrdersStore((s) => s.orders)
  const setOrders = useOrdersStore((s) => s.setOrders)
  const upsertOrder = useOrdersStore((s) => s.upsertOrder)

  useEffect(() => {
    if (!authHydrated) return
    if (!isAuthenticated) router.push("/login")
  }, [authHydrated, isAuthenticated, router])

  useEffect(() => {
    async function load() {
      if (!authHydrated || !isAuthenticated || !user?.email) return

      setLoading(true)
      setErr(null)

      try {
        const res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: user.email,
            buyerAccount: user.ishyigaAccount,
            CLIENT: search.trim() || undefined,
            START: dateFrom ? `${dateFrom} 00:00:00` : undefined,
            END: dateTo ? `${dateTo} 23:59:59` : undefined,
            criteria: criteria !== "all" ? criteria : undefined,
            page,
            pageSize,
          }),
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
            const resolvedBuyerName =
              pickRawStr(raw, "OWNER", "owner", "BUYER_OWNER_NAME", "BUYER_OWNER", "BUYER_NAME", "BUYER_NAMES") ||
              user?.owner ||
              "Unknown Buyer"
            return {
            id: raw.ID_ORDER?.toString() || crypto.randomUUID(),
            buyerName: resolvedBuyerName,
            buyerOwner:
              pickRawStr(raw, "OWNER", "owner", "BUYER_OWNER_NAME", "BUYER_OWNER") ||
              user?.owner ||
              "N/A",
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
            servedAmount: pickRawNum(raw, "SERVED_AMOUNT", "servedAmount", "AMOUNT_SERVED", "SERVED_TOTAL"),
            servedQty: pickRawNum(raw, "CONFIRMED_RECEIVED_QTY", "SERVED_QTY", "servedQty", "SERVED_QUANTITY", "received_quantity"),
            orderNote: pickRawStr(raw, "CONDITIONS", "ORDER_NOTE", "orderNote", "NOTE"),
            timeSdc: pickRawStr(raw, "TIME_SDC", "time_sdc", "SDC_TIME", "sdc_time"),
            sdcId: pickRawStr(raw, "SDC_ID", "sdc_id"),
            receiptNumber: pickRawStr(raw, "RECEIPT_NUMBER", "receipt_number"),
            sdcInternalData: pickRawStr(raw, "SDC_INTERNAL_DATA", "sdc_internal_data"),
            receiptSignature: pickRawStr(raw, "RECEIPT_SIGNATURE", "receipt_signature"),
            internalData: pickRawStr(raw, "INTERNAL_DATA", "internal_data"),
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
  }, [
    authHydrated,
    isAuthenticated,
    user?.email,
    user?.ishyigaAccount,
    search,
    dateFrom,
    dateTo,
    criteria,
    page,
    pageSize,
    setOrders,
    user?.owner,
  ])

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
    if (criteria !== "all") {
      const c = criteria.toUpperCase()
      list = list.filter((o) => {
        const payRaw = (o.paymentStatusRaw ?? "").toUpperCase()
        const st = (o.orderStatus ?? "").toUpperCase()
        if (c === "CREDIT") return payRaw.includes("CREDIT")
        return st === c
      })
    }
    if (!search.trim()) return list
    const s = search.toLowerCase()
    return list.filter(
      (o) =>
        (o.buyerName ?? "").toLowerCase().includes(s) ||
        ((o as any).buyerOwner ?? "").toLowerCase().includes(s) ||
        (o.seller ?? "").toLowerCase().includes(s) ||
        o.id.includes(s),
    )
  }, [orders, search, statusFilter, criteria])

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

  if (!authHydrated) {
    return (
      <div className="min-h-screen w-full flex flex-col bg-slate-50">
        <Header />
        <main className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-600">
          <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
          <p className="text-sm">Checking session…</p>
        </main>
        <Footer />
      </div>
    )
  }

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

  const exportOrderRowCsv = (o: Order) => {
    const servedAmount = Number((o as any).servedAmount ?? 0)
    const fields = [
      "Order ID",
      "Buyer",
      "Company",
      "Seller",
      "Amount",
      "Served Amount",
      "Served Qty",
      "Status",
      "Date",
      "Order Note",
      "TIME_SDC",
      "SDC_ID",
      "RECEIPT_NUMBER",
      "SDC_INTERNAL_DATA",
      "RECEIPT_SIGNATURE",
    ]
    const values = [
      String(o.id),
      String(o.buyerName ?? ""),
      String((o as any).buyerOwner ?? ""),
      String(o.seller ?? ""),
      String((o.amount ?? o.subtotal ?? 0)),
      String(Number.isFinite(servedAmount) ? servedAmount : ""),
      String(Number((o as any).servedQty ?? 0) || 0),
      String(o.orderStatus ?? ""),
      new Date(o.createdAt).toISOString(),
      String((o as any).orderNote ?? ""),
      String((o as any).timeSdc ?? "").trim(),
      String((o as any).sdcId ?? "").trim(),
      String((o as any).receiptNumber ?? "").trim(),
      String((o as any).sdcInternalData ?? "").trim(),
      String((o as any).receiptSignature ?? "").trim(),
    ]
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`
    const csv = `${fields.map(esc).join(",")}\n${values.map(esc).join(",")}\n`
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `order-${o.id}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="w-full max-w-7xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4 text-slate-800">Order Reports</h1>

        <div className="mb-4 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
          <input
            type="text"
            placeholder="Search by buyer, company, seller, or order ID..."
            className="border border-slate-300 px-3 py-2 rounded-lg w-full sm:max-w-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full sm:w-[170px]" />
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full sm:w-[170px]" />
          <Select value={criteria} onValueChange={setCriteria}>
            <SelectTrigger className="w-full sm:w-[180px] border-slate-300">
              <SelectValue placeholder="JSP criteria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All criteria</SelectItem>
              <SelectItem value="OPEN">OPEN</SelectItem>
              <SelectItem value="ORDER">ORDER</SelectItem>
              <SelectItem value="SLEEPED">SLEEPED</SelectItem>
              <SelectItem value="FACTURE">FACTURE</SelectItem>
              <SelectItem value="INVOICE">INVOICE</SelectItem>
              <SelectItem value="DELIVERED">DELIVERED</SelectItem>
              <SelectItem value="CREDIT">CREDIT</SelectItem>
            </SelectContent>
          </Select>
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
          <ResponsiveTable className="rounded-lg border border-slate-200 bg-white" minWidth="1200px">
            <table className="w-full">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Order ID</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Company</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Seller</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Amount</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Served Amount</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Order Note</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Date</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">SDC Info</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                {filteredOrders.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 align-middle font-semibold">{o.id}</td>
                    <td className="px-4 py-3 align-middle">{o.buyerName || (o as any).buyerOwner || "—"}</td>
                    <td className="px-4 py-3 align-middle">{o.seller}</td>
                    <td className="px-4 py-3 align-middle font-medium">
                      {(o.amount ?? o.subtotal ?? 0).toLocaleString()} RWF
                    </td>
                    <td className="px-4 py-3 align-middle font-medium">
                      {Number((o as any).servedAmount ?? 0).toLocaleString()} RWF
                    </td>
                    <td className="px-4 py-3 align-middle max-w-[220px] truncate" title={(o as any).orderNote || ""}>
                      {(o as any).orderNote || "—"}
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <span
                        className={`px-2 py-1 rounded text-white text-sm ${getStatusColor(o.orderStatus)}`}
                        title="Status from your account orders (backend)"
                      >
                        {o.orderStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-middle whitespace-nowrap">{new Date(o.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3 align-middle">
                      <SdcInfoCell order={o} />
                    </td>
                    <td className="px-4 py-3 align-middle flex gap-2">
                      <Button size="sm" variant="default" onClick={() => router.push(`/orders/${o.id}`)}>
                        View
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => exportOrderRowCsv(o)}>
                        Export
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
          </ResponsiveTable>
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
