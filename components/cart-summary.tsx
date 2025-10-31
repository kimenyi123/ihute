// app/(wherever)/CartSummary.tsx
"use client"

import dynamic from "next/dynamic"
import { useMemo, useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/lib/auth-store"
import { useCartStore } from "@/lib/cart-store"
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
import { Copy, PhoneCall, CheckCircle2, RotateCcw, MessageCircle, Truck, CreditCard, Wallet, Beer, Users, Lock } from "lucide-react"
import { isBarOrRestaurant } from "@/lib/constants"
import { useTableCommandStore } from "@/lib/table-command-store"
import { TableCommandDialog } from "@/components/table-command-dialog"
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
// function formatPaidAt(v: unknown): string {
//   if (v == null) return ""
//   const s = String(v).trim()
  
//   // Handle new payment method names
//   const map: Record<string, string> = {
//     "PAID_MTN_MOMO": "MTN MoMo",
//     "PAID_CARD": "Card Payment",
//     "PAY_ON_DELIVERY": "Pay on delivery",
//     "MTN_MOMO": "MTN MoMo",
//     "MOMO": "Mobile Money",
//     "CARD": "Card Payment"
//   }
  
//   const normalized = map[s.toUpperCase()]
//   if (normalized) return normalized
  
//   // Legacy formatting
//   return s.replace(/\bMtn\b/i, "MTN")
//     .replace(/\bMTN\s*(?=\d)/i, "MTN ")
//     .replace(/\s+/g, " ")
//     .trim()
// }
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
  const router = useRouter()
  const { isAuthenticated, user } = useAuthStore()
  const getGroupsBySeller = useCartStore((s) => s.getGroupsBySeller)
  const getGrandTotal    = useCartStore((s) => s.getGrandTotal)
  const clear            = useCartStore((s) => s.clear)
  const getPaymentStatus = useCartStore((s) => s.getPaymentStatus)
  const setPaymentStatus = useCartStore((s) => s.setPaymentStatus)

  const [busy, setBusy] = useState<string | null>(null)
  const [orderIds, setOrderIds] = useState<Record<string, string>>({})
  const [orderPhones, setOrderPhones] = useState<Record<string, string>>({})

  // Payment method selection dialog
  const [paymentMethodOpen, setPaymentMethodOpen] = useState(false)
  const [selectedSeller, setSelectedSeller] = useState<string | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<"momo" | "cod">("momo")

  // Anonymous checkout mode
  const [checkoutMode, setCheckoutMode] = useState<"login" | "anonymous">(isAuthenticated ? "login" : "anonymous")
  const [anonymousPhone, setAnonymousPhone] = useState("")
  const [anonymousName, setAnonymousName] = useState("")

  // Table command mode
  const { isInTableCommand, activeSession, lockTableCommand, canCloseTable, closeTableCommand } = useTableCommandStore()

  // Pre-fill name from table command session if available
  useEffect(() => {
    if (isInTableCommand() && activeSession?.userName && !isAuthenticated) {
      setAnonymousName(activeSession.userName)
    }
  }, [isInTableCommand, activeSession, isAuthenticated])
  const [tableCommandDialogOpen, setTableCommandDialogOpen] = useState(false)
  const [tableCommandSeller, setTableCommandSeller] = useState<{ id: string; name: string } | null>(null)
  const [showCloseTableDialog, setShowCloseTableDialog] = useState(false)

  // MoMo payment dialog
  const [momoOpen, setMomoOpen] = useState(false)
  const [momoForSeller, setMomoForSeller] = useState<string | null>(null)

  // COD dialog
  const [codOpen, setCodOpen] = useState(false)
  const [codForSeller, setCodForSeller] = useState<string | null>(null)
  const [deliveryLocation, setDeliveryLocation] = useState(user?.location || "")
  const [contactPhone, setContactPhone] = useState(user?.phone || "")

  const groups = getGroupsBySeller()
  const grandTotal = Math.round(getGrandTotal())
  const myPhone = checkoutMode === "anonymous" ? anonymousPhone : (user?.phone || "")

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
      const chosenPhone = orderPhones[g.supplierId] || g.phone || g.momo || ""
      const phone = normalizePhone(chosenPhone)
      const items: WhatsItem[] = g.items.map((it) => {
        const name = stripTrailingPriceParen(it.name || "Product")
        const qty = it.qty
        const amount = Math.round((it.price || 0) * (it.qty || 0))
        return [name, qty, amount]
      })
      const orderId = orderIds[g.supplierId]
      const hasUssdTarget = Boolean((g.momo ?? "").trim())
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
        link: orderId ? `https://ihute.rw/more_details.jsp?order_id=${orderId}` : undefined,
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

  // Unified order creator for MoMo & COD

  // Open payment method selection
  const openPaymentMethod = (supplierId: string) => {
    if (!requireLogin()) return
    const g = groups.find(x => x.supplierId === supplierId)
    if (!g) return

    // Check if this is a bar/restaurant and offer table command mode
    const isBar = isBarOrRestaurant(g.supplierName) || isBarOrRestaurant(g.supplierLocation || "")

    // If it's a bar/restaurant and user is not already in a table command for this location
    if (isBar && !isInTableCommand()) {
      setTableCommandSeller({ id: supplierId, name: g.supplierName })
      setTableCommandDialogOpen(true)
      return
    }

    // Otherwise proceed with regular checkout
    const hasUssdTarget = Boolean((g.momo ?? "").trim())
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
      setDeliveryLocation(checkoutMode === "anonymous" ? "" : user?.location || "")
      setContactPhone(checkoutMode === "anonymous" ? anonymousPhone : user?.phone || "")
      setCodOpen(true)
      setSelectedSeller(null)
    } else {
      // MoMo - show QR code dialog
      setPaymentMethodOpen(false)
      setMomoForSeller(selectedSeller)
      setMomoOpen(true)
      setSelectedSeller(null)
    }
  }

