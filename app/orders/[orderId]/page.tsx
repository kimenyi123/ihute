"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ArrowLeft,
  Package,
  MapPin,
  Phone,
  CreditCard,
  Store,
  User,
  CheckCircle,
  XCircle,
  MessageCircle,
  Copy,
  Beer,
} from "lucide-react"
import { formatPaymentMethod } from "@/lib/payment-utils"

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

export default function OrderDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const orderId = params.orderId as string

  const [order, setOrder] = useState<OrderDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

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

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  const getStatusColor = (status?: string) => {
    if (!status) return "bg-gray-100 text-gray-800 border-gray-200"

    const s = status.toUpperCase()
    if (s === "DELIVERED" || s === "COMPLETED")
      return "bg-green-100 text-green-800 border-green-200"
    if (s === "OPEN" || s === "PENDING")
      return "bg-blue-100 text-blue-800 border-blue-200"
    if (s === "CANCELLED" || s === "FAILED")
      return "bg-red-100 text-red-800 border-red-200"
    return "bg-gray-100 text-gray-800 border-gray-200"
  }

  const getPaymentStatusColor = (status?: string) => {
    if (!status) return "bg-gray-100 text-gray-800 border-gray-200"
    const s = status.toUpperCase()
    if (s === "PAID") return "bg-green-100 text-green-800 border-green-200"
    if (s === "PENDING") return "bg-yellow-100 text-yellow-800 border-yellow-200"
    if (s === "FAILED") return "bg-red-100 text-red-800 border-red-200"
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

    const message = `
📦 Order #${order.ID_ORDER}

🏪 Shop: ${order.SELLER_NAMES}
📍 Location: ${order.DELIVERY_LOCATION || order.BUYER_LOCATION}

📋 Items:
${items}

💰 Total: ${(order.AMOUNT || order.total || 0).toLocaleString()} ${order.CURRENCY}
💳 Payment: ${formatPaymentMethod(order.PAYMENT_NAME)}
📱 My Phone: ${order.BUYER_PHONE}

🔗 Order Details: ${(process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_API_URL || "https://ihute.rw").replace(/\/Trading\/?$/, "")}/orders/${orderId}
    `.trim()

    const phone = order.SELLER_PHONE?.replace(/\D/g, "")
    const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
    window.open(whatsappUrl, "_blank")
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
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
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card className="border-red-200">
          <CardContent className="pt-6 text-center space-y-4">
            <XCircle className="h-12 w-12 text-red-500 mx-auto" />
            <h2 className="text-xl font-semibold text-red-900">Order Not Found</h2>
            <p className="text-red-700">{error || "This order does not exist."}</p>
            <Button onClick={() => router.push("/orders")} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Orders
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Order #{order.ID_ORDER}</h1>
            <p className="text-sm text-muted-foreground">
              Placed on {formatDate(order.CREATED_AT || order.createdAt)}
            </p>
          </div>
        </div>

        {order.SELLER_PHONE && (
          <Button onClick={sendWhatsApp} className="bg-[#25D366] hover:bg-[#20b05a]">
            <MessageCircle className="h-4 w-4 mr-2" />
            Contact Seller
          </Button>
        )}
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Package className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Order Status</p>
                  <Badge className={getStatusColor(order.ORDER_STATUS)} variant="outline">
                    {order.ORDER_STATUS}
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
                  <Badge className={getPaymentStatusColor(order.PAYMENT_STATUS)} variant="outline">
                     {order?.PAYMENT_STATUS || "UNKNOWN"}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Order Items Table */}
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
                    <td className="px-4 py-2 border">{price.toLocaleString()} {order.CURRENCY}</td>
                    <td className="px-4 py-2 border font-semibold">{total.toLocaleString()} {order.CURRENCY}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <div className="flex justify-end mt-4 text-lg font-bold">
            Total: {(order.AMOUNT || order.total || 0).toLocaleString()} {order.CURRENCY}
          </div>
        </CardContent>
      </Card>

      {/* Financing Button */}
      <div className="flex justify-end mb-6">
        <Button
          variant="default"
          disabled={order.ORDER_STATUS?.toUpperCase() !== "OPEN"}
        >
          Finance Order
        </Button>
      </div>

      {/* Success Toast */}
      {copied && (
        <div className="fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <CheckCircle className="h-4 w-4" />
          Copied to clipboard!
        </div>
      )}
    </div>
  )
}
