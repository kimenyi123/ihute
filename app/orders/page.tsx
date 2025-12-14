// app/orders/page.tsx
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
  SELLER_ISHYIGA_ACCOUNT?: string  // Add this
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

// REQUEST LOAN FUNCTION
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
        sellerAccount,  // Now we pass seller account
        buyerTIN,
        supplierTIN,
        invoiceAmount: (order as any).subtotal || order.amount
      })
    })

    const result = await res.json()
    if (res.ok && result.success) {
      alert(
        `✅ Loan request submitted\n\n` +
        `Order #: ${order.id}\n` +
//         `Product: ${result.itemName}\n` +
//         `Product Code: ${result.itemCode}\n` +
        `Amount: ${((order as any).subtotal || order.amount).toLocaleString()} RWF`
      )
    } else {
      alert(`❌ Loan Request Failed\n\n${result.error || "Unknown error"}`)
    }
  } catch (err: any) {
    alert(`❌ Error\n\n${err.message || "Unknown error"}`)
  }
}

export default function OrdersPage() {
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
          const rawList: RawTxn[] =
            Array.isArray(json.transactions)
              ? json.transactions
              : Array.isArray(json.orders)
              ? json.orders
              : []

          const finalOrders: Order[] = rawList.map((raw) => ({
            id: raw.ID_ORDER?.toString() || crypto.randomUUID(),
            buyerName: raw.BUYER_NAME || "Unknown Buyer",
            buyerOwner: raw.BUYER_OWNER || user?.owner || "N/A",
            buyerAccount: raw.BUYER_ISHYIGA_ACCOUNT || "",
            sellerAccount: raw.SELLER_ISHYIGA_ACCOUNT || "",  // Add seller account
            seller: raw.SELLER_NAMES || "Unknown Seller",
            amount: raw.AMOUNT ?? 0,
            orderStatus: raw.ORDER_STATUS || "NA",
            createdAt: toIso(raw.CREATED_AT),
            items: [],
            buyerTIN: raw.buyerTIN || raw.BUYER_TIN || "",
            supplierTIN: raw.SUPPLIER_TIN || raw.SELLER_TIN || "",
            subtotal: raw.subtotal,
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
        o.buyerName.toLowerCase().includes(s) ||
        o.seller.toLowerCase().includes(s) ||
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
    <div className="min-h-screen w-full flex flex-col bg-gray-50">
      <Header />

      <main className="flex-1 w-full max-w-7xl mx-auto p-6">
        <h1 className="text-3xl font-bold mb-4 text-gray-800">My Orders</h1>

        <div className="mb-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
          <input
            type="text"
            placeholder="Search by buyer, seller, or order ID..."
            className="border px-3 py-2 rounded w-full sm:w-1/3"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading && <p>Loading...</p>}
        {err && <p className="text-red-600">{err}</p>}

        {!loading && filteredOrders.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full border border-gray-300 shadow-sm bg-white rounded-lg">
              <thead className="bg-gray-200 text-gray-700">
                <tr>
                  <th className="px-4 py-3 border">Order ID</th>
                  <th className="px-4 py-3 border">Seller</th>
                  <th className="px-4 py-3 border">Amount</th>
                  <th className="px-4 py-3 border">Status</th>
                  <th className="px-4 py-3 border">Date</th>
                  <th className="px-4 py-3 border">Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredOrders.map((o) => (
                  <tr key={o.id} className="hover:bg-gray-100">
                    <td className="px-4 py-3 border font-semibold">{o.id}</td>
                    <td className="px-4 py-3 border">{o.seller}</td>
                    <td className="px-4 py-3 border font-medium">
                      {o.amount.toLocaleString()} RWF
                    </td>
                    <td className="px-4 py-3 border">
                      <span
                        className={`px-2 py-1 rounded text-white text-sm ${getStatusColor(
                          o.orderStatus
                        )}`}
                      >
                        {o.orderStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 border">
                      {new Date(o.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 border flex gap-2">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => router.push(`/orders/${o.id}`)}
                      >
                        View
                      </Button>

                      <Button
                        size="sm"
                        className={`bg-blue-600 text-white ${
                          !canFinance(o.orderStatus)
                            ? "opacity-50 cursor-not-allowed"
                            : "hover:bg-blue-700"
                        }`}
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

        {/* PAGINATION */}
        <div className="flex justify-center items-center gap-2 mt-6 flex-wrap">
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
      </main>

      <Footer />
    </div>
  )
}