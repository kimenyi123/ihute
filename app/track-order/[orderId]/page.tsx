"use client"

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Truck,
  CheckCircle,
  Clock,
  Package,
  MessageCircle,
  ArrowLeft,
  CreditCard,
  FileText,
  Download,
  Eye,
  XCircle,
  Loader2,
} from "lucide-react"
import { formatPaymentMethod, isCashOnDelivery } from "@/lib/payment-utils"
import {
  buildOrderReceiptViewModel,
  buildOrderWhatsAppMessageFromViewModel,
  isTableCommandOrder,
  resolveTableCommandLinePerson,
} from "@/lib/table-command-whatsapp"
import { RatingModal } from "@/components/RatingModal"
import { sellerAccountFromOrder } from "@/lib/order-seller-account"
import { useOrderTracking } from "@/hooks/useOrderTracking"
import { DeliveryCountdown } from "@/components/delivery-countdown"
import { unitMeaningfulForDisplay } from "@/lib/product-unit-display"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { TaxInvoice } from "@/components/invoice/TaxInvoice"
import { InvoiceQRCode } from "@/components/invoice/InvoiceQRCode"
import type { BuyerEbmFiscalInfo } from "@/lib/ebm/ebm-buyer-request"
import { buildTaxInvoiceViewModel } from "@/lib/invoice/tax-invoice-view-model"
import { downloadTaxInvoicePdf } from "@/lib/invoice/tax-invoice-pdf"
import type { TaxInvoiceOrderInput } from "@/lib/invoice/tax-invoice-types"

// Updated to match supplier statuses + cancelled (reject / cancel from seller or system)
type OrderStatus =
  | "open"
  | "processing"
  | "invoice"
  | "delivered"
  | "pending"
  | "in-transit"
  | "cancelled"

type OrderDetail = {
  orderId: string
  sellerName: string
  sellerAccount?: string
  sellerPhone?: string
  buyerName?: string
  buyerPhone?: string
  buyerLocation?: string
  deliveryName?: string
  deliveryAmount?: number
  items: Array<{
    name: string
    qty: number
    unitPrice: number
    unit?: string
    orderedBy?: string
    ORDERED_BY?: string
    lineId?: number
    ID_LIST?: number
    lineCreatedAt?: number | string | null
    HEURE?: number | string | null
    heure?: number | string | null
  }>
  total: number
  paymentMethod: string
  paymentStatus?: string
  status: OrderStatus
  /** Raw DB / servlet value (e.g. INVOICE>>LOADED) — shown verbatim when present */
  ORDER_STATUS?: string
  IS_TABLE_COMMAND?: boolean
  TABLE_NAME?: string
  TABLE_LOCATION?: string
  createdAt: string
  estimatedDeliveryAt?: string
  driverPhone?: string
  /** Seller marked payment (shared server meta; gateway may still be pending). */
  sellerPaymentAck?: "paid" | "pending"
  clientMetaUpdatedAt?: string
  SELLER_TIN?: string
  BUYER_TIN?: string
  SELLER_EMAIL?: string
  BUYER_EMAIL?: string
  SELLER_ADDRESS?: string
  CURRENCY?: string
}

