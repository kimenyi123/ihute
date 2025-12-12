"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Truck, CheckCircle, Clock, Package, MessageCircle, ArrowLeft, CreditCard, FileText } from "lucide-react"
import { formatPaymentMethod } from "@/lib/payment-utils"

// Updated to match supplier statuses
type OrderStatus = "open" | "processing" | "invoice" | "delivered" | "pending" | "in-transit"

type OrderDetail = {
  orderId: string
  sellerName: string
  sellerPhone?: string
  buyerName?: string
  buyerPhone?: string
  buyerLocation?: string
  items: Array<{
    name: string
    qty: number
    unitPrice: number
    unit?: string
  }>
  total: number
  paymentMethod: string
  paymentStatus?: string
  status: OrderStatus
  createdAt: string
}

function statusIcon(status: OrderStatus) {
  switch (status) {
    case "delivered":
      return <CheckCircle className="h-5 w-5 text-green-600" />
    case "in-transit":
      return <Truck className="h-5 w-5 text-blue-600" />
    case "invoice":
      return <FileText className="h-5 w-5 text-indigo-600" />
    case "processing":
      return <Package className="h-5 w-5 text-blue-600" />
    case "open":
    case "pending":
    default:
      return <Clock className="h-5 w-5 text-gray-600" />
  }
}

function statusBadge(status: OrderStatus) {
  switch (status) {
    case "delivered":
      return <Badge className="bg-green-600 capitalize">Delivered</Badge>
    case "in-transit":
      return <Badge className="bg-blue-600 capitalize">In Transit</Badge>
    case "invoice":
      return <Badge className="bg-indigo-600 capitalize">Invoice</Badge>
    case "processing":
      return <Badge className="bg-blue-600 capitalize">Processing</Badge>
    case "open":
      return <Badge variant="outline" className="capitalize">Open</Badge>
    case "pending":
    default:
      return <Badge variant="outline" className="capitalize">Pending</Badge>
  }
}

function paymentStatusBadge(paymentStatus?: string) {
  if (!paymentStatus) return null

  const status = paymentStatus.toLowerCase()

  if (status === "paid" || status === "success") {
    return <Badge className="bg-green-600">Paid</Badge>
  }
  if (status === "pending") {
    return <Badge variant="outline" className="border-yellow-600 text-yellow-600">Pending</Badge>
  }
  if (status === "failed") {
    return <Badge variant="destructive">Failed</Badge>
  }

  return <Badge variant="outline" className="capitalize">{paymentStatus}</Badge>
}

function buildTracking(status: OrderStatus) {
  // Map real statuses to tracking steps (now with 5 distinct steps)
  const statusMap: Record<OrderStatus, number> = {
    "open": 0,
    "pending": 0,
    "processing": 1,
    "invoice": 2,
    "in-transit": 3,
    "delivered": 4,
  }

  const currentStep = statusMap[status] ?? 0

  // Get friendly name for current status
  const statusLabels: Record<OrderStatus, string> = {
    "open": "Order Placed",
    "pending": "Awaiting Confirmation",
    "processing": "Being Prepared",
    "invoice": "Invoice",
    "in-transit": "Out for Delivery",
    "delivered": "Delivered Successfully"
  }

  const currentStatusLabel = statusLabels[status] || status

  return [
    {
      label: "Order Placed",
      subtitle: currentStep === 0 ? currentStatusLabel : "",
      completed: currentStep >= 0,
      date: "",
      isCurrent: currentStep === 0
    },
    {
      label: "Processing",
      subtitle: currentStep === 1 ? currentStatusLabel : "",
      completed: currentStep >= 1,
      date: "",
      isCurrent: currentStep === 1
    },
    {
      label: "Invoice",
      subtitle: currentStep === 2 ? currentStatusLabel : "",
      completed: currentStep >= 2,
      date: "",
      isCurrent: currentStep === 2
    },
    {
      label: "Out for Delivery",
      subtitle: currentStep === 3 ? currentStatusLabel : "",
      completed: currentStep >= 3,
      date: "",
      isCurrent: currentStep === 3
    },
    {
      label: "Delivered",
      subtitle: currentStep === 4 ? currentStatusLabel : "",
      completed: currentStep >= 4,
      date: "",
      isCurrent: currentStep === 4
    },
  ]
}

