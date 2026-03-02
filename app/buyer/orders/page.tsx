"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/lib/auth-store"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { useOrdersStore, type Order } from "@/lib/orders-store"

type RawTxn = {
  ID_ORDER?: string
  BUYER_NAME?: string
  SELLER_NAMES?: string
  SELLER_ISHYIGA_ACCOUNT?: string
  AMOUNT?: number
  ORDER_STATUS?: string
  CREATED_AT?: number
  BUYER_OWNER?: string
  buyerTIN?: string
  BUYER_TIN?: string
  SUPPLIER_TIN?: string
  SELLER_TIN?: string
  subtotal?: number
  BUYER_ISHYIGA_ACCOUNT?: string
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
  if (s === "processing" || s === "in-transit") return s as Order["status"]
  return "pending"
}

async function requestLoan(order: Order) {
  if (order.orderStatus?.toLowerCase() !== "open") {
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
  const orders = useOrdersStore((s) => s.orders)
  const setOrders = useOrdersStore((s) => s.setOrders)

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

          const finalOrders: Order[] = rawList.map((raw) => ({
            id: raw.ID_ORDER?.toString() || crypto.randomUUID(),
            buyerName: raw.BUYER_NAME || "Unknown Buyer",
            buyerOwner: raw.BUYER_OWNER || user?.owner || "N/A",
            buyerAccount: raw.BUYER_ISHYIGA_ACCOUNT || "",
            sellerAccount: raw.SELLER_ISHYIGA_ACCOUNT || "",
            sellerId: raw.SELLER_ISHYIGA_ACCOUNT || "",
            sellerName: raw.SELLER_NAMES || "Unknown Seller",
            seller: raw.SELLER_NAMES || "Unknown Seller",
            amount: raw.AMOUNT ?? 0,
            orderStatus: raw.ORDER_STATUS || "NA",
            status: mapOrderStatus(raw.ORDER_STATUS),
            paymentStatus: "pending",
            createdAt: toIso(raw.CREATED_AT),
            items: [],
            subtotal: raw.subtotal ?? raw.AMOUNT ?? 0,
            buyerTIN: raw.buyerTIN || raw.BUYER_TIN || "",
            supplierTIN: raw.SUPPLIER_TIN || raw.SELLER_TIN || "",
          }))

          setOrders(finalOrders)
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

  const filteredOrders = useMemo(() => {
    if (!search) return orders
    const s = search.toLowerCase()
    return orders.filter(
      (o) =>
        (o.buyerName ?? "").toLowerCase().includes(s) ||
        (o.seller ?? "").toLowerCase().includes(s) ||
        o.id.includes(s)
    )
  }, [orders, search])

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

  const canFinance = (status?: string) => status?.toLowerCase() === "open"

  return (
    <div className="min-h-screen w-full flex flex-col bg-slate-50">
      <Header />

      <main className="flex-1 w-full max-w-7xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4 text-slate-800">Order Reports</h1>

        <div className="mb-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
          <input
            type="text"
            placeholder="Search by buyer, seller, or order ID..."
            className="border border-slate-300 px-3 py-2 rounded-lg w-full sm:max-w-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
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
                          !canFinance(o.orderStatus)
                            ? "opacity-50 cursor-not-allowed bg-blue-600 hover:bg-blue-600"
                            : "bg-blue-600 hover:bg-blue-700"
                        }
                        onClick={() => requestLoan(o)}
                        disabled={!canFinance(o.orderStatus)}
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
