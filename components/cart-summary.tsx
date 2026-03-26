// app/(wherever)/CartSummary.tsx
"use client"

import dynamic from "next/dynamic"
import { useMemo, useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/lib/auth-store"
import { useCartStore } from "@/lib/cart-store"
import { trackClick } from "@/lib/interaction-tracker"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { formatPaymentMethod } from "@/lib/payment-utils"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog"
import { Copy, PhoneCall, CheckCircle2, RotateCcw, MessageCircle, Truck, CreditCard, Wallet, Beer, Users, Lock, Tag, MapPin } from "lucide-react"
import { isBarOrRestaurant } from "@/lib/constants"
import { useTableCommandStore } from "@/lib/table-command-store"
import { getSavedAddresses, saveAddress, type SavedAddress } from "@/lib/saved-addresses"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { TableCommandDialog } from "@/components/table-command-dialog"
import { TableCommandShareModal } from "@/components/table-command-share-modal"
import { CartSuggestionsPopup } from "@/components/cart-suggestions-popup"
import { displayUnitForPrice } from "@/lib/cart-display-utils"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

const QRCode = dynamic(() => import("react-qr-code"), { ssr: false })
const CUR = "RWF"
import { buildMoMoUssd } from "@/lib/momo-ussd"

// ---------- helpers ----------
function normalizePhone(raw?: string | null): string {
  let v = (raw || "").replace(/\s|-/g, "")
  if (!v) return ""
  if (v.startsWith("+250") || v.startsWith("+258")) return v
  if (v.startsWith("250")) return "+" + v
  if (v.startsWith("00250")) return "+250" + v.slice(5)
  if (/^0?7\d{8}$/.test(v)) return "+250" + v.replace(/^0/, "")
  return v.startsWith("+25") ? v : "+25" + v
}
function fmt(n: unknown): string {
  if (n == null || n === "") return ""
  const v = typeof n === "number" ? n : Number(String(n).replace(/[^\d.-]/g, ""))
  return isNaN(v) ? String(n) : v.toLocaleString("en")
}
function ensureCur(v: unknown): string {
  if (v == null || v === "") return ""
  const s = String(v)
  return /(RWF|Frw|RF)\b/i.test(s) ? s : `${fmt(s)} ${CUR}`
}
function stripTrailingPriceParen(name: string): string {
  return String(name).replace(/\s*\((?:\d[\d.,\s]*)(?:RWF|Frw|RF)\)\s*$/i, "").trim()
}
function formatPaidAt(v: unknown): string {
  if (v == null) return ""
  return formatPaymentMethod(String(v))
}
type WhatsItem = [name: string, qty: string | number, amount: string | number]
function buildWhatsAppMessageStyled(args: {
  shop?: string; location?: string; orderId?: string | number | null;
  items: WhatsItem[]; total: number; discount: number; paid: number;
  paidAt?: string; reference?: string; myPhone?: string; link?: string;
}) {
  const { shop, location, orderId, items, total, discount, paid, paidAt, reference, myPhone, link } = args
  const padRight = (s: string, w: number) => (s.length >= w ? s : s + " ".repeat(w - s.length))
  const padLeft  = (s: string, w: number) => (s.length >= w ? s : " ".repeat(w - s.length) + s)
  const trunc    = (s: string, w: number) => (s.length > w ? s.slice(0, w - 1) + "…" : s)
  const NAME_W = 44, QTY_W = 5, AMT_W = 14
  const header = padRight("Product name", NAME_W) + padLeft("Qty", QTY_W) + padLeft("Amount", AMT_W)
  const sep    = "-".repeat(NAME_W + QTY_W + AMT_W)
  const lines  = (items || []).map(([name, qty, amount]) => {
    const nm = padRight(trunc(String(name ?? "").replace(/\s+/g, " ").trim(), NAME_W), NAME_W)
    const qt = padLeft(String(qty ?? ""), QTY_W)
    const amt= padLeft(ensureCur(amount ?? ""), AMT_W)
    return nm + qt + amt
  })
  return [
    "Order", "", `Shop: ${shop ?? ""}`, `Location: ${location ?? ""}`,
    orderId ? `Order ID: ${orderId}` : "", "", "```", header, sep, ...lines, "```", "",
    `Total: ${ensureCur(total)}`, `Discount: ${ensureCur(discount)}`, `Paid: ${ensureCur(paid)}`, "",
    `Paid at: ${formatPaidAt(paidAt)}`, `Message: ${reference || "-"}`, `My phone: ${myPhone || ""}`, "",
    link ? `Follow: ${link}` : "",
  ].filter(Boolean).join("\n")
}
function waHrefFor(phone: string, text: string) {
  const p = phone.replace(/^\+/, "")
  const encoded = encodeURIComponent(text)
  return `https://wa.me/${p}?text=${encoded}`
}

// ---------- component ----------
export function CartSummary() {
  return <CartSummaryBody />
}

function CartSummaryBody() {
  const router = useRouter()
  const { isAuthenticated, user } = useAuthStore()
  const getGroupsBySeller = useCartStore((s) => s.getGroupsBySeller)
  const getGrandTotal    = useCartStore((s) => s.getGrandTotal)
  const clear            = useCartStore((s) => s.clear)
  const getPaymentStatus = useCartStore((s) => s.getPaymentStatus)
  const setPaymentStatus = useCartStore((s) => s.setPaymentStatus)
  // ✅ Get tableInfo from cart store
  const tableInfo = useCartStore((s) => s.tableInfo)

  const [busy, setBusy] = useState<string | null>(null)
  const [orderIds, setOrderIds] = useState<Record<string, string>>({})
  const [orderPhones, setOrderPhones] = useState<Record<string, string>>({})

  // Payment method selection dialog
  const [paymentMethodOpen, setPaymentMethodOpen] = useState(false)
  const [selectedSeller, setSelectedSeller] = useState<string | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<"momo" | "airtel" | "cod">("momo")

  // Anonymous checkout mode
  const [checkoutMode, setCheckoutMode] = useState<"login" | "anonymous">(isAuthenticated ? "login" : "anonymous")
  const [anonymousPhone, setAnonymousPhone] = useState("")
  const [anonymousName, setAnonymousName] = useState("")

  // Table command mode
  const { isInTableCommand, activeSession, lockTableCommand, canCloseTable, closeTableCommand, createTableCommand, updateTableShareData } = useTableCommandStore()

  // Do NOT pre-fill "Your Name" for table orders — table name is already shown in "Table Order - ... - Table X".
  // User must enter their own name so supplier sees who ordered (not the table name as buyer).

  // Pre-fill from tableInfo only when NOT a table order (e.g. delivery from shop-with-me)
  useEffect(() => {
    if (checkoutMode === "anonymous" && tableInfo && !isInTableCommand()) {
      if (tableInfo.customerName && !anonymousName) {
        setAnonymousName(tableInfo.customerName)
      }
      if (tableInfo.customerAddress && !deliveryLocation) {
        setDeliveryLocation(tableInfo.customerAddress)
      }
    }
  }, [checkoutMode, tableInfo, isInTableCommand])

  const [tableCommandDialogOpen, setTableCommandDialogOpen] = useState(false)
  const [tableCommandSeller, setTableCommandSeller] = useState<{ id: string; name: string } | null>(null)
  const [showCloseTableDialog, setShowCloseTableDialog] = useState(false)
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [shareModalData, setShareModalData] = useState<{
    tableName: string
    tableLocation: string
    shareableLink: string
    qrCodeUrl: string
    shareableToken: string
  } | null>(null)

  // MoMo payment dialog (MTN or Airtel)
  const [momoOpen, setMomoOpen] = useState(false)
  const [momoForSeller, setMomoForSeller] = useState<string | null>(null)
  const [momoPaymentProvider, setMomoPaymentProvider] = useState<"mtn" | "airtel">("mtn")
  // Fallback: fetch supplier MoMo from profile when cart items don't have it (e.g. Burrows has momo in account_signup)
  const [supplierMomoFallback, setSupplierMomoFallback] = useState<Record<string, string>>({})

  // Cart suggestions popup (before checkout). Skip popup for rest of session once user chose "No thanks" or "Continue to checkout"
  const [suggestionsPopupOpen, setSuggestionsPopupOpen] = useState(false)
  const [pendingCheckoutSupplierId, setPendingCheckoutSupplierId] = useState<string | null>(null)
  const skipSuggestionsSessionKey = "ihute_skip_cart_suggestions"
  const shouldSkipSuggestions = () => typeof window !== "undefined" && sessionStorage.getItem(skipSuggestionsSessionKey) === "1"

  // COD dialog
  const [codOpen, setCodOpen] = useState(false)
  const [codForSeller, setCodForSeller] = useState<string | null>(null)
  const [deliveryLocation, setDeliveryLocation] = useState(user?.location || "")
  const [contactPhone, setContactPhone] = useState(user?.phone || "")
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([])
  const [promoCode, setPromoCode] = useState("")
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; percent: number } | null>(null)
  const [promoError, setPromoError] = useState<string | null>(null)

  const groups = getGroupsBySeller()
  const grandTotal = Math.round(getGrandTotal())

  // Resolve MoMo for a group: from cart items first, then fallback from profile API
  const getMomoForGroup = (g: { supplierId: string; momo?: string | null }) =>
    (g.momo ?? "").trim() || (supplierMomoFallback[g.supplierId] ?? "").trim()

  // Fetch supplier profile (momo) when group has no momo so QR code can still show (e.g. PANGOLIN'S BURROWS)
  const requestedMomoRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    groups.forEach((g) => {
      const account = (g.supplierId ?? "").trim()
      if (!account || (g.momo ?? "").trim()) return
      if (requestedMomoRef.current.has(account)) return
      requestedMomoRef.current.add(account)
      fetch(`/api/account/profile?account=${encodeURIComponent(account)}`)
        .then((res) => res.json())
        .then((data) => {
          const momo = (data?.ok && data?.profile?.momo) ? String(data.profile.momo).trim() : ""
          if (momo) setSupplierMomoFallback((prev) => ({ ...prev, [account]: momo }))
        })
        .catch(() => {})
    })
  }, [groups])
  const discountPercent = appliedPromo?.percent ?? 0
  const discountAmount = Math.round((grandTotal * discountPercent) / 100)
  const totalAfterDiscount = grandTotal - discountAmount
  const myPhone = checkoutMode === "anonymous" ? anonymousPhone : (user?.phone || "")

  const applyPromo = async () => {
    const code = promoCode.trim().toUpperCase()
    setPromoError(null)
    if (!code) {
      setAppliedPromo(null)
      return
    }
    try {
      const res = await fetch(`/api/promo/validate?code=${encodeURIComponent(code)}`)
      const data = await res.json().catch(() => ({}))
      const valid = data?.valid === true
      const percent = typeof data?.percent === "number" ? data.percent : undefined
      if (valid && percent != null) {
        setAppliedPromo({ code, percent })
      } else {
        setAppliedPromo(null)
        setPromoError(data?.message || "Invalid or expired code")
      }
    } catch {
      setAppliedPromo(null)
      setPromoError("Could not validate code")
    }
  }

  useEffect(() => {
    if (codOpen) setSavedAddresses(getSavedAddresses())
  }, [codOpen])

  const requireLogin = () => {
    // If anonymous mode, don't require login
    if (checkoutMode === "anonymous") return true
    if (!isAuthenticated) { router.push("/login"); return false }
    return true
  }

  // MoMo payment auto-poll
  async function pollPayment(orderId: string, supplierId: string) {
    const deadline = Date.now() + 60_000
    while (Date.now() < deadline) {
      try {
        const r = await fetch("/api/orders/payment-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId }),
          cache: "no-store",
        })
        const j = await r.json()
        if (j?.ok && j.status === "paid") { setPaymentStatus(supplierId, "paid"); return }
        if (j?.ok && j.status === "failed") { setPaymentStatus(supplierId, "failed"); return }
      } catch {}
      await new Promise(res => setTimeout(res, 2000))
    }
  }

  // WhatsApp prefill per seller
  const sellerWhatsData = useMemo(() => {
    return groups.map((g) => {
      const chosenPhone = orderPhones[g.supplierId] || g.phone || getMomoForGroup(g) || ""
      const phone = normalizePhone(chosenPhone)
      const items: WhatsItem[] = g.items.map((it) => {
        const name = stripTrailingPriceParen(it.name || "Product")
        const qty = it.qty
        const amount = Math.round((it.price || 0) * (it.qty || 0))
        return [name, qty, amount]
      })
      const orderId = orderIds[g.supplierId]
      const hasUssdTarget = Boolean(getMomoForGroup(g))
      const isPaid = getPaymentStatus(g.supplierId) === "paid"
      const message = buildWhatsAppMessageStyled({
        shop: g.supplierName,
        location: g.supplierLocation,
        orderId,
        items,
        total: g.subtotal,
        discount: 0,
        paid: isPaid ? g.subtotal : 0,
        paidAt: isPaid ? "MTN MoMo" : (hasUssdTarget ? "Pending (MoMo)" : "Pay on delivery"),
        reference: orderId ? `ORDER ${orderId}` : undefined,
        myPhone,
        link: orderId ? `${(process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_API_URL || "https://ihute.rw").replace(/\/Trading\/?$/, "")}/orders/${orderId}` : undefined,
      })
      const href = phone ? waHrefFor(phone, message) : ""
      return { supplierId: g.supplierId, phone, message, href }
    })
  }, [groups, orderIds, orderPhones, myPhone, getPaymentStatus])

  if (groups.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">Your cart is empty.</CardContent>
      </Card>
    )
  }

  // Open payment method selection
  const openPaymentMethod = (supplierId: string) => {
    if (!requireLogin()) return
    const g = groups.find(x => x.supplierId === supplierId)
    if (!g) return

    // Bar/resto: from name/location keywords OR from shop-with-me — always show create/join table option (whether already in a table or not)
    const isBar =
      g.isBarResto === true ||
      isBarOrRestaurant(g.supplierName) ||
      isBarOrRestaurant(g.supplierLocation || "")

    if (isBar) {
      setTableCommandSeller({ id: supplierId, name: g.supplierName })
      setTableCommandDialogOpen(true)
      return
    }

    // Otherwise proceed with regular checkout
    const hasUssdTarget = Boolean(getMomoForGroup(g))
    setSelectedSeller(supplierId)
    // Default to momo if available, otherwise cod
    setPaymentMethod(hasUssdTarget ? "momo" : "cod")
    setPaymentMethodOpen(true)
  }

  // Handle payment method selection
  const proceedWithPayment = async () => {
    if (!selectedSeller) return

    // If user selected "login" mode, redirect to login
    if (checkoutMode === "login" && !isAuthenticated) {
      router.push("/login")
      return
    }

    // Validate anonymous user info
    if (checkoutMode === "anonymous") {
      if (!anonymousName.trim() || !anonymousPhone.trim()) {
        alert("Please fill in your name and phone number")
        return
      }
    }

    if (paymentMethod === "cod") {
      setPaymentMethodOpen(false)
      setCodForSeller(selectedSeller)
      setDeliveryLocation(checkoutMode === "anonymous" ? (tableInfo?.customerAddress || "") : user?.location || "")
      setContactPhone(checkoutMode === "anonymous" ? anonymousPhone : user?.phone || "")
      setCodOpen(true)
      setSelectedSeller(null)
    } else {
      setPaymentMethodOpen(false)
      setMomoForSeller(selectedSeller)
      setMomoPaymentProvider(paymentMethod === "airtel" ? "airtel" : "mtn")
      setMomoOpen(true)
      setSelectedSeller(null)
    }
  }

  // Unified order creator for MoMo & COD
  const placeOrder = async (
    g: ReturnType<typeof getGroupsBySeller>[number],
    opts: {
      paymentName: "PAID_MTN_MOMO" | "PAID_AIRTEL_MOMO" | "PAY_ON_DELIVERY";
      buyerPhone?: string;
      buyerLocation?: string;
      reference?: string;
      paymentId?: string;
    }
  ) => {
    if (!requireLogin()) return
    try {
      setBusy(g.supplierId)
      setPaymentStatus(g.supplierId, "pending")

      const items = g.items.map(it => ({
        name: it.name,
        qty: it.qty,
        unitPrice: it.price,
        unit: it.unit ?? "",
        itemCode: it.itemCode ?? it.id,
      }))

      const paymentId = opts.paymentId || `${opts.paymentName}_${Date.now()}`

      console.log("[cart/order] Placing order:", {
        paymentName: opts.paymentName,
        paymentId,
        supplierId: g.supplierId,
        sellerName: g.supplierName,
        items: items.map((it) => ({ name: it.name, qty: it.qty, NIKI_CODE: it.itemCode, unitPrice: it.unitPrice })),
      })

      // Buyer name: for table orders use user-entered name only (so "Ordered By" shows person, not table name)
      const isOrderingFromOwnShop = Boolean(user?.ishyigaAccount && g.supplierId && user.ishyigaAccount === g.supplierId);
      const resolvedBuyerName = isInTableCommand()
        ? (checkoutMode === "anonymous" ? (anonymousName?.trim() || "Guest") : (user?.name || "Guest"))
        : (tableInfo?.customerName && String(tableInfo.customerName).trim()) ||
          (checkoutMode === "anonymous" ? anonymousName : null) ||
          (isOrderingFromOwnShop ? (tableInfo?.customerName || anonymousName || "Guest") : user?.name) ||
          anonymousName ||
          user?.name ||
          "Guest";

      const res = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyerEmail: checkoutMode === "anonymous" ? `guest_${Date.now()}@ihute.rw` : user?.email,
          buyerPhone: opts.buyerPhone || (checkoutMode === "anonymous" ? anonymousPhone : user?.phone || ""),
          buyerLocation: opts.buyerLocation || (checkoutMode === "anonymous" ? deliveryLocation : user?.location || "NA"),
          buyerName: String(resolvedBuyerName || "").trim() || "Guest",
          sellerAccount: g.supplierId,
          sellerName: g.supplierName,
          sellerPhone: g.phone || "",
          paymentName: opts.paymentName,
          paymentId: paymentId,
          reference: opts.reference || "",
          currency: "RWF",
          items,
          // Table command information
          isTableCommand: isInTableCommand(),
          tableName: activeSession?.tableName,
          tableLocation: activeSession?.locationName,
        }),
      })

      const json = await res.json()

      console.log("Order creation response:", json)

      if (res.ok && json?.ok) {
        const orderId = json.orderId ? String(json.orderId) : null
        const sellerTel = json.sellerTel ? String(json.sellerTel) : null

        if (orderId) setOrderIds(m => ({ ...m, [g.supplierId]: orderId }))
        if (sellerTel) setOrderPhones(m => ({ ...m, [g.supplierId]: sellerTel }))

        // Track successful purchase for all items in this seller group (best-effort)
        try {
          g.items.forEach(it => {
            trackClick("product", it.id, it.name)
          })
        } catch {
          // ignore tracking errors
        }

        console.log(`✅ Order created with payment method: ${opts.paymentName}`)

        // Handle table command creation with share data
        if (json.tableCommand && json.tableCommand.shareableLink) {
          // If we're not already in a table command session, create one with share data
          if (!isInTableCommand()) {
            createTableCommand(
              json.tableCommand.tableName,
              g.supplierId,
              json.tableCommand.tableLocation,
              checkoutMode === "anonymous" ? anonymousName : user?.name || "Guest",
              checkoutMode === "anonymous" ? `guest_${Date.now()}@ihute.rw` : user?.email || "",
              {
                shareableLink: json.tableCommand.shareableLink,
                shareableToken: json.tableCommand.shareableToken,
                qrCodeUrl: json.tableCommand.qrCodeUrl,
              }
            )
          } else if (activeSession && activeSession.isCreator) {
            // Update existing session with share data
            updateTableShareData({
              shareableLink: json.tableCommand.shareableLink,
              shareableToken: json.tableCommand.shareableToken,
              qrCodeUrl: json.tableCommand.qrCodeUrl,
            })
          }

          // Show share modal
          setShareModalData({
            tableName: json.tableCommand.tableName,
            tableLocation: json.tableCommand.tableLocation,
            shareableLink: json.tableCommand.shareableLink,
            qrCodeUrl: json.tableCommand.qrCodeUrl,
            shareableToken: json.tableCommand.shareableToken,
          })
          setShareModalOpen(true)
          clear()
          return
        }

        if ((opts.paymentName === "PAID_MTN_MOMO" || opts.paymentName === "PAID_AIRTEL_MOMO") && orderId) {
          pollPayment(orderId, g.supplierId)
        }

        // Lock table command if in table mode: clear cart but stay on page so user can add more items
        if (isInTableCommand() && activeSession?.isCreator) {
          clear()
          alert(`Order #${orderId} added to table "${activeSession.tableName}". Add more items or send the complete table order.`)
          return
        }

        // Clear cart (but table session persists in its own store)
        clear()

        // Redirect to order success page with WhatsApp details
        if (orderId) {
          const params = new URLSearchParams({
            orderId,
            sellerName: g.supplierName,
            sellerPhone: sellerTel || "",
            buyerPhone: checkoutMode === "anonymous" ? anonymousPhone : (user?.phone || ""),
            total: String(g.subtotal),
            paymentMethod: opts.paymentName
          })
          router.push(`/order-success?${params.toString()}`)
        } else if (checkoutMode === "login" || isAuthenticated) {
          router.push("/orders")
        } else {
          router.push("/")
        }
        router.refresh()
      } else {
        setPaymentStatus(g.supplierId, "failed")
        const errMsg = json?.error || "Unknown error"
        const hint =
          typeof json?.hint === "string" && json.hint.trim()
            ? `\n\n${json.hint.trim()}`
            : ""
        const target =
          typeof json?.ordersUrl === "string" && json.ordersUrl.trim()
            ? `\n\nBackend URL: ${json.ordersUrl.trim()}`
            : ""
        alert(`Failed to create order: ${errMsg}${target}${hint}`)
      }
    } catch (error) {
      console.error("Order creation error:", error)
      setPaymentStatus(g.supplierId, "failed")
      alert("Failed to create order. Please try again.")
    } finally {
      setBusy(null)
    }
  }

  const confirmPayment = (g: ReturnType<typeof getGroupsBySeller>[number]) =>
    placeOrder(g, {
      paymentName: "PAID_MTN_MOMO",
      reference: `MOMO_${Date.now()}`,
      paymentId: `MOMO_${Date.now()}`
    })

  const submitCOD = async () => {
    if (!codForSeller) return
    const g = groups.find(x => x.supplierId === codForSeller)
    if (!g) { setCodOpen(false); return }

    // Check if Pangolin's Burrows - use table/location instead of delivery input
    const isPangolins = g.supplierName?.toUpperCase().includes("PANGOLIN")
    const location = isPangolins
      ? (isInTableCommand() ? `Table: ${activeSession?.tableName}` : g.supplierLocation || "In-person pickup")
      : deliveryLocation

    await placeOrder(g, {
      paymentName: "PAY_ON_DELIVERY",
      buyerPhone: contactPhone,
      buyerLocation: location,
      reference: `COD_${Date.now()}`,
      paymentId: `COD_${Date.now()}`
    })

    setCodOpen(false)
    setCodForSeller(null)
  }

  const confirmMoMoPayment = async () => {
    if (!momoForSeller) return
    const g = groups.find(x => x.supplierId === momoForSeller)
    if (!g) { setMomoOpen(false); return }
    await placeOrder(g, {
      paymentName: momoPaymentProvider === "airtel" ? "PAID_AIRTEL_MOMO" : "PAID_MTN_MOMO",
      reference: `MOMO_${Date.now()}`,
      paymentId: `MOMO_${Date.now()}`
    })
    setMomoOpen(false)
    setMomoForSeller(null)
  }

  const renderContent = () => (
    <div className="cart-summary-root">
      <div className="space-y-4">
        {groups.map((g) => {
          const status = getPaymentStatus(g.supplierId)
          const wa = sellerWhatsData.find(x => x.supplierId === g.supplierId)

          const momoTarget = getMomoForGroup(g)
          const hasUssdTarget = momoTarget.length > 0
          const unmark = () => setPaymentStatus(g.supplierId, "unpaid")

          return (
            <Card key={g.supplierId} className="border-2">
              <CardHeader className="pb-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <CardTitle className="text-base flex-1">
                  {g.supplierName}
                  {g.supplierLocation ? (
                    <span className="text-muted-foreground font-normal block sm:inline"> — {g.supplierLocation}</span>
                  ) : null}
                </CardTitle>
                {status === "paid" && (
                  <Badge variant="secondary" className="gap-1 text-green-700 border-green-200">
                    <CheckCircle2 className="h-4 w-4" /> Paid
                  </Badge>
                )}
                {status === "pending" && <Badge variant="secondary">Pending</Badge>}
                {status === "failed"  && <Badge variant="destructive">Failed</Badge>}
                {status === "unpaid"  && <Badge variant="outline">Unpaid</Badge>}
              </CardHeader>

              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span>Items</span>
                  <span className="font-medium">{g.items.reduce((n, it) => n + it.qty, 0)} pcs</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Subtotal</span>
                  <span className="font-semibold">{g.subtotal.toLocaleString()} RWF</span>
                </div>
                <Separator />

                {/* Primary checkout: if user already dismissed suggestions this session, go straight to payment */}
                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => {
                    setPendingCheckoutSupplierId(g.supplierId)
                    if (shouldSkipSuggestions()) {
                      openPaymentMethod(g.supplierId)
                    } else {
                      setSuggestionsPopupOpen(true)
                    }
                  }}
                  disabled={busy === g.supplierId || status === "paid"}
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  {status === "paid" ? "Order Placed" : "Proceed to Checkout"}
                </Button>

                {status === "paid" && (
                  <Button variant="outline" className="w-full" onClick={unmark}>
                    <RotateCcw className="h-4 w-4 mr-2" /> Unmark paid
                  </Button>
                )}

                {/* WhatsApp actions */}
                {(status === "paid" || status === "pending") && (
                  <div className="flex flex-col sm:flex-row gap-2 pt-2">
                    <Button
                      className="flex-1 bg-[#25D366] hover:bg-[#20b05a]"
                      asChild
                      disabled={!wa?.phone}
                      title={wa?.phone ? `Send order via WhatsApp to ${wa.phone}` : "No seller WhatsApp number"}
                    >
                      <a href={wa?.href || "#"} target="_blank" rel="noopener noreferrer">
                        <MessageCircle className="h-4 w-4 mr-2" /> Send WhatsApp
                      </a>
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={async () => { try { await navigator.clipboard.writeText(wa?.message || "") } catch {} }}
                      title="Copy WhatsApp message"
                    >
                      <MessageCircle className="h-4 w-4 mr-2" /> Copy message
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}

        {/* Promo code */}
        {/*<Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Tag className="h-4 w-4" /> Promo code
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex gap-2">
              <Input
                value={promoCode}
                onChange={(e) => { setPromoCode(e.target.value); setPromoError(null) }}
                placeholder="Enter promo code"
                className="flex-1"
              />
              <Button variant="secondary" onClick={() => applyPromo()}>Apply</Button>
            </div>
            {appliedPromo && (
              <p className="text-sm text-green-600">{appliedPromo.percent}% off applied</p>
            )}
            {promoError && <p className="text-sm text-destructive">{promoError}</p>}
          </CardContent>
        </Card>
*/}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Grand Total</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {discountAmount > 0 && (
              <>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{grandTotal.toLocaleString()} RWF</span>
                </div>
                <div className="flex justify-between text-sm text-green-600">
                  <span>Discount ({appliedPromo?.percent}%)</span>
                  <span>-{discountAmount.toLocaleString()} RWF</span>
                </div>
              </>
            )}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
              <div className="text-lg font-bold">{totalAfterDiscount.toLocaleString()} RWF</div>
              <Button variant="outline" onClick={clear} className="w-full sm:w-auto">Clear Cart</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Smart cart suggestions: show when user clicks Proceed to Checkout, then continue to payment */}
      <CartSuggestionsPopup
        open={suggestionsPopupOpen}
        onOpenChange={setSuggestionsPopupOpen}
        cartItems={groups.flatMap((g) =>
          g.items.map((i) => ({
            product_id: i.id ?? i.itemCode,
            name: i.name,
            quantity: i.qty,
            supplier_id: (i.supplierId ?? g.supplierId)?.toString().trim() || "",
            supplier_name: g.supplierName,
          }))
        )}
        onContinue={() => {
          const id = pendingCheckoutSupplierId
          setPendingCheckoutSupplierId(null)
          setSuggestionsPopupOpen(false)
          if (typeof window !== "undefined") sessionStorage.setItem(skipSuggestionsSessionKey, "1")
          if (id) openPaymentMethod(id)
        }}
      />

      {/* ✅ UPDATED: Payment method selection dialog with customer info pre-filled; scrollable on small viewports */}
      <Dialog open={paymentMethodOpen} onOpenChange={setPaymentMethodOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col overflow-hidden p-0 gap-0">
          <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-2">
            <DialogTitle>Choose Payment Method</DialogTitle>
            <DialogDescription>Select how you'd like to pay for this order</DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-4">
          {/* ✅ Customer Info Banner (from shop-with-me) */}
          {tableInfo && tableInfo.customerName && (
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Delivery Info</p>
                  <p className="text-xs text-muted-foreground">
                    {tableInfo.customerName} - {tableInfo.customerAddress}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ✅ Table Info Banner */}
          {isInTableCommand() && activeSession && (
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 space-y-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Table Order</p>
                  <p className="text-xs text-muted-foreground">
                    {activeSession.locationName} - Table {activeSession.tableName}
                  </p>
                </div>
              </div>
              {/* Close table: visible for creator when table is SENT so all orders are merged/final */}
              {activeSession.status === "SENT" && canCloseTable() && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2 border-orange-300 text-orange-700 hover:bg-orange-50 hover:text-orange-800"
                  onClick={() => setShowCloseTableDialog(true)}
                >
                  <Lock className="h-4 w-4" />
                  Close table (merge all orders — no one can add more)
                </Button>
              )}
            </div>
          )}

          {/* Checkout Mode Selection */}
          {!isAuthenticated && (
            <div className="space-y-3 pb-4 border-b">
              <Label className="text-sm font-medium">Checkout as:</Label>
              <RadioGroup value={checkoutMode} onValueChange={(v) => setCheckoutMode(v as "login" | "anonymous")}>
                <div className="flex items-center space-x-3 border rounded-lg p-3 cursor-pointer hover:bg-accent" onClick={() => setCheckoutMode("login")}>
                  <RadioGroupItem value="login" id="checkout-login" />
                  <Label htmlFor="checkout-login" className="cursor-pointer flex-1">
                    <div className="font-medium">Sign in to checkout</div>
                    <div className="text-xs text-muted-foreground">Track your orders easily</div>
                  </Label>
                </div>
                <div className="flex items-center space-x-3 border rounded-lg p-3 cursor-pointer hover:bg-accent" onClick={() => setCheckoutMode("anonymous")}>
                  <RadioGroupItem value="anonymous" id="checkout-anonymous" />
                  <Label htmlFor="checkout-anonymous" className="cursor-pointer flex-1">
                    <div className="font-medium">Continue as guest</div>
                    <div className="text-xs text-muted-foreground">No account needed</div>
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {/* Anonymous user info: for table orders do NOT pre-fill name — user enters their name so "Ordered By" shows person, not table */}
          {checkoutMode === "anonymous" && (
            <div className="space-y-3 pb-4 border-b">
              <div className="space-y-1">
                <Label className="text-sm font-medium">Your Name *</Label>
                <Input
                  value={anonymousName}
                  onChange={(e) => setAnonymousName(e.target.value)}
                  placeholder={isInTableCommand() ? "e.g., John, Alice" : "Enter your full name"}
                  className={!isInTableCommand() && tableInfo?.customerName ? "bg-muted" : ""}
                />
                {isInTableCommand() ? (
                  <p className="text-xs text-muted-foreground">
                    Enter your name so the supplier knows who ordered (table is already shown above).
                  </p>
                ) : tableInfo?.customerName ? (
                  <p className="text-xs text-muted-foreground">
                    Pre-filled from shop information
                  </p>
                ) : null}
              </div>
              <div className="space-y-1">
                <Label className="text-sm font-medium">Phone Number *</Label>
                <Input
                  value={anonymousPhone}
                  onChange={(e) => setAnonymousPhone(e.target.value)}
                  placeholder="+250..."
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Your order details and tracking link will be sent via WhatsApp
              </p>
            </div>
          )}

          {/* Payment method selection */}
          <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as "momo" | "airtel" | "cod")}>
            <div className="space-y-3">
              {selectedSeller && (() => {
                const g = groups.find(x => x.supplierId === selectedSeller)
                const hasUssdTarget = g ? Boolean(getMomoForGroup(g)) : false

                return (
                  <>
                    <div
                      className={`flex items-center space-x-3 border rounded-lg p-4 cursor-pointer hover:bg-accent ${!hasUssdTarget ? 'opacity-50' : ''}`}
                      onClick={() => hasUssdTarget && setPaymentMethod("momo")}
                    >
                      <RadioGroupItem value="momo" id="momo" disabled={!hasUssdTarget} />
                      <Label htmlFor="momo" className={`flex items-center gap-2 flex-1 ${hasUssdTarget ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                        <Wallet className="h-5 w-5 text-yellow-600" />
                        <div>
                          <div className="font-medium">MTN Mobile Money</div>
                          <div className="text-sm text-muted-foreground">
                            {hasUssdTarget ? 'Pay instantly with MTN MoMo' : 'Not available for this seller'}
                          </div>
                        </div>
                      </Label>
                    </div>

                    <div
                      className={`flex items-center space-x-3 border rounded-lg p-4 cursor-pointer hover:bg-accent ${!hasUssdTarget ? 'opacity-50' : ''}`}
                      onClick={() => hasUssdTarget && setPaymentMethod("airtel")}
                    >
                      <RadioGroupItem value="airtel" id="airtel" disabled={!hasUssdTarget} />
                      <Label htmlFor="airtel" className={`flex items-center gap-2 flex-1 ${hasUssdTarget ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                        <Wallet className="h-5 w-5 text-red-600" />
                        <div>
                          <div className="font-medium">Airtel Money</div>
                          <div className="text-sm text-muted-foreground">
                            {hasUssdTarget ? 'Pay with Airtel Money' : 'Not available for this seller'}
                          </div>
                        </div>
                      </Label>
                    </div>

                    <div className="flex items-center space-x-3 border rounded-lg p-4 cursor-pointer hover:bg-accent" onClick={() => setPaymentMethod("cod")}>
                      <RadioGroupItem value="cod" id="cod" />
                      <Label htmlFor="cod" className="flex items-center gap-2 cursor-pointer flex-1">
                        <Truck className="h-5 w-5 text-blue-600" />
                        <div>
                          <div className="font-medium">
                            {isInTableCommand() ? "Pay at Table" : "Cash on Delivery"}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {isInTableCommand() ? "Pay when order arrives at your table" : "Pay when you receive your order"}
                          </div>
                        </div>
                      </Label>
                    </div>
                  </>
                )
              })()}
            </div>
          </RadioGroup>

          </div>

          <DialogFooter className="flex-shrink-0 gap-2 border-t bg-background px-6 py-4">
            <Button variant="outline" onClick={() => setPaymentMethodOpen(false)}>Cancel</Button>
            <Button onClick={proceedWithPayment}>Continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* COD dialog */}
      <Dialog open={codOpen} onOpenChange={setCodOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {(() => {
                const g = codForSeller ? groups.find(x => x.supplierId === codForSeller) : null
                const isPangolins = g?.supplierName?.toUpperCase().includes("PANGOLIN")
                return isPangolins ? "Confirm Order" : "Review Order & Delivery Details"
              })()}
            </DialogTitle>
            <DialogDescription>
              {(() => {
                const g = codForSeller ? groups.find(x => x.supplierId === codForSeller) : null
                const isPangolins = g?.supplierName?.toUpperCase().includes("PANGOLIN")
                return isPangolins
                  ? "Review your order details and confirm."
                  : "Review your order and provide delivery details. Pay when you receive your order."
              })()}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Customer Information */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
              <h4 className="font-medium text-sm text-muted-foreground">CUSTOMER INFORMATION</h4>
              {checkoutMode === "anonymous" && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Name:</span>
                    <span className="font-medium">{anonymousName}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Phone:</span>
                    <span className="font-medium">{anonymousPhone}</span>
                  </div>
                </>
              )}
              {isAuthenticated && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Name:</span>
                    <span className="font-medium">{user?.name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Phone:</span>
                    <span className="font-medium">{user?.phone}</span>
                  </div>
                </>
              )}
              {isInTableCommand() && activeSession && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Table:</span>
                  <span className="font-medium font-mono">{activeSession.tableName}</span>
                </div>
              )}
            </div>

            {/* Order Items - ALWAYS SHOW FOR ALL SELLERS */}
            {codForSeller && (() => {
              const g = groups.find(x => x.supplierId === codForSeller)
              if (!g) return null

              return (
                <div className="border rounded-lg">
                  <div className="bg-slate-50 border-b p-3">
                    <h4 className="font-medium text-sm">ORDER ITEMS</h4>
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    {g.items.map((item, index) => {
                      const unitLine = displayUnitForPrice(item.unit ?? item.selectedUnit)
                      return (
                      <div key={index} className="flex justify-between items-center p-3 border-b last:border-b-0">
                        <div className="flex-1">
                          <div className="font-medium text-sm">{item.name}</div>
                          {unitLine && (
                            <div className="text-xs text-muted-foreground">Unit: {unitLine}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-sm text-muted-foreground">
                            {item.qty} × {item.price?.toLocaleString()} {CUR}
                          </div>
                          <div className="font-medium text-sm w-20 text-right">
                            {((item.price || 0) * (item.qty || 0)).toLocaleString()} {CUR}
                          </div>
                        </div>
                      </div>
                      )
                    })}
                  </div>
                  <div className="bg-slate-50 border-t p-3">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Total:</span>
                      <span className="font-bold text-lg">{g.subtotal.toLocaleString()} {CUR}</span>
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* Delivery location - only for non-Pangolins AND non-table-command orders */}
            {(() => {
              const g = codForSeller ? groups.find(x => x.supplierId === codForSeller) : null
              const isPangolins = g?.supplierName?.toUpperCase().includes("PANGOLIN")

              // Show delivery location for non-Pangolins AND when not in table command mode
              if (!isPangolins && !isInTableCommand()) {
                return (
                  <div className="space-y-3">
                    {savedAddresses.length > 0 && (
                      <div className="space-y-1">
                        <label className="text-sm font-medium flex items-center gap-1">
                          <MapPin className="h-4 w-4" /> Saved addresses
                        </label>
                        <Select
                          value=""
                          onValueChange={(id) => {
                            const addr = savedAddresses.find((a) => a.id === id)
                            if (addr) {
                              setDeliveryLocation(addr.address)
                              if (addr.phone) setContactPhone(addr.phone)
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Choose a saved address" />
                          </SelectTrigger>
                          <SelectContent>
                            {savedAddresses.map((a) => (
                              <SelectItem key={a.id} value={a.id}>
                                {a.label} — {a.address}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Delivery location *</label>
                      <Input
                        value={deliveryLocation}
                        onChange={(e) => setDeliveryLocation(e.target.value)}
                        placeholder="e.g., Kigali, Kacyiru, Plot 12"
                        className={tableInfo?.customerAddress ? "bg-muted" : ""}
                      />
                      {tableInfo?.customerAddress && (
                        <p className="text-xs text-muted-foreground">
                          Pre-filled from shop information
                        </p>
                      )}
                    </div>
                    {checkoutMode !== "anonymous" && (
                      <div className="space-y-1">
                        <label className="text-sm font-medium">Contact phone</label>
                        <Input
                          value={contactPhone}
                          onChange={(e) => setContactPhone(e.target.value)}
                          placeholder="+2507…"
                        />
                      </div>
                    )}
                    {deliveryLocation.trim() && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const label = `Address ${savedAddresses.length + 1}`
                          setSavedAddresses(saveAddress({ label, address: deliveryLocation.trim(), phone: contactPhone.trim() || undefined }))
                        }}
                      >
                        <MapPin className="h-4 w-4 mr-1" /> Save this address
                      </Button>
                    )}
                  </div>
                )
              }
            })()}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCodOpen(false)}>Cancel</Button>
            <Button
              onClick={submitCOD}
              disabled={(() => {
                const g = codForSeller ? groups.find(x => x.supplierId === codForSeller) : null
                const isPangolins = g?.supplierName?.toUpperCase().includes("PANGOLIN")
                // Require delivery location only for non-Pangolins AND when not in table command
                return !isPangolins && !isInTableCommand() && !deliveryLocation
              })()}
            >
              <Truck className="h-4 w-4 mr-2" />
              Place order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MoMo payment dialog */}
      <Dialog open={momoOpen} onOpenChange={setMomoOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {momoPaymentProvider === "airtel" ? "Pay with Airtel Money" : "Pay with MTN Mobile Money"}
            </DialogTitle>
            <DialogDescription>Complete payment to confirm your order</DialogDescription>
          </DialogHeader>

          {momoForSeller && (() => {
            const g = groups.find(x => x.supplierId === momoForSeller)
            if (!g) return null

            const momoTarget = getMomoForGroup(g)
            const hasUssdTarget = momoTarget.length > 0
            const payload = buildMoMoUssd(momoTarget, g.subtotal)
            const telHref = `tel:${encodeURIComponent(payload)}`

            return (
              <div className="space-y-4">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Amount to pay:</span>
                    <span className="font-bold text-lg">{g.subtotal.toLocaleString()} RWF</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Seller:</span>
                    <span className="font-medium">{g.supplierName}</span>
                  </div>
                </div>

                {hasUssdTarget && (
                  <>
                    <div className="text-center space-y-2">
                      <p className="text-sm font-medium">Scan QR code with your phone camera</p>
                      <div className="bg-white p-4 rounded-lg inline-block border-2">
                        <QRCode value={payload} size={200} />
                      </div>
                      <p className="text-xs font-semibold text-slate-800">USSD code (dial on your phone):</p>
                      <p className="font-mono text-sm bg-white border rounded px-2 py-1 break-all select-all" title="Copy or dial">
                        {payload}
                      </p>
                      <p className="text-xs text-muted-foreground">Or tap &quot;Dial now&quot; below to open your dialer with this code.</p>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(momoTarget)
                            alert(`Copied: ${momoTarget}`)
                          } catch {}
                        }}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Copy number
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1"
                        asChild
                      >
                        <a href={telHref}>
                          <PhoneCall className="h-4 w-4 mr-2" />
                          Dial now
                        </a>
                      </Button>
                    </div>
                  </>
                )}

                {!hasUssdTarget && (
                  <div className="text-center p-6 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      No MoMo code available for this seller. Please contact them directly.
                    </p>
                  </div>
                )}

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs text-blue-900">
                    <strong>Note:</strong> After completing the MoMo payment, click "I've Paid" below to confirm your order.
                  </p>
                </div>
              </div>
            )
          })()}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setMomoOpen(false); setMomoForSeller(null) }}>
              Cancel
            </Button>
            <Button
              onClick={confirmMoMoPayment}
              disabled={busy === momoForSeller}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              {busy === momoForSeller ? "Processing..." : "I've Paid"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Table Command Dialog */}
      {tableCommandSeller && (
        <TableCommandDialog
          open={tableCommandDialogOpen}
          onOpenChange={(open) => {
            setTableCommandDialogOpen(open)
            // If dialog closed after creating/joining table, proceed to payment method
            if (!open && isInTableCommand() && tableCommandSeller) {
              const g = groups.find(x => x.supplierId === tableCommandSeller.id)
              if (g) {
                const hasUssdTarget = Boolean(getMomoForGroup(g))
                setSelectedSeller(tableCommandSeller.id)
                setPaymentMethod(hasUssdTarget ? "momo" : "cod")
                setPaymentMethodOpen(true)
              }
            }
          }}
          onIndividualOrder={() => {
            // User chose individual ordering - proceed with regular checkout flow
            if (tableCommandSeller) {
              const g = groups.find(x => x.supplierId === tableCommandSeller.id)
              if (g) {
                const hasUssdTarget = Boolean(getMomoForGroup(g))
                setSelectedSeller(tableCommandSeller.id)
                setPaymentMethod(hasUssdTarget ? "momo" : "cod")
                setPaymentMethodOpen(true)
              }
            }
          }}
          locationId={tableCommandSeller.id}
          locationName={tableCommandSeller.name}
          initialTableName={(tableInfo?.customerAddress || tableInfo?.tableNumber || "").trim()}
          initialUserName={(tableInfo?.customerName || "").trim()}
        />
      )}

      {/* Table Command Share Modal */}
      <TableCommandShareModal
        open={shareModalOpen}
        onOpenChange={setShareModalOpen}
        data={shareModalData}
      />

      {/* Close Table Dialog */}
      <AlertDialog open={showCloseTableDialog} onOpenChange={setShowCloseTableDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-orange-600" />
              Close Table Command?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Table &quot;{activeSession?.tableName}&quot; — closing merges and finalizes all orders.
              <div className="mt-3 space-y-2">
                <p className="font-medium text-foreground">Do you want to close this table?</p>
                <ul className="text-sm space-y-1 ml-4 list-disc">
                  <li><strong>Close Table:</strong> No one can add more items. All orders are merged and the table is finished.</li>
                  <li><strong>Keep Open:</strong> You or others can still add items and send another order.</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Open</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                closeTableCommand()
                setShowCloseTableDialog(false)
              }}
              className="bg-orange-600 hover:bg-orange-700"
            >
              Close Table
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
  return renderContent()
}