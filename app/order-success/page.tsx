"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle, MessageCircle, Copy, ArrowRight } from "lucide-react"
import { formatPaymentMethod } from "@/lib/payment-utils" // ✅ IMPORTED

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

export default function OrderSuccessPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const orderId = searchParams.get("orderId")
  const sellerName = searchParams.get("sellerName")
  const sellerPhone = searchParams.get("sellerPhone")
  const buyerPhone = searchParams.get("buyerPhone")
  const total = searchParams.get("total")

  const [copied, setCopied] = useState(false)
  const [orderDetails, setOrderDetails] = useState<any>(null)
  const [loadingDetails, setLoadingDetails] = useState(true)

  useEffect(() => {
    if (!orderId) {
      router.push("/")
      return
    }

    // Fetch order details to get product items
    async function fetchOrderDetails() {
      try {
        const res = await fetch("/api/orders/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId }),
          cache: "no-store",
        })
        const json = await res.json()
        console.log("[Order Success] Fetched order details:", json)
        if (json?.ok && json?.order) {
          console.log("[Order Success] Payment method:", json.order.paymentMethod)
          setOrderDetails(json.order)
        }
      } catch (err) {
        console.error("[Order Success] Failed to fetch order details:", err)
      } finally {
        setLoadingDetails(false)
      }
    }

    fetchOrderDetails()
  }, [orderId, router])

  if (!orderId) {
    return null
  }

  const siteBase = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_API_URL || "https://ihute.rw").replace(/\/Trading\/?$/, "")
  const trackingUrl = typeof window !== "undefined"
    ? `${window.location.origin}/track-order/${orderId}`
    : `${siteBase}/track-order/${orderId}`

  // Build WhatsApp message with product details - memoized to recalculate when orderDetails changes
  const { whatsappMessage, whatsappHref } = useMemo(() => {
    const formatCurrency = (amount: number) => `${amount.toLocaleString()} RWF`
    const padRight = (s: string, w: number) => (s.length >= w ? s : s + ' '.repeat(w - s.length))
    const padLeft = (s: string, w: number) => (s.length >= w ? s : ' '.repeat(w - s.length) + s)
    const trunc = (s: string, w: number) => (s.length > w ? s.slice(0, w - 1) + '…' : s)

    let message = ''

    if (orderDetails?.items && orderDetails.items.length > 0) {
      // Build detailed message with product table - matching cart-summary format
      const NAME_W = 44, QTY_W = 5, AMT_W = 14
      const header = padRight('Product name', NAME_W) + padLeft('Qty', QTY_W) + padLeft('Amount', AMT_W)
      const sep = '-'.repeat(NAME_W + QTY_W + AMT_W)

      const lines = orderDetails.items.map((item: any) => {
        const nm = padRight(trunc(item.name.replace(/\s+/g, ' ').trim(), NAME_W), NAME_W)
        const qt = padLeft(String(item.qty), QTY_W)
        const amt = padLeft(formatCurrency(item.qty * item.unitPrice), AMT_W)
        return nm + qt + amt
      })

      // Determine paid amount based on payment method
      const paymentMethod = orderDetails.paymentMethod || 'Unknown'
      const isPaid = paymentMethod && !paymentMethod.toLowerCase().includes('delivery')
      const paidAmount = isPaid ? orderDetails.total : 0

      console.log("[Order Success] Building WhatsApp message - Payment:", paymentMethod, "isPaid:", isPaid)

      message = [
        'Order',
        '',
        `Shop: ${sellerName || orderDetails.sellerName}`,
        orderDetails.buyerLocation ? `Location: ${orderDetails.buyerLocation}` : '',
        `Order ID: ${orderId}`,
        '',
        '```',
        header,
        sep,
        ...lines,
        '```',
        '',
        `Total: ${formatCurrency(orderDetails.total)}`,
        `Discount: ${formatCurrency(0)}`,
        `Paid: ${formatCurrency(paidAmount)}`,
        '',
        `Paid at: ${formatPaymentMethod(paymentMethod)}`,
        `Message: ${orderId ? `ORDER ${orderId}` : '-'}`,
        `My phone: ${buyerPhone}`,
        '',
        `Follow: ${trackingUrl}`
      ].filter(Boolean).join('\n')
    } else {
      // Fallback message without product details
      message = [
        'Order',
        '',
        `Shop: ${sellerName}`,
        `Order ID: ${orderId}`,
        '',
        `Total: ${Number(total).toLocaleString()} RWF`,
        `My phone: ${buyerPhone}`,
        '',
        `Follow: ${trackingUrl}`
      ].filter(Boolean).join('\n')
    }

    const sellerPhoneNormalized = normalizePhone(sellerPhone)
    const href = sellerPhoneNormalized ? waHrefFor(sellerPhoneNormalized, message) : ""

    return { whatsappMessage: message, whatsappHref: href }
  }, [orderDetails, orderId, sellerName, sellerPhone, buyerPhone, total, trackingUrl])

  const copyTrackingUrl = async () => {
    try {
      await navigator.clipboard.writeText(trackingUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Success Message */}
          <Card className="border-2 border-green-200 bg-green-50">
            <CardHeader className="text-center pb-4">
              <div className="flex justify-center mb-4">
                <div className="h-16 w-16 rounded-full bg-green-600 flex items-center justify-center">
                  <CheckCircle className="h-10 w-10 text-white" />
                </div>
              </div>
              <CardTitle className="text-2xl text-green-900">Order Placed Successfully!</CardTitle>
              <p className="text-green-700 mt-2">
                Your order has been received and is being processed
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-white rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Order ID:</span>
                  <span className="font-mono font-bold">{orderId}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Seller:</span>
                  <span className="font-medium">{sellerName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total:</span>
                  <span className="font-bold">{Number(total).toLocaleString()} RWF</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Order Tracking */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Track Your Order</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-slate-100 rounded-lg p-4">
                <p className="text-xs text-muted-foreground mb-2">Order Tracking URL:</p>
                <div className="flex gap-2">
                  <code className="flex-1 bg-white px-3 py-2 rounded text-sm break-all border">
                    {trackingUrl}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyTrackingUrl}
                    className="shrink-0"
                  >
                    {copied ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Save this link to track your order status anytime. You can also access it from the WhatsApp message sent to the seller.
              </p>
            </CardContent>
          </Card>

          {/* WhatsApp Notification */}
          {normalizePhone(sellerPhone) && (
            <Card className="border-2 border-green-100">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageCircle className="h-5 w-5 text-[#25D366]" />
                  Contact Seller on WhatsApp
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm text-green-900 mb-3">
                    <strong>Important:</strong> Click below to send your order details to the seller via WhatsApp.
                    This helps ensure faster processing and delivery.
                  </p>
                  {loadingDetails ? (
                    <Button
                      className="w-full bg-[#25D366] hover:bg-[#20b05a] text-white"
                      disabled
                    >
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Loading order details...
                    </Button>
                  ) : (
                    <Button
                      className="w-full bg-[#25D366] hover:bg-[#20b05a] text-white"
                      asChild
                    >
                    <Button asChild variant="outline" size="sm">
                      <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
                        <MessageCircle className="h-4 w-4 mr-2" />
                        Contact Seller on WhatsApp
                      </a>
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  The seller will receive your order details and contact you on {buyerPhone} for delivery confirmation.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Next Steps */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">What's Next?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-3">
                <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-blue-700">1</span>
                </div>
                <div>
                  <p className="font-medium">Order Confirmation</p>
                  <p className="text-sm text-muted-foreground">
                    The seller will review your order and confirm availability
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-blue-700">2</span>
                </div>
                <div>
                  <p className="font-medium">Preparation & Packaging</p>
                  <p className="text-sm text-muted-foreground">
                    Your items will be carefully prepared for delivery
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-blue-700">3</span>
                </div>
                <div>
                  <p className="font-medium">Delivery</p>
                  <p className="text-sm text-muted-foreground">
                    The seller will contact you to arrange delivery
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => router.push("/")}
            >
              Continue Shopping
            </Button>
            <Button
              className="flex-1"
              onClick={() => router.push(`/track-order/${orderId}`)}
            >
              Track Order
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}