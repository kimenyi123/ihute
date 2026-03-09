// app/supplier/orders/[orderId]/page.tsx
"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Phone, MapPin, User2, RotateCw, CreditCard, Truck } from "lucide-react"
import { useAuthStore } from "@/lib/auth-store"
import dynamic from "next/dynamic"

type Detail = { order?: any; items?: any[]; seller?: any; buyer?: any }

const QRCode = dynamic(() => import("react-qr-code"), { ssr: false })

// Improved payment status detection
function getPaymentStatus(order: any): { status: string; displayName: string; isPaid: boolean } {
  const paymentName = (order?.PAYMENT_NAME || "").toLowerCase()
  const paymentStatus = (order?.PAYMENT_STATUS || "").toLowerCase()
  
  // Check if payment is marked as PAID in database
  if (paymentStatus === 'paid') {
    return { 
      status: 'paid', 
      displayName: 'Paid via MoMo', 
      isPaid: true 
    }
  }
  
  // Check payment method
  if (paymentName.includes('momo') || paymentName.includes('mtn') || paymentName.includes('mobile money')) {
    return { 
      status: 'processing', 
      displayName: 'MoMo Payment', 
      isPaid: false 
    }
  }
  
  if (paymentName.includes('pay on delivery') || paymentName.includes('cod')) {
    return { 
      status: 'pending', 
      displayName: 'Pay on Delivery', 
      isPaid: false 
    }
  }
  
  // Default fallback
  return {
    status: paymentStatus || 'pending',
    displayName: order?.PAYMENT_NAME || 'Pending',
    isPaid: paymentStatus === 'paid'
  }
}

// Improved order status with payment consideration
function getOrderStatus(order: any, paymentInfo: any) {
  const orderStatus = (order?.ORDER_STATUS || "").toLowerCase()
  
  if (orderStatus.includes('delivered')) return { status: 'delivered', displayName: 'Delivered' }
  if (orderStatus.includes('transit') || orderStatus.includes('shipped')) return { status: 'in-transit', displayName: 'In Transit' }
  if (orderStatus.includes('processing')) return { status: 'processing', displayName: 'Processing' }
  
  // If payment is completed but order status is still open/pending
  if (paymentInfo.isPaid && (orderStatus.includes('open') || orderStatus.includes('pending'))) {
    return { status: 'processing', displayName: 'Processing Payment' }
  }
  
  return { status: 'pending', displayName: 'Pending' }
}

