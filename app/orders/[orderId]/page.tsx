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
  Mail,
  Clock,
  CreditCard,
  Store,
  User,
  CheckCircle,
  XCircle,
  Loader2,
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
  AMOUNT: number
  total: number
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

  const getStatusColor = (status: string) => {
    const s = status.toUpperCase()
    if (s === "DELIVERED" || s === "COMPLETED") return "bg-green-100 text-green-800 border-green-200"
    if (s === "OPEN" || s === "PENDING") return "bg-blue-100 text-blue-800 border-blue-200"
    if (s === "CANCELLED" || s === "FAILED") return "bg-red-100 text-red-800 border-red-200"
    return "bg-gray-100 text-gray-800 border-gray-200"
  }

  const getPaymentStatusColor = (status: string) => {
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
      const qty = item.QUANTITY || item.qty
      const price = item.UNIT_PRICE || item.unitPrice
      return `${name} x${qty} - ${(qty * price).toLocaleString()} RWF`
    }).join("\n")

    const message = `
📦 Order #${order.ID_ORDER}

🏪 Shop: ${order.SELLER_NAMES}
📍 Location: ${order.DELIVERY_LOCATION || order.BUYER_LOCATION}

📋 Items:
${items}

💰 Total: ${(order.AMOUNT || order.total).toLocaleString()} ${order.CURRENCY}
💳 Payment: ${formatPaymentMethod(order.PAYMENT_NAME)}
📱 My Phone: ${order.BUYER_PHONE}

🔗 Order Details: https://ihute.rw/orders/${orderId}
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
            <p className="text-red-700">{error || "This order does not exist or you don't have permission to view it."}</p>
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
        
        {/* WhatsApp Contact Button */}
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
                    {order.PAYMENT_STATUS}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table Command Info */}
      {order.IS_TABLE_COMMAND && order.TABLE_NAME && (
        <Card className="mb-6 border-amber-200 bg-amber-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Beer className="h-5 w-5 text-amber-600" />
              <div>
                <p className="text-sm font-medium text-amber-900">Table Command Order</p>
                <p className="text-sm text-amber-700">
                  Table: <span className="font-mono font-semibold">{order.TABLE_NAME}</span>
                  {order.TABLE_LOCATION && ` at ${order.TABLE_LOCATION}`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Order Items */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Order Items
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {order.items.map((item, index) => {
              const name = item.ITEM_NAME || item.name
              const qty = item.QUANTITY || item.qty
              const price = item.UNIT_PRICE || item.unitPrice
              const unit = item.UNIT || item.unit || "pcs"
              const total = qty * price

              return (
                <div key={index}>
                  <div className="flex items-center justify-between py-3">
                    <div className="flex-1">
                      <p className="font-medium">{name}</p>
                      <p className="text-sm text-muted-foreground">
                        {qty} {unit} × {price.toLocaleString()} {order.CURRENCY}
                      </p>
                    </div>
                    <p className="font-semibold">{total.toLocaleString()} {order.CURRENCY}</p>
                  </div>
                  {index < order.items.length - 1 && <Separator />}
                </div>
              )
            })}
          </div>

          <Separator className="my-4" />

          <div className="flex items-center justify-between text-lg font-bold">
            <span>Total</span>
            <span>{(order.AMOUNT || order.total).toLocaleString()} {order.CURRENCY}</span>
          </div>
        </CardContent>
      </Card>

      {/* Delivery & Payment Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Seller Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Store className="h-5 w-5" />
              Seller Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-2">
              <Store className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="font-medium">{order.SELLER_NAMES}</p>
              </div>
            </div>
            {order.SELLER_PHONE && (
              <div className="flex items-start gap-2">
                <Phone className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{order.SELLER_PHONE}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(order.SELLER_PHONE, "Phone")}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Buyer Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-5 w-5" />
              Customer Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-2">
              <User className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="font-medium">{order.BUYER_OWNER || order.BUYER_NAME}</p>
              </div>
            </div>
            {order.BUYER_PHONE && (
              <div className="flex items-start gap-2">
                <Phone className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium">{order.BUYER_PHONE}</p>
                </div>
              </div>
            )}
            {order.DELIVERY_LOCATION || order.BUYER_LOCATION ? (
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Delivery Location</p>
                  <p className="font-medium">{order.DELIVERY_LOCATION || order.BUYER_LOCATION}</p>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* Payment Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-5 w-5" />
            Payment Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Payment Method</span>
            <span className="font-medium">{formatPaymentMethod(order.PAYMENT_NAME)}</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Payment Status</span>
            <Badge className={getPaymentStatusColor(order.PAYMENT_STATUS)} variant="outline">
              {order.PAYMENT_STATUS}
            </Badge>
          </div>
          {order.REFERENCE && (
            <>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Reference</span>
                <span className="font-mono text-sm">{order.REFERENCE}</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

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