// Unified order creator for MoMo & COD
const placeOrder = async (
  g: ReturnType<typeof getGroupsBySeller>[number],
  opts: { 
    paymentName: "PAID_MTN_MOMO" | "PAY_ON_DELIVERY"; 
    buyerPhone?: string; 
    buyerLocation?: string; 
    reference?: string;
    paymentId?: string; // ✅ ADD PAYMENT ID OPTION
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
      unit: it.unit ?? ""
    }))

    // ✅ GENERATE PAYMENT ID BASED ON PAYMENT METHOD
    const paymentId = opts.paymentId || `${opts.paymentName}_${Date.now()}`

    console.log("Placing order with payment:", {
      paymentName: opts.paymentName,
      paymentId: paymentId,
      supplierId: g.supplierId
    })

    const res = await fetch("/api/orders/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        buyerEmail: checkoutMode === "anonymous" ? `guest_${Date.now()}@ihute.rw` : user?.email,
        buyerPhone: opts.buyerPhone || (checkoutMode === "anonymous" ? anonymousPhone : user?.phone || ""),
        buyerLocation: opts.buyerLocation || (checkoutMode === "anonymous" ? deliveryLocation : user?.location || "NA"),
        buyerName: checkoutMode === "anonymous" ? anonymousName : user?.name,
        sellerAccount: g.supplierId,
        sellerName: g.supplierName,
        sellerPhone: g.phone || "", // ✅ INCLUDE SELLER PHONE
        paymentName: opts.paymentName, // ✅ SEND PAYMENT NAME
        paymentId: paymentId, // ✅ SEND PAYMENT ID
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

      // ✅ LOG SUCCESSFUL PAYMENT METHOD
      console.log(`✅ Order created with payment method: ${opts.paymentName}`)

      if (opts.paymentName === "PAID_MTN_MOMO" && orderId) {
        pollPayment(orderId, g.supplierId)
      }

      // Lock table command if in table mode
      if (isInTableCommand() && activeSession) {
        const userEmail = isAuthenticated ? (user?.email || user?.phone || `guest_${Date.now()}`) : `guest_${Date.now()}`
        lockTableCommand(userEmail)

        // Ask if user wants to close table
        if (canCloseTable()) {
          setShowCloseTableDialog(true)
        }
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
          paymentMethod: opts.paymentName // ✅ INCLUDE PAYMENT METHOD IN REDIRECT
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
      alert(`Failed to create order: ${json?.error || "Unknown error"}`)
    }
  } catch (error) {
    console.error("Order creation error:", error)
    setPaymentStatus(g.supplierId, "failed")
    alert("Failed to create order. Please try again.")
  } finally {
    setBusy(null)
  }
}

