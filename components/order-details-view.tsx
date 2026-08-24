"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ArrowLeft,
  Package,
  MapPin,
  Phone,
  CreditCard,
  Store,
  User,
  XCircle,
  MessageCircle,
} from "lucide-react"
import { formatPaymentMethod } from "@/lib/payment-utils"
import { useAuthStore } from "@/lib/auth-store"
import { isInvoiceFinanced, canRequestInvoiceFinancing } from "@/lib/order-financing"
import { GRANDMA_PATHS } from "@/lib/grandma-urls"

interface OrderItem {
  ITEM_CODE: string
  ITEM_NAME: string
  name: string
  QUANTITY: number
  qty: number
  UNIT_PRICE: number
  unitPrice: number
  UNIT: string
  unit: string
}

interface OrderDetails {
  ID_ORDER: number
  SELLER_NAMES: string
  SELLER_PHONE: string
  SELLER_ISHYIGA_ACCOUNT: string
  BUYER_ISHYIGA_ACCOUNT?: string
  BUYER_OWNER: string
  BUYER_NAME: string
  BUYER_PHONE: string
  BUYER_EMAIL: string
  DELIVERY_LOCATION: string
  BUYER_LOCATION: string
  PAYMENT_NAME: string
  PAYMENT_STATUS: string
  ORDER_STATUS: string
  REKISIYO_STATUS: string
  REFERENCE: string
  AMOUNT: number | null
  total: number | null
  CURRENCY: string
  CREATED_AT: number
  createdAt: string
  IS_TABLE_COMMAND: boolean
  TABLE_NAME?: string
  TABLE_LOCATION?: string
  items: OrderItem[]
}

export type OrderDetailsViewProps = {
  variant?: "site" | "grandma"
}

