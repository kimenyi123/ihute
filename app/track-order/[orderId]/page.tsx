"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Truck, CheckCircle, Clock, Package, MessageCircle, ArrowLeft } from "lucide-react"

type OrderStatus = "pending" | "processing" | "in-transit" | "delivered"

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
  status: OrderStatus
  createdAt: string
}

function statusIcon(status: OrderStatus) {
  switch (status) {
    case "delivered":
      return <CheckCircle className="h-5 w-5 text-green-600" />
    case "in-transit":
      return <Truck className="h-5 w-5 text-blue-600" />
    case "processing":
      return <Package className="h-5 w-5 text-yellow-600" />
    default:
      return <Clock className="h-5 w-5 text-gray-600" />
  }
}

function statusBadge(status: OrderStatus) {
  const variants = {
    delivered: "default",
    "in-transit": "secondary",
    processing: "outline",
    pending: "outline"
  }
  return (
    <Badge variant={variants[status] as any} className="capitalize">
      {status.replace("-", " ")}
    </Badge>
  )
}

function buildTracking(status: OrderStatus) {
  return [
    { label: "Order Placed", completed: true, date: "" },
    { label: "Processing", completed: status !== "pending", date: "" },
    { label: "Out for Delivery", completed: status === "in-transit" || status === "delivered", date: "" },
    { label: "Delivered", completed: status === "delivered", date: "" },
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
    `Paid: ${formatCurrency(order.paymentMethod.includes('Delivery') ? 0 : order.total)}`,
    '',
    `Paid at: ${order.paymentMethod}`,
    `Message: Order #${orderId}`,
    `My phone: ${order.buyerPhone || ''}`,
    '',
    `Follow: ${window.location.origin}/track-order/${orderId}`
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
              <CardTitle>Order Information</CardTitle>
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
                <div>
                  <p className="text-sm text-muted-foreground">Payment Method</p>
                  <p className="font-medium">{order.paymentMethod}</p>
                </div>
              </div>

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
              <CardTitle>Order Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <div className="space-y-4">
                  {steps.map((step, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <div className="relative">
                        <div
                          className={`h-10 w-10 rounded-full flex items-center justify-center ${
                            step.completed ? "bg-green-600" : "bg-slate-200"
                          }`}
                        >
                          {step.completed ? (
                            <CheckCircle className="h-6 w-6 text-white" />
                          ) : (
                            <Clock className="h-6 w-6 text-slate-400" />
                          )}
                        </div>
                        {index < steps.length - 1 && (
                          <div
                            className={`absolute left-5 top-10 w-0.5 h-8 ${
                              step.completed ? "bg-green-600" : "bg-slate-200"
                            }`}
                          />
                        )}
                      </div>
                      <div className="flex-1 pt-2">
                        <p className={`font-medium ${step.completed ? "text-slate-900" : "text-slate-500"}`}>
                          {step.label}
                        </p>
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
                  Need Help?
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Have questions about your order? Contact the seller directly on WhatsApp.
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