// ✅ UPDATED: confirmPayment function with payment ID
const confirmPayment = (g: ReturnType<typeof getGroupsBySeller>[number]) =>
  placeOrder(g, { 
    paymentName: "PAID_MTN_MOMO",
    reference: `MOMO_${Date.now()}`,
    paymentId: `MOMO_${Date.now()}` // ✅ INCLUDE PAYMENT ID
  })

// ✅ UPDATED: submitCOD function with payment ID
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
    paymentId: `COD_${Date.now()}` // ✅ INCLUDE PAYMENT ID
  })

  setCodOpen(false)
  setCodForSeller(null)
}

  const confirmMoMoPayment = async () => {
    if (!momoForSeller) return
    const g = groups.find(x => x.supplierId === momoForSeller)
    if (!g) { setMomoOpen(false); return }
    await confirmPayment(g)
    setMomoOpen(false)
    setMomoForSeller(null)
  }

  return (
    <>
      <div className="space-y-4">
        {groups.map((g) => {
          const status = getPaymentStatus(g.supplierId)
          const wa = sellerWhatsData.find(x => x.supplierId === g.supplierId)

          const momoTarget = (g.momo ?? "").trim()
          const hasUssdTarget = momoTarget.length > 0
          const unmark = () => setPaymentStatus(g.supplierId, "unpaid")

          return (
            <Card key={g.supplierId} className="border-2">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-base">
                  {g.supplierName}
                  {g.supplierLocation ? (
                    <span className="text-muted-foreground font-normal"> — {g.supplierLocation}</span>
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

                {/* Primary checkout button */}
                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => openPaymentMethod(g.supplierId)}
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
                  <div className="flex gap-2 pt-2">
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

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Grand Total</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-lg font-bold">{grandTotal.toLocaleString()} RWF</div>
            <Button variant="outline" onClick={clear}>Clear Cart</Button>
          </CardContent>
        </Card>
      </div>

      {/* Payment method selection dialog */}
      <Dialog open={paymentMethodOpen} onOpenChange={setPaymentMethodOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Choose Payment Method</DialogTitle>
            <DialogDescription>Select how you'd like to pay for this order</DialogDescription>
          </DialogHeader>

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

          {/* Anonymous user info collection */}
          {checkoutMode === "anonymous" && (
            <div className="space-y-3 pb-4 border-b">
              <div className="space-y-1">
                <Label className="text-sm font-medium">Your Name *</Label>
                <Input
                  value={anonymousName}
                  onChange={(e) => setAnonymousName(e.target.value)}
                  placeholder="Enter your full name"
                />
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

          <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as "momo" | "cod")}>
            <div className="space-y-3">
              {selectedSeller && (() => {
                const g = groups.find(x => x.supplierId === selectedSeller)
                const hasUssdTarget = g ? Boolean((g.momo ?? "").trim()) : false

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

                    <div className="flex items-center space-x-3 border rounded-lg p-4 cursor-pointer hover:bg-accent" onClick={() => setPaymentMethod("cod")}>
                      <RadioGroupItem value="cod" id="cod" />
                      <Label htmlFor="cod" className="flex items-center gap-2 cursor-pointer flex-1">
                        <Truck className="h-5 w-5 text-blue-600" />
                        <div>
                          <div className="font-medium">Cash on Delivery</div>
                          <div className="text-sm text-muted-foreground">Pay when you receive your order</div>
                        </div>
                      </Label>
                    </div>
                  </>
                )
              })()}
            </div>
          </RadioGroup>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPaymentMethodOpen(false)}>Cancel</Button>
            <Button onClick={proceedWithPayment}>Continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* COD dialog */}
      <Dialog open={codOpen} onOpenChange={setCodOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {(() => {
                const g = codForSeller ? groups.find(x => x.supplierId === codForSeller) : null
                const isPangolins = g?.supplierName?.toUpperCase().includes("PANGOLIN")
                return isPangolins ? "Confirm Order" : "Delivery details"
              })()}
            </DialogTitle>
            <DialogDescription>
              {(() => {
                const g = codForSeller ? groups.find(x => x.supplierId === codForSeller) : null
                const isPangolins = g?.supplierName?.toUpperCase().includes("PANGOLIN")
                return isPangolins
                  ? "Review your order details and confirm."
                  : "We'll hold the order and you can pay on delivery."
              })()}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {(() => {
              const g = codForSeller ? groups.find(x => x.supplierId === codForSeller) : null
              const isPangolins = g?.supplierName?.toUpperCase().includes("PANGOLIN")

              return (
                <>
                  {/* Order Summary */}
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                    {checkoutMode === "anonymous" && (
                      <>
                        <div className="text-sm">
                          <span className="text-muted-foreground">Name: </span>
                          <span className="font-medium">{anonymousName}</span>
                        </div>
                        <div className="text-sm">
                          <span className="text-muted-foreground">Phone: </span>
                          <span className="font-medium">{anonymousPhone}</span>
                        </div>
                      </>
                    )}
                    {isAuthenticated && (
                      <>
                        <div className="text-sm">
                          <span className="text-muted-foreground">Name: </span>
                          <span className="font-medium">{user?.name}</span>
                        </div>
                        <div className="text-sm">
                          <span className="text-muted-foreground">Phone: </span>
                          <span className="font-medium">{user?.phone}</span>
                        </div>
                      </>
                    )}
                    {isInTableCommand() && activeSession && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Table: </span>
                        <span className="font-medium font-mono">{activeSession.tableName}</span>
                      </div>
                    )}
                    {g && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Total: </span>
                        <span className="font-bold">{g.subtotal.toLocaleString()} RWF</span>
                      </div>
                    )}
                  </div>

                  {/* Delivery location - only for non-Pangolins orders */}
                  {!isPangolins && (
                    <>
                      <div className="space-y-1">
                        <label className="text-sm font-medium">Delivery location *</label>
                        <Input
                          value={deliveryLocation}
                          onChange={(e) => setDeliveryLocation(e.target.value)}
                          placeholder="e.g., Kigali, Kacyiru, Plot 12"
                        />
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
                    </>
                  )}
                </>
              )
            })()}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCodOpen(false)}>Cancel</Button>
            <Button
              onClick={submitCOD}
              disabled={(() => {
                const g = codForSeller ? groups.find(x => x.supplierId === codForSeller) : null
                const isPangolins = g?.supplierName?.toUpperCase().includes("PANGOLIN")
                return !isPangolins && !deliveryLocation
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
            <DialogTitle>Pay with MTN Mobile Money</DialogTitle>
            <DialogDescription>Complete payment to confirm your order</DialogDescription>
          </DialogHeader>
          
          {momoForSeller && (() => {
            const g = groups.find(x => x.supplierId === momoForSeller)
            if (!g) return null

            const momoTarget = (g.momo ?? "").trim()
            const hasUssdTarget = momoTarget.length > 0
            const payload = `*182*8*1*${momoTarget}*${g.subtotal}#`
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
                      <p className="text-xs text-muted-foreground">Or dial manually: {payload}</p>
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
                const hasUssdTarget = Boolean((g.momo ?? "").trim())
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
                const hasUssdTarget = Boolean((g.momo ?? "").trim())
                setSelectedSeller(tableCommandSeller.id)
                setPaymentMethod(hasUssdTarget ? "momo" : "cod")
                setPaymentMethodOpen(true)
              }
            }
          }}
          locationId={tableCommandSeller.id}
          locationName={tableCommandSeller.name}
        />
      )}

      {/* Close Table Dialog */}
      <AlertDialog open={showCloseTableDialog} onOpenChange={setShowCloseTableDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-orange-600" />
              Close Table Command?
            </AlertDialogTitle>
            <AlertDialogDescription>
              You just sent an order for table "{activeSession?.tableName}".
              <div className="mt-3 space-y-2">
                <p className="font-medium text-foreground">Do you want to close this table?</p>
                <ul className="text-sm space-y-1 ml-4 list-disc">
                  <li><strong>Close Table:</strong> No one can add more items. Table is finished.</li>
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
    </>
  )
}