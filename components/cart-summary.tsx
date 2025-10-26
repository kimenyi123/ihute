// app/(wherever)/CartSummary.tsx
"use client"

import dynamic from "next/dynamic"
import { useMemo, useState } from "react"
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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog"
import { Copy, PhoneCall, CheckCircle2, RotateCcw, MessageCircle, Truck, CreditCard, Wallet } from "lucide-react"

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
function formatPaidAt(v: unknown): string {
  if (v == null) return ""
  return String(v).trim().replace(/\bMtn\b/i, "MTN").replace(/\bMTN\s*(?=\d)/i, "MTN ").replace(/\s+/g, " ").trim()
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
  const myPhone = user?.phone || ""

  const requireLogin = () => {
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
      const chosenPhone = orderPhones[g.supplierId] || (g as any).phone || g.momo || ""
      const phone = normalizePhone(chosenPhone)
      const items: WhatsItem[] = g.items.map((it) => {
        const name = stripTrailingPriceParen(it.name || "Product")
        const qty = it.qty
        const amount = Math.round((it.price || 0) * (it.qty || 0))
        return [name, qty, amount]
      })
      const orderId = orderIds[g.supplierId]
      const hasUssdTarget = Boolean(((g as any).momo ?? "").trim())
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
  const placeOrder = async (
    g: ReturnType<typeof getGroupsBySeller>[number],
    opts: { paymentName: "PAID_MTN_MOMO" | "PAY_ON_DELIVERY"; buyerPhone?: string; buyerLocation?: string; reference?: string }
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

      const res = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyerEmail: user?.email,
          buyerPhone: opts.buyerPhone || user?.phone || "",
          buyerLocation: opts.buyerLocation || user?.location || "NA",
          sellerAccount: g.supplierId,
          sellerName: g.supplierName,
          paymentName: opts.paymentName,
          reference: opts.reference || "",
          currency: "RWF",
          items
        }),
      })

      const json = await res.json()

      if (res.ok && json?.ok) {
        if (json.orderId) setOrderIds(m => ({ ...m, [g.supplierId]: String(json.orderId) }))
        if (json.sellerTel) setOrderPhones(m => ({ ...m, [g.supplierId]: String(json.sellerTel) }))
        if (opts.paymentName === "PAID_MTN_MOMO" && json.orderId) {
          pollPayment(String(json.orderId), g.supplierId)
        }
        clear()
        router.push("/orders")
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

  const confirmPayment = (g: ReturnType<typeof getGroupsBySeller>[number]) =>
    placeOrder(g, { paymentName: "PAID_MTN_MOMO", reference: `PAID_MTN_${Date.now()}` })

  // Open payment method selection
  const openPaymentMethod = (supplierId: string) => {
    if (!requireLogin()) return
    const g = groups.find(x => x.supplierId === supplierId)
    if (!g) return
    
    const hasUssdTarget = Boolean(((g as any).momo ?? "").trim())
    setSelectedSeller(supplierId)
    // Default to momo if available, otherwise cod
    setPaymentMethod(hasUssdTarget ? "momo" : "cod")
    setPaymentMethodOpen(true)
  }

  // Handle payment method selection
  const proceedWithPayment = async () => {
    if (!selectedSeller) return
    
    if (paymentMethod === "cod") {
      setPaymentMethodOpen(false)
      setCodForSeller(selectedSeller)
      setDeliveryLocation(user?.location || "")
      setContactPhone(user?.phone || "")
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

  const submitCOD = async () => {
    if (!codForSeller) return
    const g = groups.find(x => x.supplierId === codForSeller)
    if (!g) { setCodOpen(false); return }
    await placeOrder(g, {
      paymentName: "PAY_ON_DELIVERY",
      buyerPhone: contactPhone,
      buyerLocation: deliveryLocation,
      reference: `PAY_ON_DELIVERY_${Date.now()}`
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

          const momoTarget = ((g as any).momo ?? "").trim()
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
                <div className="flex gap-2 pt-2">
                  <Button
                    className="flex-1 bg-[#25D366] hover:bg-[#20b05a]"
                    asChild
                    disabled={!wa?.phone || !isAuthenticated}
                    title={
                      !isAuthenticated
                        ? "Sign in to contact seller"
                        : (wa?.phone ? `Send order via WhatsApp to ${wa.phone}` : "No seller WhatsApp number")
                    }
                  >
                    <a href={isAuthenticated ? (wa?.href || "#") : "#"} target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="h-4 w-4 mr-2" /> Send WhatsApp
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={async () => { try { await navigator.clipboard.writeText(wa?.message || "") } catch {} }}
                    disabled={!isAuthenticated}
                    title={isAuthenticated ? "Copy WhatsApp message" : "Sign in to copy"}
                  >
                    <MessageCircle className="h-4 w-4 mr-2" /> Copy message
                  </Button>
                </div>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Choose Payment Method</DialogTitle>
            <DialogDescription>Select how you'd like to pay for this order</DialogDescription>
          </DialogHeader>
          
          <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as "momo" | "cod")}>
            <div className="space-y-3">
              {selectedSeller && (() => {
                const g = groups.find(x => x.supplierId === selectedSeller)
                const hasUssdTarget = g ? Boolean(((g as any).momo ?? "").trim()) : false
                
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
            <DialogTitle>Delivery details</DialogTitle>
            <DialogDescription>We'll hold the order and you can pay on delivery.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Delivery location</label>
              <Input value={deliveryLocation} onChange={(e) => setDeliveryLocation(e.target.value)} placeholder="e.g., Kigali, Kacyiru, Plot 12" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Contact phone</label>
              <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="+2507…" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCodOpen(false)}>Cancel</Button>
            <Button onClick={submitCOD} disabled={!deliveryLocation || !contactPhone}>
              <Truck className="h-4 w-4 mr-2" />
              Place order (COD)
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
            
            const momoTarget = ((g as any).momo ?? "").trim()
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
    </>
  )
}