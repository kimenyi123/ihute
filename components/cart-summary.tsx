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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog"
import { Copy, PhoneCall, CheckCircle2, RotateCcw, MessageCircle, Truck } from "lucide-react"

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
  const [orderPhones, setOrderPhones] = useState<Record<string, string>>({}) // ✅ server-provided WhatsApp number

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

  // ✅ MoMo payment auto-poll (up to ~60s)
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
      // ✅ prefer server-provided phone; fall back to seller phone or momo
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
        // COD => unpaid, MoMo paid only when marked paid
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
        // keep "pending" by default; MoMo poll will flip to paid
        if (json.orderId) setOrderIds(m => ({ ...m, [g.supplierId]: String(json.orderId) }))
        if (json.sellerTel) setOrderPhones(m => ({ ...m, [g.supplierId]: String(json.sellerTel) }))
        if (opts.paymentName === "PAID_MTN_MOMO" && json.orderId) {
          // async poll (don't block UX)
          pollPayment(String(json.orderId), g.supplierId)
        }
        clear()
        router.push("/orders")
        router.refresh()
      } else {
        setPaymentStatus(g.supplierId, "failed")
      }
    } catch {
      setPaymentStatus(g.supplierId, "failed")
    } finally {
      setBusy(null)
    }
  }

  const confirmPayment = (g: ReturnType<typeof getGroupsBySeller>[number]) =>
    placeOrder(g, { paymentName: "PAID_MTN_MOMO", reference: `PAID_MTN_${Date.now()}` })

  // COD (hold order; pay on delivery)
  const openCOD = (supplierId: string) => {
    if (!requireLogin()) return
    setCodForSeller(supplierId)
    setDeliveryLocation(user?.location || "")
    setContactPhone(user?.phone || "")
    setCodOpen(true)
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
  }

  return (
    <>
      <div className="space-y-4">
        {groups.map((g) => {
          const status = getPaymentStatus(g.supplierId)
          const wa = sellerWhatsData.find(x => x.supplierId === g.supplierId)

          // ✅ read MoMo target from the cart group (fallback-safe)
          const momoTarget = ((g as any).momo ?? "").trim()
          const hasUssdTarget = momoTarget.length > 0
          const payload = `*182*8*1*${momoTarget}*${g.subtotal}#`
          const telHref = `tel:${encodeURIComponent(payload)}`
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

                {/* Payment section */}
                {hasUssdTarget ? (
                  // ===== MTN MoMo flow =====
                  <div className="grid grid-cols-1 gap-3">
                    <div className="flex items-center justify-center">
                      <div className="bg-white p-3 rounded">
                        <QRCode value={`*182*8*1*${momoTarget}*${g.subtotal}#`} size={140} />
                      </div>
                    </div>

                    <div className="space-y-1 text-xs">
                      <div className="text-muted-foreground">MTN MoMo USSD</div>
                      <div className="font-mono break-all text-sm">{payload}</div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={async () => { await navigator.clipboard.writeText(payload) }}
                        disabled={status === "paid"}
                      >
                        <Copy className="h-4 w-4 mr-2" /> Copy code
                      </Button>
                      <Button
                        className="flex-1"
                        asChild
                        disabled={status === "paid"}
                        onClick={() => { if (!requireLogin()) return }}
                      >
                        <a href={isAuthenticated ? telHref : "#"}>
                          <PhoneCall className="h-4 w-4 mr-2" /> Pay
                        </a>
                      </Button>
                    </div>

                    <div className="flex gap-2">
                      {status !== "paid" ? (
                        <Button className="flex-1" onClick={() => confirmPayment(g)} disabled={busy === g.supplierId}>
                          {busy === g.supplierId ? "Confirming…" : "Mark as paid"}
                        </Button>
                      ) : (
                        <Button variant="outline" className="flex-1" onClick={unmark}>
                          <RotateCcw className="h-4 w-4 mr-2" /> Unmark paid
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  // ===== COD-first flow when no MoMo =====
                  <div className="grid grid-cols-1 gap-3">
                    <div className="rounded-lg border p-3 bg-amber-50">
                      <div className="text-sm mb-2">
                        This seller doesn’t have a MoMo code. You can <b>pay on delivery</b>.
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => openCOD(g.supplierId)}
                          disabled={busy === g.supplierId}
                          className="flex-1"
                          title="Place order and pay on delivery"
                        >
                          <Truck className="h-4 w-4 mr-2" /> Place order (COD)
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Always-visible actions */}
                <div className="mt-3 grid grid-cols-1 gap-2">
                  {/* show this extra COD button only when MoMo exists to avoid duplicates */}
                  {hasUssdTarget && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => openCOD(g.supplierId)}
                      disabled={busy === g.supplierId}
                      title="Place order and pay on delivery"
                    >
                      <Truck className="h-4 w-4 mr-2" /> Pay on delivery
                    </Button>
                  )}

                  <div className="flex gap-2">
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
                      title={isAuthenticated ? "Copy WhatsApp message" : "Sign in to copy"
                      }
                    >
                      <MessageCircle className="h-4 w-4 mr-2" /> Copy message
                    </Button>
                  </div>
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

      {/* COD dialog */}
      <Dialog open={codOpen} onOpenChange={setCodOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delivery details</DialogTitle>
            <DialogDescription>We’ll hold the order and you can pay on delivery.</DialogDescription>
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
            <Button onClick={submitCOD}>Place order (COD)</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