export default function SupplierOrderDetailsPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const router = useRouter()

  // --- auth store (persisted) ---
  const { isAuthenticated, user } = useAuthStore()
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    // Zustand persist hydration awareness
    const setNow = () => setHydrated(true)
    setHydrated(!!useAuthStore.persist?.hasHydrated?.())
    const unsub = useAuthStore.persist?.onFinishHydration?.(setNow)
    return () => { unsub?.() }
  }, [])

  // --- UI state ---
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detail, setDetail] = useState<Detail | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // --- route guards (run only after hydration) ---
  useEffect(() => {
    if (!hydrated) return
    if (!isAuthenticated) {
      router.push("/login")
      return
    }
    if (user?.role !== "supplier") {
      router.push("/")
    }
  }, [hydrated, isAuthenticated, user?.role, router])

  // --- fetch details ---
  const load = useCallback(async () => {
    if (!orderId) return
    if (!hydrated) return // wait for store
    // we *can* load with just orderId; add sellerAccount if present for best path
    const payload: Record<string, any> = { orderId }
    if (user?.ishyigaAccount) payload.sellerAccount = user.ishyigaAccount

    // cancel in-flight
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/seller-orders/details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        cache: "no-store",
        signal: abortRef.current.signal,
      })
      const json = await res.json()
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || `Failed (${res.status})`)
      }
      setDetail({
        order: json.order,
        items: Array.isArray(json.items) ? json.items : [],
        seller: json.seller,
        buyer: json.buyer,
      })
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        setError(e?.message || "Failed to load order")
      }
    } finally {
      setLoading(false)
    }
  }, [orderId, hydrated, user?.ishyigaAccount])

  useEffect(() => {
    load()
    return () => abortRef.current?.abort()
  }, [load])

  // --- helpers ---
  const qtyOf = (it: any) => Number(it.QUANTITY ?? it.qty ?? it.quantity ?? 0)
  const unitPriceOf = (it: any) =>
    Number(it.UNIT_PRICE ?? it.UNITY_PRICE ?? it.REQUEST_PRICE ?? it.unitPrice ?? it.price ?? 0)
  const unitOf = (it: any) => String(it.UNIT ?? it.unit ?? it.measurement ?? "")
  const totalOf = (it: any) => Math.round(qtyOf(it) * unitPriceOf(it))
  const n = (v: number) => Number(v || 0).toLocaleString()

  const { order, buyer, items, created, currency, grandTotal, paymentInfo, orderStatus, isGuestBuyer, displayBuyerName } = useMemo(() => {
    const order = detail?.order
    const buyer = detail?.buyer
    const items = detail?.items ?? []
    const created = order?.CREATED_AT
      ? new Date(typeof order.CREATED_AT === "number" ? order.CREATED_AT : order.CREATED_AT)
      : null
    const currency = order?.CURRENCY || "RWF"
    const grandTotal = items.reduce((sum, it) => sum + totalOf(it), 0)

    // Get payment and order status
    const paymentInfo = getPaymentStatus(order)
    const orderStatus = getOrderStatus(order, paymentInfo)

    // Detect if buyer is a guest (anonymous checkout)
    const buyerEmail = order?.BUYER_EMAIL || buyer?.EMAIL || ""
    const isGuestBuyer = buyerEmail.startsWith("guest_") || !order?.BUYER_ISHYIGA_ACCOUNT

    // Never show seller name as buyer (fix for wrong data or seller placing test order)
    const rawBuyer = (order?.BUYER_OWNER ?? order?.BUYER_NAME ?? buyer?.OWNER ?? buyer?.NAMES ?? "Guest Buyer").toString().trim()
    const sellerName = (order?.SELLER_NAMES ?? detail?.seller?.OWNER ?? "").toString().trim()
    const sameAsSeller = sellerName && rawBuyer && sellerName.toLowerCase() === rawBuyer.toLowerCase()
    const displayBuyerName = sameAsSeller ? (order?.TABLE_NAME ? `Table: ${order.TABLE_NAME}` : "Guest Buyer") : (rawBuyer || "Guest Buyer")

    return { order, buyer, items, created, currency, grandTotal, paymentInfo, orderStatus, isGuestBuyer, displayBuyerName }
  }, [detail])

  const sellerMomo = (detail?.seller?.momo ?? "").toString().trim()
  const showMomoQR = !!sellerMomo
  const momoAmount = Number(order?.AMOUNT || grandTotal || 0)
  const momoPayload = showMomoQR ? `*182*8*1*${sellerMomo}*${momoAmount}#` : ""

  // --- initial skeleton while store hydrates ---
  if (!hydrated) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <Card><CardHeader><CardTitle>Loading session…</CardTitle></CardHeader></Card>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Order #{orderId}</h1>
            <p className="text-slate-600">All details for this order</p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={load} disabled={loading} className="gap-2">
              <RotateCw className="h-4 w-4" /> Refresh
            </Button>
            <Button variant="ghost" onClick={() => router.push("/supplier/orders")} className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Back to Orders
            </Button>
          </div>
        </div>

        {loading && (
          <Card><CardHeader><CardTitle>Loading…</CardTitle></CardHeader></Card>
        )}

        {error && (
          <Card>
            <CardHeader>
              <CardTitle>Couldn't load order</CardTitle>
              <CardDescription className="text-destructive">{error}</CardDescription>
            </CardHeader>
          </Card>
        )}

        {!loading && !error && order && (
          <>
            {/* Summary + Buyer */}
            <div className="grid md:grid-cols-3 gap-4">
              <Card className="md:col-span-2">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Order Summary</CardTitle>
                    <div className="flex gap-2">
                      <Badge variant={orderStatus.status === 'delivered' ? 'default' : orderStatus.status === 'in-transit' ? 'secondary' : 'outline'}>
                        {orderStatus.displayName}
                      </Badge>
                      <Badge variant={paymentInfo.isPaid ? 'default' : paymentInfo.status === 'processing' ? 'secondary' : 'outline'}>
                        {paymentInfo.isPaid ? '✅ Paid' : paymentInfo.displayName}
                      </Badge>
                    </div>
                  </div>
                  <CardDescription>{created ? created.toLocaleString() : ""}</CardDescription>
                </CardHeader>
                <CardContent className="grid sm:grid-cols-3 gap-3">
                  <div className="rounded-md border p-3">
                    <div className="text-sm text-slate-600">Status</div>
                    <div className="font-medium flex items-center gap-2">
                      {orderStatus.status === 'delivered' ? '✅' : 
                       orderStatus.status === 'in-transit' ? '🚚' : 
                       orderStatus.status === 'processing' ? '⏳' : '📦'}
                      {orderStatus.displayName}
                    </div>
                  </div>
                  <div className="rounded-md border p-3">
                    <div className="text-sm text-slate-600">Payment</div>
                    <div className="font-medium flex items-center gap-2">
                      {paymentInfo.isPaid ? '✅' : paymentInfo.status === 'processing' ? '⏳' : '💳'}
                      {paymentInfo.displayName}
                    </div>
                  </div>
                  <div className="rounded-md border p-3">
                    <div className="text-sm text-slate-600">Amount</div>
                    <div className="font-bold text-lg">
                      {n(Number(order.AMOUNT || grandTotal || 0))} {currency}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Buyer</CardTitle>
                      <CardDescription>Contact & identity</CardDescription>
                    </div>
                    {isGuestBuyer && (
                      <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200">
                        Guest
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2 text-slate-800">
                    <User2 className="h-4 w-4" />
                    <span className="font-medium">{displayBuyerName}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-700">
                    <Phone className="h-4 w-4" />
                    <span>{order?.BUYER_PHONE || buyer?.PHONE || order?.BUYER_TEL || "Not provided"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-700">
                    <MapPin className="h-4 w-4" />
                    <span>{order?.DELIVERY_LOCATION || "Not provided"}</span>
                  </div>
                  {isGuestBuyer && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded">
                        ℹ️ This buyer checked out as a guest without creating an account
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Items */}
            <Card>
              <CardHeader>
                <CardTitle>Items</CardTitle>
                <CardDescription>
                  {items.length} item{items.length === 1 ? "" : "s"}
                </CardDescription>
              </CardHeader>

              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr className="[&>th]:py-2 [&>th]:px-3 text-xs text-slate-500 uppercase tracking-wide">
                      <th className="text-left pl-0 w-28">Code</th>
                      <th className="text-left">Item</th>
                      <th className="text-left w-36">Ordered By</th>
                      <th className="text-right w-20">Qty</th>
                      <th className="text-right w-28">Unit Price</th>
                      <th className="text-right w-32 pr-0">Total</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y">
                    {items.map((it: any, i: number) => {
                      const code = it.ITEM_CODE ?? it.code ?? `${i}`
                      const name = it.ITEM_NAME ?? it.name ?? "-"
                      const qty = qtyOf(it)
                      const unitPrice = unitPriceOf(it)
                      const total = totalOf(it)
                      const orderedBy = (it.ORDERED_BY ?? buyer?.OWNER ?? "").toString().trim()

                      return (
                        <tr key={code}>
                          <td className="py-2 px-3 pl-0 align-middle">{code}</td>
                          <td className="py-2 px-3 align-middle">{name}</td>
                          <td className="py-2 px-3 align-middle text-sm text-slate-700">
                            {orderedBy || "—"}
                          </td>
                          <td className="py-2 px-3 text-right align-middle font-mono tabular-nums">
                            {n(qty)}
                          </td>
                          <td className="py-2 px-3 text-right align-middle font-mono tabular-nums">
                            {n(unitPrice)}
                          </td>
                          <td className="py-2 pr-0 pl-3 text-right align-middle font-mono tabular-nums">
                            {n(total)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>

                  <tfoot>
                    <tr className="border-t">
                      <td colSpan={4} className="py-3 pr-4 text-right font-semibold">
                        Total
                      </td>
                      <td className="py-3 pr-0 text-right font-bold font-mono tabular-nums">
                        {n(grandTotal)} {currency}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </CardContent>
            </Card>

            {/* Payment Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Payment Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-slate-600">Payment Method</div>
                    <div className="font-medium">{paymentInfo.displayName}</div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-600">Payment Status</div>
                    <div className="font-medium">
                      {paymentInfo.isPaid ? (
                        <Badge variant="default" className="bg-green-100 text-green-800">
                          ✅ Paid
                        </Badge>
                      ) : (
                        <Badge variant="outline">
                          {paymentInfo.status === 'processing' ? '⏳ Processing' : '📝 Pending'}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {order?.PAYMENT_ID && (
                    <div className="md:col-span-2">
                      <div className="text-sm text-slate-600">Payment Reference</div>
                      <div className="font-mono text-sm">{order.PAYMENT_ID}</div>
                    </div>
                  )}
                </div>

                  {showMomoQR && (
                    <div className="mt-4 pt-4 border-t space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm text-slate-600">MoMo Payment (optional)</div>
                          <div className="text-xs text-slate-500">
                            Seller MoMo: <span className="font-mono">{sellerMomo}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-slate-600">Amount</div>
                          <div className="font-semibold">
                            {n(momoAmount)} {currency}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                        <div className="bg-white p-3 rounded-lg border">
                          <QRCode value={momoPayload} size={160} />
                        </div>
                        <div className="space-y-2 text-sm">
                          <p>Scan this QR code with your phone to open the MoMo payment screen.</p>
                          <p className="font-mono text-xs break-all">Or dial: {momoPayload}</p>
                        </div>
                      </div>
                    </div>
                  )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
      <Footer />
    </div>
  )
}