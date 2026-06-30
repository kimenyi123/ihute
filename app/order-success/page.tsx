"use client"

import { Suspense, useEffect, useState, useMemo, useRef } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  CheckCircle,
  MessageCircle,
  Copy,
  ArrowRight,
  ArrowLeft,
  Users,
  X,
} from "lucide-react"
import { formatPaymentMethod, isCashOnDelivery } from "@/lib/payment-utils"
import {
  buildOrderReceiptViewModel,
  buildOrderWhatsAppMessage,
  isTableCommandOrder,
  resolveTableCommandLinePerson,
} from "@/lib/table-command-whatsapp"
import { OrderReceiptPreview } from "@/components/order-receipt-preview"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { RatingModal } from "@/components/RatingModal"
import { sellerAccountFromOrder } from "@/lib/order-seller-account"
import { useTableCommandStore } from "@/lib/table-command-store"
import { GRANDMA_PATHS } from "@/lib/grandma-urls"
import { isValidRwandaMobileE164, normalizeRwandaMobileE164 } from "@/lib/rwanda-phone"

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

/** Prefer seller mobile from order API — query `sellerPhone` may be a MoMo merchant code. */
function resolveSellerPhoneForWhatsApp(
  queryPhone: string | null | undefined,
  orderDetails: Record<string, unknown> | null | undefined,
): string {
  const fromOrder = normalizeRwandaMobileE164(
    String(orderDetails?.SELLER_PHONE ?? orderDetails?.sellerPhone ?? ""),
  )
  if (fromOrder && isValidRwandaMobileE164(fromOrder)) return fromOrder
  const fromQuery = normalizeRwandaMobileE164(String(queryPhone ?? ""))
  if (fromQuery && isValidRwandaMobileE164(fromQuery)) return fromQuery
  return ""
}

function OrderSuccessPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const orderId = searchParams.get("orderId")
  const trackToken = searchParams.get("trackToken")
  const sellerName = searchParams.get("sellerName")
  const sellerPhone = searchParams.get("sellerPhone")
  const buyerPhone = searchParams.get("buyerPhone")
  const orderNotesQuery = searchParams.get("orderNotes")?.trim() || ""
  const total = searchParams.get("total")
  const logisticsTypeQuery = searchParams.get("logisticsType")?.trim() || ""
  const logisticsAmountQuery = Number(searchParams.get("logisticsAmount") ?? "0")
  const fromGrandma = searchParams.get("from") === "grandma"

  const [copied, setCopied] = useState(false)
  const [orderDetails, setOrderDetails] = useState<any>(null)
  const [loadingDetails, setLoadingDetails] = useState(true)
  const [showRatingModal, setShowRatingModal] = useState(false)
  const [ratingItems, setRatingItems] = useState<Array<{ code: string, name: string }>>([])
  const [hasCheckedRating, setHasCheckedRating] = useState(false)

  const logisticsType =
    orderDetails?.DELIVERY_NAME || orderDetails?.deliveryName || logisticsTypeQuery || "Not specified"

  const safeNumber = (value: unknown, fallback: number): number => {
    const num = Number(value)
    return Number.isFinite(num) ? num : fallback
  }

  const orderDeliveryAmount = Number(orderDetails?.DELIVERY_AMOUNT ?? orderDetails?.deliveryAmount)
  const logisticsAmount =
    Number.isFinite(orderDeliveryAmount) && orderDeliveryAmount > 0
      ? orderDeliveryAmount
      : logisticsAmountQuery

  const rawOrderTotalFromDetails = Number(orderDetails?.total ?? orderDetails?.AMOUNT)
  const totalAmount =
    Number.isFinite(rawOrderTotalFromDetails) && rawOrderTotalFromDetails > 0
      ? rawOrderTotalFromDetails
      : Number(total ?? "0")

  const subtotalFromItems =
    orderDetails?.items?.reduce((sum: number, item: any) => {
      const qty = Number(item.qty ?? item.QUANTITY ?? item.QTY ?? 0) || 0
      const unitPrice = Number(item.unitPrice ?? item.UNIT_PRICE ?? item.UNITY_PRICE ?? item.UNITY_PRICE ?? 0) || 0
      return sum + qty * unitPrice
    }, 0) ?? 0

  const subtotalFromOrder = safeNumber(orderDetails?.subtotal ?? orderDetails?.SUBTOTAL, Number.NaN)
  const subtotalAmount = Math.max(
    0,
    Number.isFinite(subtotalFromItems) && subtotalFromItems > 0
      ? subtotalFromItems
      : Number.isFinite(subtotalFromOrder) && subtotalFromOrder > 0
      ? subtotalFromOrder
      : Number(total ?? "0") - logisticsAmount,
  )

  const fallbackGrandTotalAmount = subtotalAmount + logisticsAmount
  const queryTotal = safeNumber(total, Number.NaN)
  const computedGrandTotal =
    fallbackGrandTotalAmount > 0
      ? fallbackGrandTotalAmount
      : Number.isFinite(queryTotal) && queryTotal > 0
      ? queryTotal
      : totalAmount

  const orderSubtotalFromDetails = safeNumber(orderDetails?.subtotal ?? orderDetails?.SUBTOTAL, Number.NaN)
  const effectiveSubtotal = Number.isFinite(orderSubtotalFromDetails) && orderSubtotalFromDetails > 0
    ? orderSubtotalFromDetails
    : subtotalAmount

  const orderTotalFromDetails = safeNumber(orderDetails?.total ?? orderDetails?.AMOUNT, Number.NaN)
  const effectiveTotalAmount = (() => {
    if (Number.isFinite(orderTotalFromDetails) && orderTotalFromDetails > 0) {
      if (logisticsAmount > 0 && orderTotalFromDetails < effectiveSubtotal + logisticsAmount) {
        return effectiveSubtotal + logisticsAmount
      }
      return orderTotalFromDetails
    }
    if (Number.isFinite(queryTotal) && queryTotal > 0) return queryTotal
    return computedGrandTotal
  })()

  const discountAmount = Math.max(
    0,
    Math.round(effectiveSubtotal + logisticsAmount - effectiveTotalAmount),
  )

  const paymentQuery = searchParams.get("payment")?.trim() || ""
  const paymentMethod = orderDetails?.paymentMethod || orderDetails?.PAYMENT_NAME || paymentQuery || ""
  const isPaid =
    !isCashOnDelivery(paymentMethod) &&
    (String(orderDetails?.paymentStatus ?? orderDetails?.PAYMENT_STATUS ?? "")
      .toLowerCase()
      .includes("paid") ||
      paymentMethod.toUpperCase().includes("PAID_"))
  const paidAmount = isPaid ? effectiveTotalAmount : 0

  const autoWhatsApp = searchParams.get("autoWhatsApp") === "1"
  const momoTxId = searchParams.get("momoTxId")?.trim() || ""
  const homeHref = fromGrandma ? "/grandma" : "/"

  // ✅ Get table session reactively from store
  const tableSession = useTableCommandStore((state) => state.activeSession)

  // ✅ Table shareable link alert for table creators
  const [showTableLinkAlert, setShowTableLinkAlert] = useState(false)
  const [tableShareLink, setTableShareLink] = useState<string>("")
  const [tableName, setTableName] = useState<string>("")
  const hasShownAlert = useRef(false)
  const autoWhatsAppOpened = useRef(false)

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
  const orderDescription = (
    orderDetails?.CONDITIONS?.trim() ||
    orderDetails?.ORDER_NOTE?.trim() ||
    orderDetails?.orderNote?.trim() ||
    orderNotesQuery ||
    ""
  )

  const siteBase = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_API_URL || "https://ihute.rw").replace(/\/Trading\/?$/, "")
  const publicShopBase = (process.env.NEXT_PUBLIC_SHOP_URL || process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_API_URL || "https://shop.ihute.rw").replace(/\/$/, "")
  const trackSlugForUrl = trackToken || orderId
  const trackPath = `/track-order/${encodeURIComponent(trackSlugForUrl || "")}${fromGrandma ? "?from=grandma" : ""}`
  const trackingUrl = `${publicShopBase}${trackPath}`

  // Build WhatsApp message with product details - memoized to recalculate when orderDetails changes
  const { whatsappMessage, whatsappHref, orderReceipt } = useMemo(() => {
    let message = ""
    let receipt = null

    if (orderDetails?.items && orderDetails.items.length > 0) {
      const paymentMethod =
        orderDetails.paymentMethod || paymentQuery || "Unknown"
      const isPaidNow =
        !isCashOnDelivery(paymentMethod) &&
        (String(orderDetails.paymentStatus ?? orderDetails.PAYMENT_STATUS ?? "")
          .toLowerCase()
          .includes("paid") ||
          paymentMethod.toUpperCase().includes("PAID_"))
      const paidAmountNow = isPaidNow ? orderDetails.total : 0
      const isTable = isTableCommandOrder(orderDetails)
      const descriptionText =
        orderDetails.CONDITIONS?.trim() ||
        orderDetails.ORDER_NOTE?.trim() ||
        orderDetails.orderNote?.trim() ||
        orderNotesQuery ||
        ""

      const receiptLocation =
        orderDetails.buyerLocation ||
        orderDetails.DELIVERY_LOCATION ||
        (orderDetails.TABLE_NAME ? `Table: ${orderDetails.TABLE_NAME}` : undefined)
      const orderCreatedAt = orderDetails.createdAt ?? orderDetails.CREATED_AT

      const orderBuyerName =
        orderDetails.BUYER_OWNER ??
        orderDetails.BUYER_NAME ??
        orderDetails.buyerName ??
        ""

      const receiptArgs = {
        shop: sellerName || orderDetails.sellerName,
        location: receiptLocation,
        orderId: displayOrderNo,
        defaultOrderedBy: String(orderBuyerName ?? "").trim() || undefined,
        items: orderDetails.items.map((item: any) => ({
          name: item.name,
          qty: item.qty,
          unitPrice: item.unitPrice,
          orderedBy: resolveTableCommandLinePerson(
            item.orderedBy ?? item.ORDERED_BY,
            orderBuyerName,
          ),
          lineId: item.lineId ?? item.ID_LIST,
          lineCreatedAt:
            item.lineCreatedAt ?? item.HEURE ?? item.heure ?? orderCreatedAt,
        })),
        subtotal: effectiveSubtotal,
        total: effectiveTotalAmount,
        discount: discountAmount,
        paid: paidAmountNow,
        paidAt: formatPaymentMethod(paymentMethod),
        reference: displayOrderNo ? `ORDER ${displayOrderNo}` : undefined,
        myPhone: String(orderDetails?.buyerPhone || orderDetails?.BUYER_PHONE || buyerPhone || ""),
        link: trackingUrl,
        isTableCommand: isTable,
        momoTxId: momoTxId || undefined,
        orderDescription: descriptionText || undefined,
        logisticsType: logisticsType,
        logisticsFee: logisticsAmount,
      }

      receipt = buildOrderReceiptViewModel(receiptArgs)
      message = buildOrderWhatsAppMessage(receiptArgs)
    } else {
      // Fallback message without product details
      console.log("[Order Success] Using fallback message (no items)")
      const fallbackDescription = orderNotesQuery
        ? orderNotesQuery
        : (orderDetails?.CONDITIONS?.trim() || orderDetails?.ORDER_NOTE?.trim() || orderDetails?.orderNote?.trim())
        ? (orderDetails?.CONDITIONS || orderDetails?.ORDER_NOTE || orderDetails?.orderNote)
        : ""

      const fallbackLines = [
        "Order",
        "",
        `Shop: ${sellerName}`,
        `Order ID: ${displayOrderNo}`,
        momoTxId ? `MoMo TxId: ${momoTxId}` : "",
        ...(fallbackDescription ? ["", "Order Description:", fallbackDescription, ""] : []),
        `Logistics: ${logisticsType}`,
        `Subtotal: ${subtotalAmount.toLocaleString()} RWF`,
        `Logistics fee: ${logisticsAmount.toLocaleString()} RWF`,
        `Discount: ${discountAmount.toLocaleString()} RWF`,
        `Total: ${effectiveTotalAmount.toLocaleString()} RWF`,
        `Paid: ${paidAmount.toLocaleString()} RWF`,
        "",
        `Paid at: ${formatPaymentMethod(paymentMethod)}`,
        `My phone: ${orderDetails?.buyerPhone || orderDetails?.BUYER_PHONE || buyerPhone || ""}`,
        "",
        `Follow: ${trackingUrl}`,
      ]

      console.log("[Order Success] Fallback message array before filter:", fallbackLines)
      message = fallbackLines.filter(Boolean).join("\n")
      
      console.log("[Order Success] Fallback final WhatsApp message:", message)
    }

    const sellerPhoneNormalized = resolveSellerPhoneForWhatsApp(sellerPhone, orderDetails)
    const href = sellerPhoneNormalized ? waHrefFor(sellerPhoneNormalized, message) : ""

    return { whatsappMessage: message, whatsappHref: href, orderReceipt: receipt }
  }, [
    orderDetails,
    orderId,
    displayOrderNo,
    sellerName,
    sellerPhone,
    buyerPhone,
    total,
    trackingUrl,
    momoTxId,
    paymentQuery,
    effectiveSubtotal,
    effectiveTotalAmount,
    discountAmount,
    logisticsAmount,
    logisticsType,
    orderNotesQuery,
  ])

  useEffect(() => {
    if (!fromGrandma || !autoWhatsApp || loadingDetails || !whatsappHref) return
    if (autoWhatsAppOpened.current) return
    autoWhatsAppOpened.current = true
    window.open(whatsappHref, "_blank", "noopener,noreferrer")
  }, [fromGrandma, autoWhatsApp, loadingDetails, whatsappHref])

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
            <div className="flex justify-center">
              <img
                src="/img/logo.png"
                alt="Ihute logo"
                className="h-16 w-16 rounded-full bg-white p-2 shadow-sm object-contain"
              />
            </div>
            <div className="space-y-2 rounded-xl bg-slate-50 p-4">
              {orderDescription ? (
                <div className="mb-3 rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-800">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Order Description</div>
                  <div className="mt-1 font-medium">{orderDescription}</div>
                </div>
              ) : null}
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
                <span className="text-muted-foreground">Logistics</span>
                <span className="font-medium">{logisticsType}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium tabular-nums">
                  {subtotalAmount.toLocaleString()} RWF
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Logistics fee</span>
                <span className="font-medium tabular-nums">
                  {logisticsAmount.toLocaleString()} RWF
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Discount</span>
                <span className="font-medium tabular-nums">
                  {discountAmount.toLocaleString()} RWF
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total</span>
                <span className="font-bold">
                  {effectiveTotalAmount.toLocaleString()} RWF
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Paid</span>
                <span className="font-medium tabular-nums">
                  {paidAmount.toLocaleString()} RWF
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Paid at</span>
                <span className="font-medium">
                  {formatPaymentMethod(paymentMethod)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">My phone</span>
                <span className="font-medium tabular-nums">
                  {String(orderDetails?.buyerPhone || orderDetails?.BUYER_PHONE || buyerPhone || "")}
                </span>
              </div>
              <div className="rounded-2xl bg-slate-100 p-3 text-sm">
                <div className="text-muted-foreground">Follow</div>
                <a
                  href={trackingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-slate-900 underline break-all"
                >
                  {trackingUrl}
                </a>
              </div>
              {/* Order description is shown in the receipt preview (above product list) */}
            </div>
          </CardContent>
        </Card>

        {orderReceipt ? (
          <Card className="border-0 shadow-xl rounded-2xl bg-white text-slate-900">
            <CardHeader>
              <CardTitle className="text-lg">Order receipt</CardTitle>
            </CardHeader>
            <CardContent>
              <OrderReceiptPreview receipt={orderReceipt} />
            </CardContent>
          </Card>
        ) : null}

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

        {whatsappHref ? (
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
        ) : null}

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 pt-2">
            {fromGrandma && orderId ? (
              <Button className="w-full bg-white text-[#0369a1] hover:bg-white/90" asChild>
                <Link
                  href={`${GRANDMA_PATHS.buyerOrders}?orderId=${encodeURIComponent(orderId)}`}
                  className="inline-flex items-center justify-center gap-2"
                >
                  View in my orders
                  <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
                </Link>
              </Button>
            ) : null}
            <div className="flex gap-3">
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
          </div>
      </main>

      {/* Rating Modal */}
      {orderDetails && showRatingModal && (
        <RatingModal
          orderId={String(displayOrderNo || orderId || trackToken || "")}
          sellerId={sellerAccountFromOrder(orderDetails)}
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