"use client"

import { Suspense, useEffect, useState, useMemo } from "react"
import Link from "next/link"
import { useEffect, useState, useMemo, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle, MessageCircle, Copy, ArrowRight, ArrowLeft } from "lucide-react"
import { formatPaymentMethod } from "@/lib/payment-utils" // ✅ IMPORTED
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CheckCircle, MessageCircle, Copy, ArrowRight, Users, X } from "lucide-react"
import { formatPaymentMethod } from "@/lib/payment-utils"
import { RatingModal } from "@/components/RatingModal"
import { useTableCommandStore } from "@/lib/table-command-store"

function normalizePhone(raw?: string | null): string {
  const v = (raw || "").replace(/\s|-/g, "")
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

function OrderSuccessPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const orderId = searchParams.get("orderId")
  const trackToken = searchParams.get("trackToken")
  const sellerName = searchParams.get("sellerName")
  const sellerPhone = searchParams.get("sellerPhone")
  const buyerPhone = searchParams.get("buyerPhone")
  const total = searchParams.get("total")
  const fromGrandma = searchParams.get("from") === "grandma"
  const homeHref = fromGrandma ? "/grandma" : "/"

  const [copied, setCopied] = useState(false)
  const [orderDetails, setOrderDetails] = useState<any>(null)
  const [loadingDetails, setLoadingDetails] = useState(true)
  const [showRatingModal, setShowRatingModal] = useState(false)
  const [ratingItems, setRatingItems] = useState<Array<{ code: string, name: string }>>([])
  const [hasCheckedRating, setHasCheckedRating] = useState(false)

  // ✅ Get table session reactively from store
  const tableSession = useTableCommandStore((state) => state.activeSession)

  // ✅ Table shareable link alert for table creators
  const [showTableLinkAlert, setShowTableLinkAlert] = useState(false)
  const [tableShareLink, setTableShareLink] = useState<string>("")
  const [tableName, setTableName] = useState<string>("")
  const hasShownAlert = useRef(false)

  // Check if user is table creator and show shareable link
  useEffect(() => {
    if (hasShownAlert.current) return // Only show once per session

    if (tableSession) {
      console.log('🔍 Order Success - Table session:', tableSession)
      // User is in a table command session
      const isCreator = tableSession.userEmail === tableSession.createdBy
      console.log('🔍 Order Success - Is creator:', isCreator)

      if (isCreator && tableSession.tableName && tableSession.locationId) {
        // Generate shareable link (same format as backend)
        const tokenData = `${tableSession.tableName}|${tableSession.locationId}|${Date.now()}`
        const token = btoa(tokenData).replace(/\+/g, '-').replace(/\//g, '_')
        const shareLink = `${window.location.origin}/join-table?token=${token}`

        setTableShareLink(shareLink)
        setTableName(tableSession.tableName)
        setShowTableLinkAlert(true)
        hasShownAlert.current = true

        console.log('✅ Showing table share alert for:', tableSession.tableName)

        // Auto-hide after 8 seconds
        const timer = setTimeout(() => {
          setShowTableLinkAlert(false)
        }, 8000)

        return () => clearTimeout(timer)
      }
    }
  }, [tableSession])

  const copyTableLink = async () => {
    try {
      await navigator.clipboard.writeText(tableShareLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy table link:", err)
    }
  }

  useEffect(() => {
    if (!orderId && !trackToken) {
      router.push(fromGrandma ? "/grandma" : "/")
      return
    }

    // Fetch order details to get product items
    async function fetchOrderDetails() {
      try {
        const trackSlug = trackToken || orderId
        const res = await fetch("/api/orders/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: trackSlug }),
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
  }, [orderId, trackToken, router, fromGrandma])

  useEffect(() => {
    if (orderDetails && (orderId || trackToken) && !hasCheckedRating && orderDetails.status === "delivered") {
      setHasCheckedRating(true)
      const items = orderDetails?.items || []
      setRatingItems(items)
      setShowRatingModal(true)
      console.log('[Order Success] Showing rating modal for delivered order')
    }
  }, [orderDetails, orderId, trackToken, hasCheckedRating])

  if (!orderId && !trackToken) {
    return null
  }

  const displayOrderNo = String(orderDetails?.orderId ?? orderId ?? "")

  const siteBase = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_API_URL || "https://ihute.rw").replace(/\/Trading\/?$/, "")
  const trackSlugForUrl = trackToken || orderId
  const trackPath = `/track-order/${encodeURIComponent(trackSlugForUrl || "")}${fromGrandma ? "?from=grandma" : ""}`
  const trackingUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${trackPath}`
      : `${siteBase.replace(/\/$/, "")}${trackPath}`

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
        `Order ID: ${displayOrderNo}`,
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
        `Message: ${displayOrderNo ? `ORDER ${displayOrderNo}` : '-'}`,
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
        `Order ID: ${displayOrderNo}`,
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
  }, [orderDetails, orderId, displayOrderNo, sellerName, sellerPhone, buyerPhone, total, trackingUrl])

  const copyTrackingUrl = async () => {
    try {
      await navigator.clipboard.writeText(trackingUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  async function handleRatingDismiss() {
    setShowRatingModal(false)
    
    try {
      await fetch("/api/ratings/track-attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, action: "dismissed" }),
      })
    } catch (error) {
      console.error("[Rating] Failed to track dismiss:", error)
    }
  }

  function handleRatingSuccess() {
    console.log("[Rating] Rating submitted successfully")
    setShowRatingModal(false)
  }

  const successShell =
    "min-h-screen bg-gradient-to-b from-[#0369a1] via-[#0ea5e9] to-[#7dd3fc] text-white"

  const content = (
    <div className={successShell}>
      <header className="sticky top-0 z-40 border-b border-white/15 bg-gradient-to-r from-[#0369a1] to-[#0ea5e9] shadow-md">
        <div className="mx-auto flex max-w-[430px] items-center gap-3 px-4 py-3">
          <Link
            href={homeHref}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-white/15 px-2 py-1.5 text-sm font-semibold text-white hover:bg-white/25"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/80">Order placed</div>
            <div className="truncate text-lg font-bold leading-tight">Order #{displayOrderNo || orderId || trackToken}</div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[430px] space-y-4 px-4 py-6 pb-12">
        <Card className="border-0 shadow-xl rounded-2xl bg-white text-slate-900">
          <CardHeader className="text-center pb-4">
            <div className="mb-4 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-600 shadow-lg ring-4 ring-green-100">
                <CheckCircle className="h-10 w-10 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl text-slate-900">Order placed successfully</CardTitle>
            <p className="mt-2 text-slate-600">Processing — the shop will confirm your order</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 rounded-xl bg-slate-50 p-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Order ID</span>
                <span className="font-mono font-bold">{displayOrderNo || orderId || trackToken}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Seller</span>
                <span className="font-medium">{sellerName}</span>
              </div>
              {(sellerPhone?.trim() ||
                orderDetails?.sellerPhone ||
                orderDetails?.SELLER_PHONE) ? (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Seller number</span>
                  <span className="font-medium tabular-nums">
                    {String(
                      sellerPhone?.trim() ||
                        orderDetails?.sellerPhone ||
                        orderDetails?.SELLER_PHONE ||
                        "",
                    )}
                  </span>
                </div>
              ) : null}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total</span>
                <span className="font-bold">{Number(total).toLocaleString()} RWF</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-xl rounded-2xl bg-white text-slate-900">
          <CardHeader>
            <CardTitle className="text-lg">Track your order</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl bg-slate-100 p-4">
              <p className="mb-2 text-xs font-medium text-slate-700">
                If you don&apos;t sign in, track it here
              </p>
              <div className="flex gap-2">
                <code className="flex-1 break-all rounded border bg-white px-3 py-2 text-sm text-slate-800">
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
          </CardContent>
        </Card>

          {/* WhatsApp Notification */}
          {normalizePhone(sellerPhone) && (
            <Card className="border-0 shadow-xl rounded-2xl border-2 border-green-100 bg-white text-slate-900">
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

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="secondary"
              className="flex-1 bg-white text-slate-900 hover:bg-white/90"
              onClick={() => router.push(homeHref)}
            >
              {fromGrandma ? "Back to Grandma" : "Continue shopping"}
            </Button>
            <Button className="flex-1 bg-white text-[#0369a1] hover:bg-white/90" asChild>
              <Link href={trackPath} className="inline-flex items-center justify-center gap-2">
                Track order
                <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
              </Link>
            </Button>
          </div>
      </main>

      {/* Rating Modal */}
      {orderDetails && showRatingModal && (
        <RatingModal
          orderId={String(displayOrderNo || orderId || trackToken || "")}
          sellerId={orderDetails.sellerAccount || ""}
          sellerName={sellerName || orderDetails.sellerName || ""}
          buyerPhone={buyerPhone || orderDetails.buyerPhone || ""}
          items={ratingItems}
          open={showRatingModal}
          onClose={handleRatingDismiss}
          onSuccess={handleRatingSuccess}
        />
      )}
    </div>
  )
  return content
}

export default function OrderSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#0369a1] to-[#7dd3fc] text-sm font-medium text-white">
          Loading…
        </div>
      }
    >
      <OrderSuccessPageInner />
    </Suspense>
  )
}