export function OrderDetailsView({ variant = "site" }: OrderDetailsViewProps) {
  const params = useParams()
  const router = useRouter()
  const orderId = params.orderId as string
  const user = useAuthStore((s) => s.user)
  const isGrandma = variant === "grandma"
  const shellClass = isGrandma ? "w-full max-w-[430px] mx-auto px-3 py-4" : "container mx-auto px-4 py-8 max-w-4xl"
  const ordersListHref = isGrandma ? GRANDMA_PATHS.buyerOrders : "/orders"

  const [order, setOrder] = useState<OrderDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [financingBusy, setFinancingBusy] = useState(false)

  useEffect(() => {
    if (!orderId) return

    const fetchOrderDetails = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch("/api/orders/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId }),
        })

        const data = await response.json()

        if (response.ok && data.order) {
          setOrder(data.order)
        } else {
          setError(data.error || "Failed to load order details")
        }
      } catch (err) {
        console.error("Error fetching order:", err)
        setError("Failed to load order details. Please try again.")
      } finally {
        setLoading(false)
      }
    }

    fetchOrderDetails()
  }, [orderId])

  useEffect(() => {
    if (!order || !orderId) return
    const sellerAccount = (order.SELLER_ISHYIGA_ACCOUNT || "").toString().trim().toLowerCase()
    const userAccount = (user?.ishyigaAccount || "").toString().trim().toLowerCase()
    if (sellerAccount && userAccount && sellerAccount === userAccount) {
      router.replace(`/supplier/orders/${orderId}`)
    }
  }, [order, orderId, user?.ishyigaAccount, router])

  const getStatusColor = (status?: string) => {
    if (!status) return "bg-gray-100 text-gray-800 border-gray-200"

    const s = status.toUpperCase()
    if (s === "DELIVERED" || s === "COMPLETED")
      return "bg-green-100 text-green-800 border-gray-200"
    if (s === "OPEN" || s === "PENDING")
      return "bg-blue-100 text-blue-800 border-gray-200"
    if (s === "CANCELLED" || s === "FAILED")
      return "bg-red-100 text-red-800 border-gray-200"
    return "bg-gray-100 text-gray-800 border-gray-200"
  }

  const getPaymentStatusColor = (status?: string) => {
    if (!status) return "bg-gray-100 text-gray-800 border-gray-200"
    const s = status.toUpperCase()
    if (s === "PAID") return "bg-green-100 text-green-800 border-gray-200"
    if (s === "PENDING" || s === "UNPAID") return "bg-yellow-100 text-yellow-800 border-gray-200"
    if (s === "FAILED") return "bg-red-100 text-red-800 border-gray-200"
    return "bg-gray-100 text-gray-800 border-gray-200"
  }

  const formatDate = (timestamp: number | string) => {
    try {
      const date = typeof timestamp === "number" ? new Date(timestamp) : new Date(timestamp)
      return date.toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch {
      return "N/A"
    }
  }

  const sendWhatsApp = () => {
    if (!order) return
    const items = order.items.map((item) => {
      const name = item.ITEM_NAME || item.name
      const qty = item.QUANTITY || item.qty || 0
      const price = item.UNIT_PRICE || item.unitPrice || 0
      return `${name} x${qty} - ${(qty * price).toLocaleString()} RWF`
    }).join("\n")

    const publicShopBase = (process.env.NEXT_PUBLIC_SHOP_URL || process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_API_URL || "https://shop.ihute.rw").replace(/\/$/, "")
    const path = isGrandma ? `/grandma/orders/${orderId}` : `/orders/${orderId}`
    const detailsUrl = `${publicShopBase}${path}`

    const message = `
ihute.rw - Shop Everything You Need
Rwanda's premier online marketplace for pharmacy, groceries, fashion, and more

Order

📦 Order #${order.ID_ORDER}

🏪 Shop: ${order.SELLER_NAMES}
📍 Location: ${order.DELIVERY_LOCATION || order.BUYER_LOCATION}

📋 Items:
${items}

💰 Total: ${(order.AMOUNT || order.total || 0).toLocaleString()} ${order.CURRENCY}
💳 Payment: ${formatPaymentMethod(order.PAYMENT_NAME)}
📱 My Phone: ${order.BUYER_PHONE}

🔗 Order Details: ${detailsUrl}
    `.trim()

    const phone = order.SELLER_PHONE?.replace(/\D/g, "")
    const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
    window.open(whatsappUrl, "_blank")
  }

  if (loading) {
    return (
      <div className={shellClass}>
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className={shellClass}>
        <Card className="border-red-200">
          <CardContent className="pt-6 text-center space-y-4">
            <XCircle className="h-12 w-12 text-red-500 mx-auto" />
            <h2 className="text-xl font-semibold text-red-900">Order Not Found</h2>
            <p className="text-red-700">{error || "This order does not exist."}</p>
            <Button onClick={() => router.push(ordersListHref)} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Orders
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const displayOrderStatus = order.ORDER_STATUS != null && String(order.ORDER_STATUS).trim() !== ""
    ? String(order.ORDER_STATUS).trim()
    : "—"
  const displayPaymentStatus = order.PAYMENT_STATUS != null && String(order.PAYMENT_STATUS).trim() !== ""
    ? String(order.PAYMENT_STATUS).trim()
    : "—"
  const paymentLabel = displayPaymentStatus
  const currency = order.CURRENCY || "RWF"

  const financed = isInvoiceFinanced(order.PAYMENT_STATUS)
  const canFinanceOrder = canRequestInvoiceFinancing(order.ORDER_STATUS, financed)

  const requestFinancing = async () => {
    if (!order || !canFinanceOrder || financingBusy) return
    const buyerAccount = (order.BUYER_ISHYIGA_ACCOUNT || user?.ishyigaAccount || "").trim()
    const sellerAccount = (order.SELLER_ISHYIGA_ACCOUNT || "").trim()
    const buyerTIN = (order as { BUYER_TIN?: string }).BUYER_TIN || ""
    const supplierTIN = (order as { SELLER_TIN?: string }).SELLER_TIN || ""
    if (!buyerAccount || !sellerAccount) {
      alert("Missing buyer or seller account for financing.")
      return
    }
    if (!confirm("Request financing for this order?")) return
    setFinancingBusy(true)
    try {
      const res = await fetch("/api/request-loan-with-details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: String(order.ID_ORDER),
          buyerAccount,
          sellerAccount,
          buyerTIN,
          supplierTIN,
          invoiceAmount: order.AMOUNT || order.total || 0,
        }),
      })
      const result = await res.json()
      if (res.ok && result.success) {
        setOrder({
          ...order,
          PAYMENT_STATUS: "UMUSADA",
        })
        alert(result.message || "Invoice financing submitted.")
      } else {
        if (result.code === "DUPLICATE_INVOICE") {
          setOrder({
            ...order,
            PAYMENT_STATUS: order.PAYMENT_STATUS || "UMUSADA",
          })
        }
        alert(result.error || "Financing request failed.")
      }
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Financing request failed.")
    } finally {
      setFinancingBusy(false)
    }
  }

  const goBack = () => {
    if (isGrandma) router.push(GRANDMA_PATHS.buyerOrders)
    else router.back()
  }

  return (
    <div className={shellClass}>
      <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          {!isGrandma ? (
            <Button variant="ghost" size="icon" onClick={goBack} className="shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          ) : null}
          <div className="min-w-0">
            <h1 className={isGrandma ? "text-xl font-bold" : "text-2xl font-bold"}>Order #{order.ID_ORDER}</h1>
            <p className="text-sm text-muted-foreground">
              Placed on {formatDate(order.CREATED_AT || order.createdAt)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Your order — contact the seller below if needed
            </p>
          </div>
        </div>

        {order.SELLER_PHONE ? (
          <Button
            onClick={sendWhatsApp}
            className="bg-[#25D366] hover:bg-[#20b05a] shrink-0"
            title="Open WhatsApp to contact the seller"
          >
            <MessageCircle className="h-4 w-4 mr-2" />
            Contact Seller
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Package className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Order Status</p>
                  <Badge className={getStatusColor(displayOrderStatus)} variant="outline">
                    {displayOrderStatus}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Payment Status</p>
                  <Badge className={getPaymentStatusColor(paymentLabel === "—" ? "" : paymentLabel)} variant="outline">
                    {paymentLabel}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Store className="h-4 w-4" />
              Seller
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p className="font-medium">{order.SELLER_NAMES || "—"}</p>
            {order.SELLER_PHONE ? (
              <p className="text-muted-foreground mt-1 flex items-center gap-1">
                <Phone className="h-3.5 w-3" />
                {order.SELLER_PHONE}
              </p>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4" />
              Buyer & delivery
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <p className="font-medium">{order.BUYER_NAME || order.BUYER_OWNER || "—"}</p>
            {order.BUYER_PHONE ? (
              <p className="text-muted-foreground flex items-center gap-1">
                <Phone className="h-3.5 w-3" />
                {order.BUYER_PHONE}
              </p>
            ) : null}
            {(order.DELIVERY_LOCATION || order.BUYER_LOCATION) ? (
              <p className="text-muted-foreground flex items-center gap-1 mt-1">
                <MapPin className="h-3.5 w-3" />
                {order.DELIVERY_LOCATION || order.BUYER_LOCATION}
              </p>
            ) : null}
            {order.IS_TABLE_COMMAND && order.TABLE_NAME ? (
              <p className="text-muted-foreground mt-1">
                Table: {order.TABLE_NAME}
                {order.TABLE_LOCATION ? ` · ${order.TABLE_LOCATION}` : ""}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Payment method</p>
          <p className="font-medium mt-1">{formatPaymentMethod(order.PAYMENT_NAME)}</p>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Order Items
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="min-w-full border border-gray-300 rounded-lg">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-2 border">Item</th>
                <th className="px-4 py-2 border">Quantity</th>
                <th className="px-4 py-2 border">Unit Price</th>
                <th className="px-4 py-2 border">Total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, idx) => {
                const name = item.ITEM_NAME || item.name
                const qty = item.QUANTITY || item.qty || 0
                const price = item.UNIT_PRICE || item.unitPrice || 0
                const total = qty * price
                return (
                  <tr key={idx}>
                    <td className="px-4 py-2 border">{name}</td>
                    <td className="px-4 py-2 border">{qty}</td>
                    <td className="px-4 py-2 border">{price.toLocaleString()} {currency}</td>
                    <td className="px-4 py-2 border font-semibold">{total.toLocaleString()} {currency}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <div className="flex justify-end mt-4 text-lg font-bold">
            Total: {(order.AMOUNT || order.total || 0).toLocaleString()} {currency}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end mb-6">
        <Button
          variant="default"
          disabled={!canFinanceOrder || financingBusy}
          onClick={requestFinancing}
        >
          {financingBusy ? "Submitting…" : financed ? "Financed" : "Finance Order"}
        </Button>
      </div>

    </div>
  )
}