function normalizePhone(raw?: string | null): string {
  let v = (raw || "").replace(/\s|-/g, "")
  if (!v) return ""
  if (v.startsWith("+250") || v.startsWith("+258")) return v
  if (v.startsWith("250")) return "+" + v
  if (v.startsWith("00250")) return "+250" + v.slice(5)
  if (/^0?7\d{8}$/.test(v)) return "+250" + v.replace(/^0/, "")
  return v.startsWith("+25") ? v : "+25" + v
}

function waHrefFor(phone: string, text: string) {
  const p = phone.replace(/^\+/, "")
  const encoded = encodeURIComponent(text)
  return `https://wa.me/${p}?text=${encoded}`
}

export default function TrackOrderPage() {
  const params = useParams()
  const router = useRouter()
  const orderId = params.orderId as string

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [order, setOrder] = useState<OrderDetail | null>(null)

  useEffect(() => {
    async function fetchOrder() {
      if (!orderId) return

      setLoading(true)
      setError(null)

      try {
        const res = await fetch("/api/orders/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId }),
          cache: "no-store",
        })

        const json = await res.json()

        if (!res.ok || !json?.ok) {
          throw new Error(json?.error || "Failed to load order")
        }

        console.log("[Track Order] Order data received:", json.order)
        setOrder(json.order)
      } catch (err: any) {
        setError(err?.message || "Failed to load order")
      } finally {
        setLoading(false)
      }
    }

    fetchOrder()
  }, [orderId])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <Card>
            <CardHeader>
              <CardTitle>Loading order...</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">Please wait.</CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <Card>
            <CardHeader>
              <CardTitle>Order Not Found</CardTitle>
              <CardDescription className="text-destructive">
                {error || "We couldn't find an order with this ID."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => router.push("/")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    )
  }

  const steps = buildTracking(order.status)
  const sellerPhoneNormalized = normalizePhone(order.sellerPhone)

  // Format items for WhatsApp message
  const formatCurrency = (amount: number) => `${amount.toLocaleString()} RWF`

  // Build styled WhatsApp message
  const padRight = (s: string, w: number) => (s.length >= w ? s : s + ' '.repeat(w - s.length))
  const padLeft = (s: string, w: number) => (s.length >= w ? s : ' '.repeat(w - s.length) + s)
  const trunc = (s: string, w: number) => (s.length > w ? s.slice(0, w - 1) + '…' : s)

  const NAME_W = 44, QTY_W = 5, AMT_W = 14
  const header = padRight('Product name', NAME_W) + padLeft('Qty', QTY_W) + padLeft('Amount', AMT_W)
  const sep = '-'.repeat(NAME_W + QTY_W + AMT_W)

  const lines = order.items.map((item) => {
    const nm = padRight(trunc(item.name.replace(/\s+/g, ' ').trim(), NAME_W), NAME_W)
    const qt = padLeft(String(item.qty), QTY_W)
    const amt = padLeft(formatCurrency(item.qty * item.unitPrice), AMT_W)
    return nm + qt + amt
  })

  // Determine paid amount based on payment method
  const isPaid = order.paymentMethod && !order.paymentMethod.toLowerCase().includes('delivery')
  const paidAmount = isPaid ? order.total : 0

  const whatsappMessage = [
    'Order',
    '',
    `Shop: ${order.sellerName}`,
    order.buyerLocation ? `Location: ${order.buyerLocation}` : '',
    `Order ID: ${orderId}`,
    '',
    '```',
    header,
    sep,
    ...lines,
    '```',
    '',
    `Total: ${formatCurrency(order.total)}`,
    `Discount: ${formatCurrency(0)}`,
    `Paid: ${formatCurrency(paidAmount)}`,
    '',
    `Paid at: ${formatPaymentMethod(order.paymentMethod)}`,
    `Message: ${orderId ? `ORDER ${orderId}` : '-'}`,
    `My phone: ${order.buyerPhone || ''}`,
    '',
    `Follow: ${typeof window !== 'undefined' ? window.location.origin : ''}/track-order/${orderId}`
  ].filter(Boolean).join('\n')

  const whatsappHref = sellerPhoneNormalized ? waHrefFor(sellerPhoneNormalized, whatsappMessage) : ""

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Order Tracking</h1>
              <p className="text-slate-600">Order #{orderId}</p>
            </div>
            <div className="flex items-center gap-2">
              {statusIcon(order.status)}
              {statusBadge(order.status)}
            </div>
          </div>

          {/* Order Details */}
          <Card>
            <CardHeader>
              <CardTitle>Order Informations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Order ID</p>
                  <p className="font-mono font-medium">{order.orderId}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Order Date</p>
                  <p className="font-medium">{new Date(order.createdAt).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Seller</p>
                  <p className="font-medium">{order.sellerName}</p>
                </div>

                {/* Enhanced Payment Method Display */}
                <div>
                  <p className="text-sm text-muted-foreground">Payment Method</p>
                  <div className="flex items-center gap-2 mt-1">
                    <CreditCard className="h-4 w-4 text-slate-500" />
                    <p className="font-medium">{formatPaymentMethod(order.paymentMethod)}</p>
                  </div>
                </div>

                {/* Current Status */}
                <div className="col-span-2 pt-2 border-t">
                  <p className="text-sm text-muted-foreground mb-2">Current Status</p>
                  <div className="flex items-center gap-2">
                    {statusIcon(order.status)}
                    {statusBadge(order.status)}
                  </div>
                </div>

                {order.buyerName && (
                  <div>
                    <p className="text-sm text-muted-foreground">Buyer Name</p>
                    <p className="font-medium">{order.buyerName}</p>
                  </div>
                )}
                {order.buyerPhone && (
                  <div>
                    <p className="text-sm text-muted-foreground">Buyer Phone</p>
                    <p className="font-medium">{order.buyerPhone}</p>
                  </div>
                )}
              </div>

              {/* Payment Status Badge */}
              {order.paymentStatus && (
                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Payment Status</p>
                    {paymentStatusBadge(order.paymentStatus)}
                  </div>
                </div>
              )}

              {order.buyerLocation && (
                <div>
                  <p className="text-sm text-muted-foreground">Delivery Location</p>
                  <p className="font-medium">{order.buyerLocation}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tracking Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Order Progress</CardTitle>
              <CardDescription>Track your order from placement to delivery</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <div className="space-y-4">
                  {steps.map((step, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <div className="relative">
                        <div
                          className={`h-10 w-10 rounded-full flex items-center justify-center transition-colors ${
                            step.completed
                              ? "bg-green-600"
                              : step.isCurrent
                                ? "bg-blue-500 ring-4 ring-blue-100"
                                : "bg-slate-200"
                          }`}
                        >
                          {step.completed ? (
                            <CheckCircle className="h-6 w-6 text-white" />
                          ) : step.isCurrent ? (
                            <Clock className="h-6 w-6 text-white animate-pulse" />
                          ) : (
                            <Clock className="h-6 w-6 text-slate-400" />
                          )}
                        </div>
                        {index < steps.length - 1 && (
                          <div
                            className={`absolute left-5 top-10 w-0.5 h-8 transition-colors ${
                              step.completed ? "bg-green-600" : "bg-slate-200"
                            }`}
                          />
                        )}
                      </div>
                      <div className="flex-1 pt-2">
                        <p className={`font-medium ${
                          step.completed
                            ? "text-slate-900"
                            : step.isCurrent
                              ? "text-blue-600 font-semibold"
                              : "text-slate-500"
                        }`}>
                          {step.label}
                          {step.isCurrent && (
                            <span className="ml-2 text-xs text-blue-600 font-normal">(Current)</span>
                          )}
                        </p>
                        {step.subtitle && (
                          <p className="text-sm text-blue-600 font-medium mt-1">{step.subtitle}</p>
                        )}
                        {step.completed && step.date && (
                          <p className="text-sm text-slate-500">{step.date}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Items */}
          <Card>
            <CardHeader>
              <CardTitle>Order Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {order.items.map((item, index) => (
                  <div key={index} className="flex justify-between items-center pb-3 border-b last:border-0">
                    <div className="flex-1">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.qty} × {item.unitPrice.toLocaleString()} RWF
                        {item.unit && ` (${item.unit})`}
                      </p>
                    </div>
                    <p className="font-bold">{(item.qty * item.unitPrice).toLocaleString()} RWF</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t">
                <div className="flex justify-between items-center">
                  <p className="text-lg font-bold">Total</p>
                  <p className="text-lg font-bold">{order.total.toLocaleString()} RWF</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contact Seller */}
          {sellerPhoneNormalized && (
            <Card className="border-2 border-green-100">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5 text-[#25D366]" />
                  Contact Seller on WhatsApp
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-green-900 mb-3">
                  <strong>Important:</strong> Make sure that you have sent the order to seller via WhatsApp.
                  This helps ensure faster processing and delivery.
                </p>
                <Button
                  className="w-full bg-[#25D366] hover:bg-[#20b05a] text-white"
                  asChild
                >
                  <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Contact Seller on WhatsApp
                  </a>
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => router.push("/")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => window.location.reload()}>
              Refresh Status
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}