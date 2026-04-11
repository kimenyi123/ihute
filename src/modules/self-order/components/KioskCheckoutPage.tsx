"use client"

import { useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { useRouter, useSearchParams } from "next/navigation"
import { useCartStore } from "@/lib/cart-store"
import { ChevronLeft, CreditCard, Banknote, Smartphone, Copy, CheckCircle2 } from "lucide-react"
import type { KioskCategory, KioskOrderLine, KioskOrderPayload } from "@/src/modules/self-order/types"

const QRCode = dynamic(() => import("react-qr-code"), { ssr: false })

type PayMethod = "CARD" | "CASH" | "MOMO"

// MoMo USSD builder for kiosk checkout.
// Your kiosk expects: *182*1*8*<momoCode>*<amount>#
function buildKioskMoMoUssd(momoCode: string, amount: number): string {
  const code = (momoCode || "").trim()
  if (!code) return ""
  const prefix =
    process.env.NEXT_PUBLIC_MOMO_USSD_PREFIX && String(process.env.NEXT_PUBLIC_MOMO_USSD_PREFIX).trim()
      ? String(process.env.NEXT_PUBLIC_MOMO_USSD_PREFIX).trim()
      : "*182*1*8*"
  return `${prefix}${code}*${Math.round(amount)}#`
}

// ─── Simple SVG QR placeholder (real QR via img.uhohstinky.com or similar) ───
function MomoQRBlock({ momo, amount, sellerName }: { momo: string; amount: number; sellerName: string }) {
  const ussd = buildKioskMoMoUssd(momo, amount)
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(ussd).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const dialNow = () => {
    window.location.href = `tel:${encodeURIComponent(ussd)}`
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-3 text-center">
      <div className="flex justify-between text-sm">
        <span className="text-slate-500">Amount to pay:</span>
        <span className="font-bold text-slate-900">{amount.toLocaleString("en")} RWF</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-slate-500">Seller:</span>
        <span className="font-bold text-slate-900 truncate max-w-[180px]">{sellerName}</span>
      </div>

      <p className="text-xs text-slate-500 mt-2">Scan QR code with your phone camera</p>
      <div className="bg-white p-4 rounded-lg inline-block border-2 border-gray-200">
        <QRCode value={ussd} size={200} />
      </div>

      <p className="text-xs text-slate-500">USSD code (dial on your phone):</p>
      <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-mono text-slate-800 text-center">
        {ussd}
      </div>

      <div className="flex gap-2 justify-center">
        <button
          type="button"
          onClick={copy}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm text-slate-700 hover:bg-gray-50 transition"
        >
          {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
          {copied ? "Copied!" : "Copy number"}
        </button>
        <button
          type="button"
          onClick={dialNow}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm text-slate-700 hover:bg-gray-50 transition"
        >
          <Smartphone className="w-4 h-4" />
          Dial now
        </button>
      </div>

      <p className="text-xs text-amber-700 bg-amber-100 rounded-xl p-2 mt-2">
        <strong>Note:</strong> After completing the MoMo payment, tap <strong>"Confirm Order"</strong> below to send your order to the kitchen.
      </p>
    </div>
  )
}

// ─── Card payment UI ──────────────────────────────────────────────────────────
function CardPaymentBlock() {
  return (
    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 space-y-3">
      <p className="text-sm font-semibold text-blue-800">💳 Pay by Card at the counter</p>
      <p className="text-sm text-blue-700">
        Please proceed to the counter with your order number. Our staff will process your card payment there.
      </p>
      <div className="rounded-xl border border-blue-200 bg-white px-4 py-3 text-xs text-slate-500">
        Accepted: Visa · Mastercard · Debit cards
      </div>
    </div>
  )
}

// ─── Cash payment UI ─────────────────────────────────────────────────────────
function CashPaymentBlock({ amount }: { amount: number }) {
  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 space-y-2">
      <p className="text-sm font-semibold text-emerald-800">💵 Pay Cash at the counter</p>
      <p className="text-sm text-emerald-700">
        Bring <strong>{amount.toLocaleString("en")} RWF</strong> to the counter when your order number is called.
      </p>
      <p className="text-xs text-emerald-600">
        Please have the exact amount ready to speed up service.
      </p>
    </div>
  )
}

// ─── Main checkout page ───────────────────────────────────────────────────────
export function KioskCheckoutPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const items = useCartStore((s) => s.items)
  const tableInfo = useCartStore((s) => s.tableInfo)
  const clear = useCartStore((s) => s.clear)

  const [payment, setPayment] = useState<PayMethod>("CASH")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sellerMomoFallback, setSellerMomoFallback] = useState<string>("")

  const kioskCategory = (searchParams.get("kioskCategory") as KioskCategory | null) ?? "BAR"
  const nickname = searchParams.get("nickname") ?? ""
  /** Full guest context whenever order type was chosen on the menu gate / home */
  const kioskTableInfo = tableInfo?.orderType ? tableInfo : null

  const total = useMemo(
    () => Math.round(items.reduce((sum, it) => sum + it.price * it.qty, 0)),
    [items],
  )

  // Gather seller info from first item (for MoMo)
  const sellerName = items[0]?.supplierName ?? "Seller"
  const sellerAccount = items[0]?.supplierId ?? ""
  const sellerMomoFromCart = items[0]?.momo ?? ""
  const sellerMomo = sellerMomoFromCart.trim() || sellerMomoFallback.trim()

  const cartHref = (() => {
    const sp = new URLSearchParams()
    if (kioskCategory) sp.set("kioskCategory", kioskCategory)
    if (nickname) sp.set("nickname", nickname)
    return sp.toString() ? `/self-order/cart?${sp.toString()}` : "/self-order/cart"
  })()

  const handleConfirm = async () => {
    if (!items.length) return
    setSubmitting(true)
    setError(null)
    try {
      const lines: KioskOrderLine[] = items.map((it) => ({
        item_code: it.itemCode ?? it.id,
        item_name: it.name,
        quantity: it.qty,
        unit: it.unit ?? it.selectedUnit ?? "",
        unit_price: it.price,
        line_total: it.price * it.qty,
        seller_account: it.supplierId,
        ...(it.itemEmballage ? { item_emballage: it.itemEmballage } : {}),
      }))

      const payload: KioskOrderPayload = {
        buyer_account: undefined,
        table_number: kioskTableInfo?.tableNumber,
        customer_name: kioskTableInfo?.customerName,
        order_type: kioskTableInfo?.orderType ?? "dine-in",
        payment_method: payment,
        kiosk_category: kioskCategory,
        items: lines,
        total_amount: total,
        currency: "RWF",
        location_id: undefined,
      }

      const res = await fetch("/api/kiosk/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.ok === false) {
        setError(data.error || "Failed to place order")
        return
      }

      clear()
      const orderId = data.orderId ?? data.order_id
      const search = new URLSearchParams()
      if (orderId) search.set("orderId", String(orderId))
      router.push(`/self-order/status?${search.toString()}`)
    } catch (e: any) {
      setError(e?.message || "Unexpected error")
    } finally {
      setSubmitting(false)
    }
  }

  // If cart line doesn't have momo, fetch it from supplier profile (same idea as cart-summary)
  useEffect(() => {
    if (payment !== "MOMO") return
    if (!items.length) return
    if (sellerMomoFromCart.trim()) return
    if (!sellerAccount.trim()) return

    let cancelled = false
    setSellerMomoFallback("")
    fetch(`/api/account/profile?account=${encodeURIComponent(sellerAccount)}`)
      .then((res) => res.json())
      .then((data) => {
        const momo = data?.ok && data?.profile?.momo ? String(data.profile.momo).trim() : ""
        if (!cancelled) setSellerMomoFallback(momo)
      })
      .catch(() => {
        if (!cancelled) setSellerMomoFallback("")
      })

    return () => {
      cancelled = true
    }
  }, [payment, items, sellerAccount, sellerMomoFromCart])

  const categoryEmoji = kioskCategory === "BAR" ? "🍺" : "🍽"

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-red-600 text-white shadow-md">
        <div className="flex items-center gap-3 px-4 py-3 max-w-4xl mx-auto">
          <button
            type="button"
            onClick={() => router.push(cartHref)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/30 text-xs font-semibold hover:bg-white/10 transition"
          >
            <ChevronLeft className="w-4 h-4" />
            ← Menu
          </button>
          <div className="flex items-center gap-2 flex-1">
            <span className="text-lg">{categoryEmoji}</span>
            <div>
              <p className="font-bold text-sm leading-tight">Confirm your order</p>
              <p className="text-white/70 text-xs">
                {items.length} item{items.length !== 1 ? "s" : ""} · {total.toLocaleString("en")} RWF
              </p>
            </div>
          </div>
          {/* (Label is already provided in the left button) */}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-4 py-5 max-w-4xl mx-auto w-full grid md:grid-cols-[3fr,2fr] gap-5">

        {/* Left: order items with images */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Order items</h2>
          {items.length === 0 && (
            <p className="text-sm text-slate-400">No items. <button className="text-red-600 underline" onClick={() => router.push(cartHref)}>Go back</button></p>
          )}
          {items.map((line) => (
            <div
              key={line.id + (line.selectedUnit ?? "")}
              className="flex items-center gap-3 rounded-2xl bg-white border border-gray-100 p-3 shadow-sm"
            >
              {/* Image */}
              <div className="h-14 w-14 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                {line.image ? (
                   
                  <img src={line.image} alt={line.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-xl text-gray-300">
                    {kioskCategory === "BAR" ? "🍺" : "🍽"}
                  </div>
                )}
              </div>
              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 line-clamp-1">{line.name}</p>
                <p className="text-xs text-gray-400">{line.qty} × {line.price.toLocaleString("en")} RWF</p>
              </div>
              <p className="text-sm font-bold text-red-600 flex-shrink-0">
                {(line.price * line.qty).toLocaleString("en")} RWF
              </p>
            </div>
          ))}
        </div>

        {/* Right: payment + confirm */}
        <div className="space-y-4">
          <div className="rounded-2xl bg-white border border-gray-100 p-4 shadow-sm space-y-4">
            <h2 className="text-base font-semibold text-slate-900">Order details</h2>

            {/* Guest / table — always show when we know order type so staff can identify the order */}
            {kioskTableInfo && (
              <div className="text-sm text-slate-700 space-y-2 border-t pt-3">
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500 shrink-0">Name</span>
                  <span className="font-semibold text-right break-words">
                    {kioskTableInfo.customerName?.trim()
                      ? kioskTableInfo.customerName.trim()
                      : "—"}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500 shrink-0">Table</span>
                  <span className="font-semibold text-right break-words">
                    {kioskTableInfo.tableNumber?.trim()
                      ? kioskTableInfo.tableNumber.trim()
                      : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Type</span>
                  <span className="font-semibold capitalize">
                    {kioskTableInfo.orderType === "takeaway" ? "Take away" : "Dine in"}
                  </span>
                </div>
              </div>
            )}

            {/* Payment method selector */}
            <div className="space-y-2 border-t pt-3">
              <p className="text-sm text-slate-600 font-medium">Payment method</p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { id: "CARD" as PayMethod, label: "Card", Icon: CreditCard },
                  { id: "CASH" as PayMethod, label: "Cash", Icon: Banknote },
                  { id: "MOMO" as PayMethod, label: "MoMo", Icon: Smartphone },
                ]).map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setPayment(id)}
                    className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border-2 text-xs font-semibold transition ${
                      payment === id
                        ? "border-red-500 bg-red-50 text-red-600"
                        : "border-gray-200 bg-white text-slate-600 hover:border-red-200"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Total */}
            <div className="flex items-center justify-between text-base font-bold border-t pt-3">
              <span className="text-slate-700">Total</span>
              <span className="text-red-600">{total.toLocaleString("en")} RWF</span>
            </div>
          </div>

          {/* Payment-specific UI */}
          {payment === "MOMO" && sellerMomo && (
            <MomoQRBlock momo={sellerMomo} amount={total} sellerName={sellerName} />
          )}
          {payment === "MOMO" && !sellerMomo && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
              📱 Pay via MoMo at the counter. Staff will provide the payment number.
            </div>
          )}
          {payment === "CARD" && <CardPaymentBlock />}
          {payment === "CASH" && <CashPaymentBlock amount={total} />}

          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Confirm button */}
          <button
            type="button"
            disabled={!items.length || submitting}
            onClick={handleConfirm}
            className="w-full h-12 text-base font-bold bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-2xl shadow-lg flex items-center justify-center gap-2 transition"
          >
            {submitting ? (
              <>
                <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                Placing order…
              </>
            ) : (
              "Confirm order"
            )}
          </button>

          {/* Back link */}
          <button
            type="button"
            onClick={() => router.push(cartHref)}
            className="w-full text-sm text-slate-500 hover:text-red-600 transition text-center py-1"
          >
            ← Back to cart
          </button>
        </div>
      </main>
    </div>
  )
}