function statusIcon(status: OrderStatus) {
  switch (status) {
    case "cancelled":
      return <Clock className="h-5 w-5 text-red-600" />
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
    case "cancelled":
      return <Badge className="bg-red-600 capitalize">Rejected / cancelled</Badge>
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

/** True when buyer may still need to confirm payment on their side (tap badge to report). */
function isPaymentPendingLike(paymentStatus?: string): boolean {
  if (!paymentStatus) return false
  const s = paymentStatus.toLowerCase()
  if (s === "paid" || s === "success" || s.includes("paid")) return false
  return s === "pending" || s.includes("pending") || s === "unpaid" || s.includes("unpaid")
}

const PAYMENT_ACK_STORAGE_PREFIX = "ihute:track:paymentAck:"
const BUYER_ADDRESS_STORAGE_PREFIX = "ihute:track:buyerAddress:"

/** Prefer raw ORDER_STATUS from the API; otherwise the friendly badge from mapped `status`. */
function orderStatusBadge(order: Pick<OrderDetail, "status" | "ORDER_STATUS">) {
  const raw = order.ORDER_STATUS?.trim()
  if (raw) {
    return (
      <Badge
        variant="outline"
        className="font-mono text-xs font-normal normal-case max-w-[min(100%,28rem)] whitespace-normal break-all text-left"
        title={raw}
      >
        {raw}
      </Badge>
    )
  }
  return statusBadge(order.status)
}

function buildTracking(status: OrderStatus) {
  if (status === "cancelled") {
    return [
      {
        label: "Order placed",
        subtitle: "",
        completed: true,
        date: "",
        isCurrent: false,
        failed: false,
      },
      {
        label: "Not accepted",
        subtitle: "The shop rejected or cancelled this order",
        completed: true,
        date: "",
        isCurrent: true,
        failed: true,
      },
    ]
  }

  // Map real statuses to tracking steps (now with 5 distinct steps)
  const statusMap: Record<OrderStatus, number> = {
    "open": 0,
    "pending": 0,
    "processing": 1,
    "invoice": 2,
    "in-transit": 3,
    "delivered": 4,
    "cancelled": 0,
  }

  const currentStep = statusMap[status] ?? 0

  // Get friendly name for current status
  const statusLabels: Record<OrderStatus, string> = {
    "open": "Order Placed",
    "pending": "Order Placed",
    "processing": "Processing",
    "invoice": "Invoice",
    "in-transit": "Out for Delivery",
    "delivered": "Delivered Successfully",
    "cancelled": "Not accepted",
  }

  const currentStatusLabel = statusLabels[status] || status

  return [
    {
      label: "Order Placed",
      subtitle: currentStep === 0 ? currentStatusLabel : "",
      completed: currentStep >= 0,
      date: "",
      isCurrent: currentStep === 0,
      failed: false,
    },
    {
      label: "Processing",
      subtitle: currentStep === 1 ? currentStatusLabel : "",
      completed: currentStep >= 1,
      date: "",
      isCurrent: currentStep === 1,
      failed: false,
    },
    {
      label: "Invoice",
      subtitle: currentStep === 2 ? currentStatusLabel : "",
      completed: currentStep >= 2,
      date: "",
      isCurrent: currentStep === 2,
      failed: false,
    },
    {
      label: "Out for Delivery",
      subtitle: currentStep === 3 ? currentStatusLabel : "",
      completed: currentStep >= 3,
      date: "",
      isCurrent: currentStep === 3,
      failed: false,
    },
    {
      label: "Delivered",
      subtitle: currentStep === 4 ? currentStatusLabel : "",
      completed: currentStep >= 4,
      date: "",
      isCurrent: currentStep === 4,
      failed: false,
    },
  ]
}

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

function canShowInvoiceActions(rawStatus?: string): boolean {
  const s = (rawStatus || "").trim().toUpperCase()
  return s !== "" && s !== "OPEN"
}

function orderFinancials(order: OrderDetail) {
  const logisticsFeeValue = Number(order.deliveryAmount ?? (order as { DELIVERY_AMOUNT?: number }).DELIVERY_AMOUNT ?? 0)
  const subtotalValue = order.items.reduce(
    (sum, item) => sum + Number(item.qty || 0) * Number(item.unitPrice || 0),
    0,
  )
  const dbTotal = Number(order.total || 0)
  const computedTotal = subtotalValue + logisticsFeeValue
  const displayTotal =
    logisticsFeeValue > 0 && dbTotal > 0 && dbTotal < computedTotal ? computedTotal : dbTotal || computedTotal
  const discountValue = Math.max(0, subtotalValue + logisticsFeeValue - displayTotal)
  return { logisticsFeeValue, subtotalValue, displayTotal, discountValue }
}

const trackShell =
  "min-h-screen bg-gradient-to-b from-[#0369a1] via-[#0ea5e9] to-[#7dd3fc] text-white"

function TrackOrderPageInner() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const orderId = params.orderId as string
  const fromGrandma = searchParams.get("from") === "grandma"
  const homeHref = fromGrandma ? "/grandma" : "/"

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [order, setOrder] = useState<OrderDetail | null>(null)

  const [paymentAckOpen, setPaymentAckOpen] = useState(false)
  const [buyerPaymentAck, setBuyerPaymentAck] = useState<"received" | "not_received" | null>(null)
  /** `undefined` = no localStorage entry (use API). A string (incl. empty) = saved on this device. */
  const [buyerAddressOverride, setBuyerAddressOverride] = useState<string | undefined>(undefined)
  const [addressDraft, setAddressDraft] = useState("")
  const [addressBusy, setAddressBusy] = useState(false)
  const [editingAddress, setEditingAddress] = useState(false)
  const [invoiceOpen, setInvoiceOpen] = useState(false)
  const [ebmLoading, setEbmLoading] = useState(false)
  const [ebmStatus, setEbmStatus] = useState<
    "not_requested" | "pending" | "success" | "failed" | "retry" | "rejected"
  >("not_requested")
  const [ebmMessage, setEbmMessage] = useState<string | null>(null)
  const [ebmFiscal, setEbmFiscal] = useState<BuyerEbmFiscalInfo | null>(null)
  /** Opaque 5-char code for share links (from API). */
  const [publicToken, setPublicToken] = useState<string | null>(null)

  // Rating modal state
  const [showRatingModal, setShowRatingModal] = useState(false)
  const [ratingItems, setRatingItems] = useState<Array<{ code: string, name: string }>>([])
  const [hasCheckedRating, setHasCheckedRating] = useState(false)

  // ✅ NEW: Use order tracking hook for real-time status monitoring
  const { 
    currentStatus, 
    isMonitoring, 
    startMonitoring, 
    isDelivered 
  } = useOrderTracking({
    orderId: order?.orderId != null ? String(order.orderId) : orderId,
    initialStatus: order?.status,
    autoStart: true,
  })

  // Use the tracking hook values to show monitoring status (optional)
  console.log(`[TrackOrder] Monitoring: ${isMonitoring}, Status: ${currentStatus}, Delivered: ${isDelivered}`)

  // Function to check if rating should be shown
  const checkIfShouldShowRating = async (orderIdToCheck: string) => {
    try {
      // Use the proper shouldShowPopup API
      const response = await fetch(`/api/ratings?action=shouldShowPopup&orderId=${orderIdToCheck}`, {
        cache: "no-store"
      })
      
      if (response.ok) {
        const data = await response.json()
        console.log('[TrackOrder] Should show popup response:', data)
        
        if (data.ok && data.shouldShow) {
          // Use the items from the API response
          const items = data.orderDetails?.items || []
          setRatingItems(items)
          setShowRatingModal(true)
          console.log('[TrackOrder] Showing rating modal for delivered order')
        } else {
          console.log('[TrackOrder] Not showing popup:', data.reason)
        }
      }
    } catch (error) {
      console.error('[TrackOrder] Error checking rating status:', error)
    }
  }

  const stableOrderKey = useMemo(
    () => (order?.orderId != null ? String(order.orderId) : orderId),
    [order?.orderId, orderId],
  )

  // ✅ NEW: Watch for status changes and trigger rating popup
  useEffect(() => {
    // This effect will trigger rating popup when order becomes delivered
    if (order?.status === "delivered" && !showRatingModal && !hasCheckedRating && order?.orderId != null) {
      setHasCheckedRating(true)
      checkIfShouldShowRating(String(order.orderId))
    }
  }, [order?.status, order?.orderId, showRatingModal, hasCheckedRating])

  useEffect(() => {
    if (!stableOrderKey || typeof window === "undefined") return
    try {
      const raw = window.localStorage.getItem(`${PAYMENT_ACK_STORAGE_PREFIX}${stableOrderKey}`)
      if (raw === "received" || raw === "not_received") setBuyerPaymentAck(raw)
    } catch {
      /* ignore */
    }
  }, [stableOrderKey])

  useEffect(() => {
    if (!stableOrderKey || typeof window === "undefined") return
    try {
      const raw = window.localStorage.getItem(`${BUYER_ADDRESS_STORAGE_PREFIX}${stableOrderKey}`)
      if (raw === null) setBuyerAddressOverride(undefined)
      else setBuyerAddressOverride(raw)
    } catch {
      setBuyerAddressOverride(undefined)
    }
  }, [stableOrderKey])

  const loadOrderFromServer = useCallback(async () => {
    if (!orderId) return
    const res = await fetch("/api/orders/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }),
      cache: "no-store",
    })
    const json = (await res.json()) as {
      ok?: boolean
      order?: OrderDetail
      publicToken?: string
      error?: string
    }
    if (!res.ok || !json?.ok) {
      throw new Error(json?.error || "Failed to load order")
    }
    console.log("[Track Order] Order data received:", json.order)
    setOrder(json.order ?? null)
    setPublicToken(typeof json.publicToken === "string" ? json.publicToken : null)
  }, [orderId])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        await loadOrderFromServer()
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load order")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [orderId, loadOrderFromServer])

  const loadEbmStatus = useCallback(async (numericOrderId: number) => {
    try {
      const res = await fetch(`/api/orders/ebm-request?orderId=${numericOrderId}`, { cache: "no-store" })
      const data = (await res.json()) as {
        ok?: boolean
        ebmStatus?: string
        message?: string
        fiscal?: BuyerEbmFiscalInfo
      }
      if (data.ok && data.ebmStatus) {
        const st = data.ebmStatus as typeof ebmStatus
        if (["not_requested", "pending", "success", "failed", "retry", "rejected"].includes(st)) {
          setEbmStatus(st)
        }
        if (data.message) setEbmMessage(data.message)
        setEbmFiscal(data.fiscal ?? null)
      }
    } catch {
      /* non-blocking */
    }
  }, [])

  useEffect(() => {
    const id = Number(order?.orderId ?? orderId)
    if (!Number.isFinite(id) || id < 1) return
    if (!canShowInvoiceActions(order?.ORDER_STATUS)) return
    void loadEbmStatus(id)
  }, [order?.orderId, order?.ORDER_STATUS, orderId, loadEbmStatus])

  const requestEbmFromBuyer = async () => {
    const id = Number(order?.orderId ?? orderId)
    if (!Number.isFinite(id) || id < 1) return
    setEbmLoading(true)
    setEbmMessage(null)
    try {
      const res = await fetch("/api/orders/ebm-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: id }),
      })
      const data = (await res.json()) as {
        ok?: boolean
        error?: string
        message?: string
        ebmStatus?: string
        alreadyFiscalized?: boolean
        awaitingApproval?: boolean
      }
      if (!res.ok || !data.ok) {
        setEbmMessage(data.error || "Could not request EBM invoice")
        return
      }
      const st = (data.ebmStatus || "pending") as typeof ebmStatus
      if (["pending", "success", "failed", "retry", "rejected"].includes(st)) setEbmStatus(st)
      if (data.alreadyFiscalized) {
        void loadEbmStatus(id)
      }
      setEbmMessage(
        data.message ||
          (data.alreadyFiscalized
            ? "Invoice already fiscalized"
            : "Seller notified — they will approve your EBM invoice"),
      )
    } catch (e: unknown) {
      setEbmMessage(e instanceof Error ? e.message : "EBM request failed")
    } finally {
      setEbmLoading(false)
    }
  }

  // Sync currentStatus from useOrderTracking to order state
  useEffect(() => {
    if (currentStatus && order && currentStatus !== order.status) {
      console.log(`[TrackOrder] Status changed from ${order.status} to ${currentStatus}, updating UI`)
      setOrder(prev => prev ? { ...prev, status: currentStatus as OrderStatus } : null)
    }
  }, [currentStatus, order?.status])

  // Handle rating modal dismiss
  async function handleRatingDismiss() {
    setShowRatingModal(false)

    const numericOrderId =
      order?.orderId != null ? parseInt(String(order.orderId), 10) : parseInt(/^\d+$/.test(orderId) ? orderId : "0", 10)
    if (Number.isNaN(numericOrderId) || numericOrderId <= 0) return

    // Track attempt (optional - don't break if it fails)
    try {
      const res = await fetch("/api/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "trackAttempt",
          orderId: numericOrderId,
        }),
      })

      const data = await res.json()
      console.log("[Rating] Attempt tracked:", data)

      if (data.ok) {
        const nextAttempts = data.attempts || 0

        // Schedule next popup if not max attempts
        if (nextAttempts < 3) {
          const waitMs = data.nextWaitMinutes * 60 * 1000
          console.log(`[Rating] Will show again in ${data.nextWaitMinutes} minutes`)

          setTimeout(() => {
            setHasCheckedRating(false) // Allow checking again
            if (order?.orderId != null) checkIfShouldShowRating(String(order.orderId))
          }, waitMs)
        }
      } else {
        console.warn("[Rating] Attempt tracking failed, using fallback timing")
        // Fallback: show again in 2 minutes if tracking fails
        setTimeout(() => {
          setHasCheckedRating(false)
          if (order?.orderId != null) checkIfShouldShowRating(String(order.orderId))
        }, 2 * 60 * 1000)
      }
    } catch (error) {
      console.error("[Rating] Track attempt error:", error)
      // Fallback: show again in 2 minutes if tracking fails
      setTimeout(() => {
        setHasCheckedRating(false)
        if (order?.orderId != null) checkIfShouldShowRating(String(order.orderId))
      }, 2 * 60 * 1000)
    }
  }

  // Handle successful rating submission
  function handleRatingSuccess() {
    console.log("[Rating] Rating submitted successfully")
    setShowRatingModal(false)
    // No need to show again since rating was successful
  }

  const displayBuyerLocationForInvoice =
    buyerAddressOverride !== undefined ? buyerAddressOverride : (order?.buyerLocation ?? "")

  const taxInvoiceViewModel = useMemo(() => {
    if (!order) return null
    const { displayTotal } = orderFinancials(order)
    const orderInput: TaxInvoiceOrderInput = {
      orderId: String(order.orderId),
      sellerName: order.sellerName,
      sellerPhone: order.sellerPhone,
      sellerAccount: order.sellerAccount,
      buyerName: order.buyerName,
      buyerPhone: order.buyerPhone,
      buyerLocation: displayBuyerLocationForInvoice,
      buyerEmail: order.BUYER_EMAIL,
      createdAt: order.createdAt,
      total: displayTotal,
      items: order.items.map((item) => ({
        name: item.name,
        qty: item.qty,
        unitPrice: item.unitPrice,
        ITEM_CODE: (item as { ITEM_CODE?: string }).ITEM_CODE,
      })),
      SELLER_TIN: order.SELLER_TIN,
      BUYER_TIN: order.BUYER_TIN,
      SELLER_EMAIL: order.SELLER_EMAIL,
      BUYER_EMAIL: order.BUYER_EMAIL,
      SELLER_ADDRESS: order.SELLER_ADDRESS,
      CURRENCY: order.CURRENCY,
    }
    return buildTaxInvoiceViewModel({ order: orderInput, fiscal: ebmFiscal })
  }, [order, displayBuyerLocationForInvoice, ebmFiscal])

  const downloadInvoice = useCallback(async () => {
    if (!taxInvoiceViewModel) return
    await downloadTaxInvoicePdf(taxInvoiceViewModel, `invoice-order-${String(order?.orderId ?? orderId)}.pdf`)
  }, [taxInvoiceViewModel, order?.orderId, orderId])

  if (loading) {
    return (
      <div className={trackShell}>
        <header className="sticky top-0 z-40 border-b border-white/15 bg-gradient-to-r from-[#0369a1] to-[#0ea5e9] shadow-md">
          <div className="mx-auto flex max-w-[430px] items-center gap-3 px-4 py-3">
            <Link
              href={homeHref}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-white/15 px-2 py-1.5 text-sm font-semibold text-white hover:bg-white/25"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
            <span className="text-sm font-bold text-white/90">Tracking…</span>
          </div>
        </header>
        <main className="mx-auto max-w-[430px] px-4 py-8">
          <Card className="border-0 bg-white text-slate-900 shadow-xl">
            <CardHeader>
              <CardTitle>Loading order…</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">Please wait.</CardContent>
          </Card>
        </main>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className={trackShell}>
        <header className="sticky top-0 z-40 border-b border-white/15 bg-gradient-to-r from-[#0369a1] to-[#0ea5e9] shadow-md">
          <div className="mx-auto flex max-w-[430px] items-center gap-3 px-4 py-3">
            <Link
              href={homeHref}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-white/15 px-2 py-1.5 text-sm font-semibold text-white hover:bg-white/25"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-[430px] px-4 py-8">
          <Card className="border-0 bg-white text-slate-900 shadow-xl">
            <CardHeader>
              <CardTitle>Order not found</CardTitle>
              <CardDescription className="text-destructive">
                {error || "We couldn't find an order with this ID."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="secondary" onClick={() => router.push(homeHref)}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                {fromGrandma ? "Back to Grandma" : "Back to Home"}
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  const steps = buildTracking(order.status)
  const sellerPhoneNormalized = normalizePhone(order.sellerPhone)
  const canShowInvoice = canShowInvoiceActions(order.ORDER_STATUS)
  const displayBuyerLocation =
    buyerAddressOverride !== undefined ? buyerAddressOverride : (order.buyerLocation ?? "")
  const canEditDeliveryAddress = order.status !== "delivered" && order.status !== "cancelled"

  const { logisticsFeeValue, subtotalValue, displayTotal, discountValue } = orderFinancials(order)

  const isPaid =
    !isCashOnDelivery(order.paymentMethod) &&
    (String(order.paymentStatus ?? "").toLowerCase().includes("paid") ||
      order.paymentMethod.toUpperCase().includes("PAID_"))
  const paidAmount = isPaid ? displayTotal : 0

  const shareTrackSlug = publicToken || orderId
  const internalOrderNo = String(order.orderId ?? orderId)
  const publicShopBase = (process.env.NEXT_PUBLIC_SHOP_URL || process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_API_URL || "https://shop.ihute.rw").replace(/\/$/, "")
  const trackLink = `${publicShopBase}/track-order/${encodeURIComponent(shareTrackSlug)}${fromGrandma ? "?from=grandma" : ""}`

  const whatsappMessage = buildOrderWhatsAppMessageFromViewModel(
    buildOrderReceiptViewModel({
      shop: order.sellerName,
      location:
        displayBuyerLocation ||
        (order.TABLE_NAME ? `Table: ${order.TABLE_NAME}` : undefined),
      orderId: internalOrderNo,
      defaultOrderedBy: (order.buyerName ?? "").trim() || undefined,
      items: order.items.map((item) => ({
        name: item.name,
        qty: item.qty,
        unitPrice: item.unitPrice,
        orderedBy: resolveTableCommandLinePerson(
          item.orderedBy ?? item.ORDERED_BY,
          order.buyerName,
        ),
        lineId: item.lineId ?? item.ID_LIST,
        lineCreatedAt:
          item.lineCreatedAt ?? item.HEURE ?? item.heure ?? order.createdAt,
      })),
      subtotal: subtotalValue,
      total: displayTotal,
      discount: discountValue,
      paid: paidAmount,
      paidAt: formatPaymentMethod(order.paymentMethod),
      reference: internalOrderNo ? `ORDER ${internalOrderNo}` : undefined,
      myPhone: order.buyerPhone,
      link: trackLink,
      isTableCommand: isTableCommandOrder({
        IS_TABLE_COMMAND: order.IS_TABLE_COMMAND,
        TABLE_NAME: order.TABLE_NAME,
        buyerLocation: displayBuyerLocation,
      }),
      logisticsFee: logisticsFeeValue,
    }),
  )

  const whatsappHref = sellerPhoneNormalized ? waHrefFor(sellerPhoneNormalized, whatsappMessage) : ""

  return (
    <div className={trackShell}>
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
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/80">Live tracking</div>
            <div className="truncate text-lg font-bold leading-tight">Order #{internalOrderNo}</div>
          </div>
          <div className="flex shrink-0 items-center gap-2 text-slate-900">
            <span className="rounded-full bg-white px-2 py-1 shadow-sm">{statusIcon(order.status)}</span>
            <span className="hidden sm:inline">{statusBadge(order.status)}</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[430px] space-y-4 px-4 py-4 pb-12">
        <div className="space-y-4">
          {/* Header row (duplicate badge on small screens) */}
          <div className="flex items-center justify-between rounded-2xl bg-white/10 px-3 py-2 sm:hidden">
            {statusBadge(order.status)}
          </div>

          {/* Order Details */}
          <Card className="border-0 shadow-xl rounded-2xl bg-white text-slate-900">
            <CardHeader>
              <CardTitle>Order details</CardTitle>
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
                    {orderStatusBadge(order)}
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

              {/* Payment Status — tap when pending to say if you paid (helps seller / your records) */}
              {order.paymentStatus && (
                <div className="border-t pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-muted-foreground">Payment status</p>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {order.sellerPaymentAck === "paid" && isPaymentPendingLike(order.paymentStatus) ? (
                        <Badge className="bg-green-600 hover:bg-green-600">Seller confirmed receipt</Badge>
                      ) : null}
                      {isPaymentPendingLike(order.paymentStatus) ? (
                        <button
                          type="button"
                          className="rounded-full outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-sky-500"
                          onClick={() => setPaymentAckOpen(true)}
                        >
                          {paymentStatusBadge(order.paymentStatus)}
                          <span className="sr-only">Open payment confirmation</span>
                        </button>
                      ) : (
                        paymentStatusBadge(order.paymentStatus)
                      )}
                    </div>
                  </div>
                  {order.sellerPaymentAck === "paid" && isPaymentPendingLike(order.paymentStatus) ? (
                    <p className="mt-2 rounded-lg border border-green-200 bg-green-50 p-2 text-sm text-green-900">
                      The seller marked your payment as received on their side. The gateway can still show Pending until
                      MoMo or your bank confirms.
                    </p>
                  ) : null}
                  {buyerPaymentAck ? (
                    <p className="mt-2 text-xs text-slate-600">
                      Your note:{" "}
                      <span className="font-semibold text-slate-800">
                        {buyerPaymentAck === "received"
                          ? "I completed payment to the seller"
                          : "Payment not completed yet on my side"}
                      </span>{" "}
                      (saved on this device — tell the seller on WhatsApp too if needed)
                    </p>
                  ) : isPaymentPendingLike(order.paymentStatus) ? (
                    <p className="mt-2 text-xs text-slate-500">Tap Pending to say if you paid.</p>
                  ) : null}
                </div>
              )}

              {(displayBuyerLocation.trim() || canEditDeliveryAddress) && (
                <div className="border-t pt-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-slate-800">Buyer delivery address</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Where this order should be delivered — not the shop&apos;s address. Saving updates the server so
                        your seller sees this line on the order.
                      </p>
                    </div>
                    {canEditDeliveryAddress && !editingAddress ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0 border-sky-200 text-[#0369a1]"
                        onClick={() => {
                          setAddressDraft(displayBuyerLocation.trim())
                          setEditingAddress(true)
                        }}
                      >
                        Edit
                      </Button>
                    ) : null}
                  </div>
                  {canEditDeliveryAddress && editingAddress ? (
                    <div className="mt-3 space-y-3">
                      <Textarea
                        id="track-buyer-address-inline"
                        rows={4}
                        value={addressDraft}
                        onChange={(e) => setAddressDraft(e.target.value)}
                        className="resize-y min-h-[100px] border-slate-200"
                        placeholder="Street, cell, landmark, phone for delivery…"
                        disabled={addressBusy}
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          disabled={addressBusy}
                          className="bg-[#0369a1] text-white hover:bg-[#025a8a]"
                          onClick={() => {
                            void (async () => {
                              const t = addressDraft.trim()
                              setAddressBusy(true)
                              try {
                                const res = await fetch("/api/orders/client-meta", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ orderId: stableOrderKey, buyerDeliveryAddress: t }),
                                })
                                const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
                                if (!res.ok || !json?.ok) {
                                  throw new Error(json?.error || "Could not save address")
                                }
                                try {
                                  if (typeof window !== "undefined") {
                                    window.localStorage.setItem(`${BUYER_ADDRESS_STORAGE_PREFIX}${stableOrderKey}`, t)
                                  }
                                } catch {
                                  /* ignore */
                                }
                                setBuyerAddressOverride(undefined)
                                await loadOrderFromServer()
                                setEditingAddress(false)
                              } catch (e: unknown) {
                                window.alert(e instanceof Error ? e.message : "Could not save address")
                              } finally {
                                setAddressBusy(false)
                              }
                            })()
                          }}
                        >
                          {addressBusy ? "Saving…" : "Save address"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={addressBusy}
                          onClick={() => {
                            setEditingAddress(false)
                            setAddressDraft(displayBuyerLocation.trim())
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          className="text-muted-foreground"
                          disabled={addressBusy}
                          onClick={() => {
                            void (async () => {
                              setAddressBusy(true)
                              try {
                                const res = await fetch("/api/orders/client-meta", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ orderId: stableOrderKey, buyerDeliveryAddress: null }),
                                })
                                const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
                                if (!res.ok || !json?.ok) {
                                  throw new Error(json?.error || "Could not reset address")
                                }
                                try {
                                  if (typeof window !== "undefined") {
                                    window.localStorage.removeItem(`${BUYER_ADDRESS_STORAGE_PREFIX}${stableOrderKey}`)
                                  }
                                } catch {
                                  /* ignore */
                                }
                                setBuyerAddressOverride(undefined)
                                await loadOrderFromServer()
                                setEditingAddress(false)
                              } catch (e: unknown) {
                                window.alert(e instanceof Error ? e.message : "Could not reset address")
                              } finally {
                                setAddressBusy(false)
                              }
                            })()
                          }}
                        >
                          Use original from order
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="font-medium mt-2">
                        {displayBuyerLocation.trim() ? displayBuyerLocation : "— (add before delivery)"}
                      </p>
                      {canEditDeliveryAddress ? (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Tap Edit to change the address. The seller refreshes from the same server data.
                        </p>
                      ) : null}
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Estimated delivery countdown */}
          {order.estimatedDeliveryAt && order.status !== "delivered" && order.status !== "cancelled" && (
            <Card className="border-0 shadow-xl rounded-2xl bg-white text-slate-900">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  Estimated delivery
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DeliveryCountdown
                  estimatedAt={order.estimatedDeliveryAt}
                  status={order.status}
                />
              </CardContent>
            </Card>
          )}

          {canShowInvoice && (
            <Card className="border-0 shadow-xl rounded-2xl border-indigo-100 bg-white text-slate-900">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-indigo-600" />
                  Invoice
                </CardTitle>
                <CardDescription>
                  Your order reached invoice stage ({order.ORDER_STATUS || "INVOICE"}). You can view or download it.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-nowrap items-center gap-1.5 overflow-x-auto pb-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setInvoiceOpen(true)}
                  className="h-7 shrink-0 px-2 text-[11px]"
                >
                  <Eye className="h-3 w-3 mr-1" />
                  View
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void downloadInvoice()}
                  className="h-7 shrink-0 px-2 text-[11px] bg-indigo-600 hover:bg-indigo-700"
                >
                  <Download className="h-3 w-3 mr-1" />
                  Download
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={ebmLoading || ebmStatus === "success" || ebmStatus === "pending"}
                  onClick={() => void requestEbmFromBuyer()}
                  className="h-7 shrink-0 px-2 text-[11px] bg-green-600 hover:bg-green-700 text-white disabled:opacity-60"
                >
                  {ebmLoading ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <FileText className="h-3 w-3 mr-1" />
                  )}
                  {ebmStatus === "success" ? "EBM OK" : "Request EBM"}
                </Button>
              </CardContent>
              {ebmMessage ? (
                <p className="px-6 pb-4 text-sm text-green-800 bg-green-50 border-t border-green-100">
                  {ebmMessage}
                </p>
              ) : ebmStatus === "pending" ? (
                <p className="px-6 pb-4 text-sm text-amber-800 bg-amber-50 border-t border-amber-100">
                  Awaiting seller approval for RRA EBM fiscal invoice.
                </p>
              ) : ebmStatus === "rejected" ? (
                <p className="px-6 pb-4 text-sm text-red-800 bg-red-50 border-t border-red-100">
                  Seller rejected this EBM request. You can tap Request EBM again if needed.
                </p>
              ) : null}
            </Card>
          )}

          {/* Driver contact (when in transit) */}
          {(order.status === "in-transit" && (order.driverPhone || order.sellerPhone)) && (
            <Card className="border-0 shadow-xl rounded-2xl border-blue-100 bg-white text-slate-900">
              <CardHeader>
                <CardTitle>Delivery contact</CardTitle>
                <CardDescription>
                  {order.driverPhone
                    ? "Contact the driver for delivery updates."
                    : "Contact the seller for delivery updates."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="font-mono text-lg">
                  {order.driverPhone || order.sellerPhone}
                </p>
                {(order.driverPhone || order.sellerPhone) && (
                  <Button className="mt-2" variant="outline" asChild>
                    <a href={`tel:${(order.driverPhone || order.sellerPhone || "").replace(/\s/g, "")}`}>
                      Call
                    </a>
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Tracking Timeline */}
          <Card className="border-0 shadow-xl rounded-2xl bg-white text-slate-900">
            <CardHeader>
              <CardTitle>Order progress</CardTitle>
              <CardDescription>Status updates when the shop confirms, prepares, or completes your order</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <div className="space-y-4">
                  {steps.map((step, index) => {
                    const failed = "failed" in step && step.failed
                    return (
                    <div key={index} className="flex items-start gap-3">
                      <div className="relative">
                        <div
                          className={`h-10 w-10 rounded-full flex items-center justify-center transition-colors ${
                            failed
                              ? "bg-red-600 ring-4 ring-red-100"
                              : step.completed
                                ? "bg-[#0ea5e9] ring-4 ring-sky-100"
                                : step.isCurrent
                                  ? "bg-[#0284c7] ring-4 ring-sky-100"
                                  : "bg-slate-200"
                          }`}
                        >
                          {failed ? (
                            <XCircle className="h-6 w-6 text-white" />
                          ) : step.completed ? (
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
                              failed || step.completed ? "bg-[#38bdf8]" : "bg-slate-200"
                            }`}
                          />
                        )}
                      </div>
                      <div className="flex-1 pt-2">
                        <p
                          className={`font-medium ${
                            failed
                              ? "text-red-700"
                              : step.completed
                                ? "text-slate-900"
                                : step.isCurrent
                                  ? "text-[#0369a1] font-semibold"
                                  : "text-slate-500"
                          }`}
                        >
                          {step.label}
                          {step.isCurrent && !failed && (
                            <span className="ml-2 text-xs font-normal text-[#0369a1]">(current)</span>
                          )}
                          {failed && (
                            <span className="ml-2 text-xs font-normal text-red-600">(current)</span>
                          )}
                        </p>
                        {step.subtitle ? (
                          <p
                            className={`mt-1 text-sm font-medium ${
                              failed ? "text-red-600" : "text-[#0369a1]"
                            }`}
                          >
                            {step.subtitle}
                          </p>
                        ) : null}
                        {step.completed && step.date ? (
                          <p className="text-sm text-slate-500">{step.date}</p>
                        ) : null}
                      </div>
                    </div>
                    )
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Items */}
          <Card className="border-0 shadow-xl rounded-2xl bg-white text-slate-900">
            <CardHeader>
              <CardTitle>Order items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {order.items.map((item, index) => (
                  <div key={index} className="flex justify-between items-center pb-3 border-b last:border-0">
                    <div className="flex-1">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.qty} × {item.unitPrice.toLocaleString()} RWF
                        {unitMeaningfulForDisplay(item.unit) ? ` (${item.unit})` : ""}
                      </p>
                    </div>
                    <p className="font-bold">{(item.qty * item.unitPrice).toLocaleString()} RWF</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t">
                <div className="flex justify-between items-center">
                  <p className="text-lg font-bold">Total</p>
                  <p className="text-lg font-bold">{displayTotal.toLocaleString()} RWF</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contact Seller */}
          {sellerPhoneNormalized && order.status !== "cancelled" && (
            <Card className="border-0 shadow-xl rounded-2xl border-2 border-green-100 bg-white text-slate-900">
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
          <div className="flex gap-3 pt-2">
            <Button
              variant="secondary"
              className="flex-1 bg-white text-slate-900 hover:bg-white/90"
              onClick={() => router.push(homeHref)}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {fromGrandma ? "Back to Grandma" : "Home"}
            </Button>
            <Button
              className="flex-1 bg-white text-[#0369a1] hover:bg-white/90"
              variant="outline"
              onClick={() => window.location.reload()}
            >
              Refresh status
            </Button>
          </div>
        </div>
      </main>

      <Dialog open={paymentAckOpen} onOpenChange={setPaymentAckOpen}>
        <DialogContent className="max-w-[min(100vw,400px)] border-0 bg-white text-slate-900 sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle>Did you pay the seller?</DialogTitle>
            <DialogDescription>
              Tap one option. This is saved on <strong>this device only</strong> so you can keep track. The shop still
              sees the real payment status from MoMo/bank — message them on WhatsApp if you need to confirm.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              type="button"
              className="w-full bg-green-600 text-white hover:bg-green-700"
              onClick={() => {
                try {
                  if (typeof window !== "undefined") {
                    window.localStorage.setItem(`${PAYMENT_ACK_STORAGE_PREFIX}${stableOrderKey}`, "received")
                  }
                } catch {
                  /* ignore */
                }
                setBuyerPaymentAck("received")
                setPaymentAckOpen(false)
              }}
            >
              I paid (completed on my side)
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                try {
                  if (typeof window !== "undefined") {
                    window.localStorage.setItem(`${PAYMENT_ACK_STORAGE_PREFIX}${stableOrderKey}`, "not_received")
                  }
                } catch {
                  /* ignore */
                }
                setBuyerPaymentAck("not_received")
                setPaymentAckOpen(false)
              }}
            >
              Not yet / still pending
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={invoiceOpen} onOpenChange={setInvoiceOpen}>
        <DialogContent className="max-w-[min(100vw,820px)] border-0 bg-white text-slate-900 sm:rounded-2xl print:max-w-none">
          <DialogTitle className="sr-only">Invoice</DialogTitle>
          <div className="max-h-[70vh] overflow-auto rounded-lg border border-slate-200 bg-white p-2 print:max-h-none print:overflow-visible print:border-0">
            {taxInvoiceViewModel ? <TaxInvoice invoice={taxInvoiceViewModel} /> : null}
          </div>
          <DialogFooter className="print:hidden">
            <Button type="button" variant="outline" onClick={() => setInvoiceOpen(false)}>
              Close
            </Button>
            <Button type="button" onClick={() => void downloadInvoice()} className="bg-indigo-600 hover:bg-indigo-700">
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {taxInvoiceViewModel?.sdc.showQr ? (
        <div className="fixed -left-[9999px] top-0 opacity-0 pointer-events-none" aria-hidden>
          <InvoiceQRCode value={taxInvoiceViewModel.sdc.qrContent} show />
        </div>
      ) : null}
      
      {/* Rating Modal */}
      {order && showRatingModal && (
        <RatingModal
          orderId={String(order.orderId)}
          sellerId={sellerAccountFromOrder(order as Record<string, unknown>)}
          sellerName={order.sellerName}
          buyerPhone={order.buyerPhone || ""}
          items={ratingItems}
          open={showRatingModal}
          onClose={handleRatingDismiss}
          onSuccess={handleRatingSuccess}
        />
      )}
    </div>
  )
}

export default function TrackOrderPage() {
  return (
    <Suspense
      fallback={
        <div className={trackShell}>
          <div className="mx-auto max-w-[430px] px-4 py-16 text-center text-sm font-medium text-white/90">
            Loading tracking…
          </div>
        </div>
      }
    >
      <TrackOrderPageInner />
    </Suspense>
  )
}