// app/supplier/orders/[orderId]/page.tsx
"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Phone, User2, RotateCw, CreditCard } from "lucide-react"
import { useAuthStore } from "@/lib/auth-store"
import dynamic from "next/dynamic"
import { formatSupplierOrderPaymentDisplay, getPaymentMethodIcon } from "@/lib/payment-utils"
import { isTableCommandOrder, normalizeTableCommandPerson, type TableCommandLineItem } from "@/lib/table-command-whatsapp"
import { TableCommandOrderItems } from "@/components/supplier/table-command-order-items"

type Detail = { order?: any; items?: any[]; seller?: any; buyer?: any }

const QRCode = dynamic(() => import("react-qr-code"), { ssr: false })

function pickAnyNum(row: Record<string, unknown>, ...keys: string[]): number | null {
  for (const k of keys) {
    const v = row[k]
    if (v == null || String(v).trim() === "") continue
    const n = Number(v)
    if (!Number.isNaN(n)) return n
  }
  return null
}

function pickAnyStr(row: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k]
    if (v != null && String(v).trim() !== "") return String(v).trim()
  }
  return ""
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

  // Poll Urubuto settlement while order payment is still pending (webhooks may not reach localhost).
  useEffect(() => {
    const payName = (detail?.order?.PAYMENT_NAME ?? "").toString().toUpperCase()
    const paySt = (detail?.order?.PAYMENT_STATUS ?? "").toString().toUpperCase()
    if (!orderId || !payName.includes("URUBUTO") || paySt === "PAID" || paySt === "FAILED") {
      return
    }
    const tick = async () => {
      try {
        const r = await fetch("/api/orders/payment-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId }),
          cache: "no-store",
        })
        const j = await r.json()
        if (j?.ok && (j.status === "paid" || j.status === "failed")) {
          await load()
        }
      } catch {
        /* ignore */
      }
    }
    void tick()
    const id = setInterval(() => void tick(), 4000)
    return () => clearInterval(id)
  }, [orderId, detail?.order?.PAYMENT_NAME, detail?.order?.PAYMENT_STATUS, load])

  // --- helpers ---
  const qtyOf = (it: any) => Number(it.QUANTITY ?? it.qty ?? it.quantity ?? 0)
  const requestedPriceOf = (it: any) =>
    Number(it.REQUEST_PRICE ?? it.request_price ?? it.UNIT_PRICE ?? it.unitPrice ?? it.price ?? 0)
  const servedPriceOf = (it: any) =>
    Number(it.UNITY_PRICE ?? it.unity_price ?? it.SERVED_AMOUNT ?? it.servedAmount ?? it.UNIT_PRICE ?? it.unitPrice ?? 0)
  const unitOf = (it: any) => String(it.UNIT ?? it.unit ?? it.measurement ?? "")
  const totalRequestedOf = (it: any) => Math.round(qtyOf(it) * requestedPriceOf(it))
  const n = (v: number) => Number(v || 0).toLocaleString()

  const { order, buyer, items, rawItems, isTableCommand, tableCommandItems, lineMetaById, currency, grandTotal, servedOrderAmount, orderNote, paymentInfo, isGuestBuyer, displayBuyerName } = useMemo(() => {
    const order = detail?.order
    const buyer = detail?.buyer
    const rawItems = detail?.items ?? []
    const currency = order?.CURRENCY || "RWF"
    const isTableCommand = isTableCommandOrder({
      IS_TABLE_COMMAND: order?.IS_TABLE_COMMAND,
      TABLE_NAME: order?.TABLE_NAME,
      buyerLocation: order?.DELIVERY_LOCATION,
    })

    const lineMetaById = new Map<number, { servedQty: number; requestedPrice: number; servedPrice: number; code: string }>()
    rawItems.forEach((it: any, index: number) => {
      const lineId = Number(it.ID_LIST ?? it.lineId ?? 0)
      if (!lineId) return
      const servedQty =
        pickAnyNum(it as Record<string, unknown>, "CONFIRMED_RECEIVED_QTY", "SERVED_QTY", "servedQty", "CONFIRMED_QTY") ?? 0
      lineMetaById.set(lineId, {
        servedQty,
        requestedPrice: requestedPriceOf(it),
        servedPrice: servedPriceOf(it),
        code: String(it.ITEM_CODE ?? it.code ?? `${index}`),
      })
    })

    const tableCommandItems: TableCommandLineItem[] = isTableCommand
      ? rawItems.map((it: any) => ({
          name: String(it.ITEM_NAME ?? it.name ?? "-"),
          qty: qtyOf(it),
          unitPrice: requestedPriceOf(it),
          orderedBy: normalizeTableCommandPerson(it.ORDERED_BY ?? it.orderedBy),
          lineId: Number(it.ID_LIST ?? it.lineId ?? 0) || undefined,
        }))
      : []

    // Non-table: combine items that share the same code and name
    const groupedMap = new Map<string, any>()
    if (!isTableCommand) {
      rawItems.forEach((it: any, index: number) => {
        const code = it.ITEM_CODE ?? it.code ?? `${index}`
        const name = it.ITEM_NAME ?? it.name ?? "-"
        const key = `${code}||${name}||${buyer?.OWNER || ""}`
        const existing = groupedMap.get(key)
        if (existing) {
          const merged = { ...existing }
          const newQty = qtyOf(existing) + qtyOf(it)
          const servedExisting =
            Number((existing as any).CONFIRMED_RECEIVED_QTY ?? (existing as any).SERVED_QTY ?? 0) || 0
          const servedLine =
            Number((it as any).CONFIRMED_RECEIVED_QTY ?? (it as any).SERVED_QTY ?? 0) || 0
          const newServed = servedExisting + servedLine
          if ("QUANTITY" in merged) merged.QUANTITY = newQty
          if ("qty" in merged) merged.qty = newQty
          if ("quantity" in merged) merged.quantity = newQty
          ;(merged as any).CONFIRMED_RECEIVED_QTY = newServed
          ;(merged as any).SERVED_QTY = newServed
          groupedMap.set(key, merged)
        } else {
          groupedMap.set(key, { ...it })
        }
      })
    }

    const items = isTableCommand ? rawItems : Array.from(groupedMap.values())
    const grandTotal = items.reduce((sum, it) => sum + totalRequestedOf(it), 0)
    const servedOrderAmount =
      pickAnyNum(order ?? {}, "SERVED_AMOUNT", "servedAmount", "AMOUNT_SERVED", "SERVED_TOTAL") ?? 0
    const orderNote = pickAnyStr(order ?? {}, "CONDITIONS", "ORDER_NOTE", "orderNote", "NOTE")

    // Get payment status
    const paymentInfo = formatSupplierOrderPaymentDisplay(order?.PAYMENT_NAME, order?.PAYMENT_STATUS)

    // Prefer explicit buyer identity fields; only show "Guest Buyer" when no usable identity exists.
    const buyerEmail = String(order?.BUYER_EMAIL || buyer?.EMAIL || "").trim()
    const buyerAccount = String(order?.BUYER_ISHYIGA_ACCOUNT || buyer?.ISHYIGA_ACCOUNT || "").trim()
    const buyerPhone = String(order?.BUYER_PHONE || buyer?.PHONE || order?.BUYER_TEL || "").trim()

    // Never show seller name as buyer (fix for wrong data or seller placing test order)
    const rawBuyer = (
      order?.OWNER ??
      order?.BUYER_OWNER_NAME ??
      order?.BUYER_OWNER ??
      order?.BUYER_NAMES ??
      order?.BUYER_NAME ??
      buyer?.OWNER ??
      buyer?.NAMES ??
      "Guest Buyer"
    ).toString().trim()
    const sellerName = (order?.SELLER_NAMES ?? detail?.seller?.OWNER ?? "").toString().trim()
    const sameAsSeller = sellerName && rawBuyer && sellerName.toLowerCase() === rawBuyer.toLowerCase()
    const cleanBuyerName = !rawBuyer || /^na$/i.test(rawBuyer) ? "" : rawBuyer
    const hasIdentity = Boolean(cleanBuyerName || buyerAccount || buyerPhone || buyerEmail)
    const guestByEmail = buyerEmail.toLowerCase().startsWith("guest_")
    const isGuestBuyer = guestByEmail || !hasIdentity
    const displayBuyerName = sameAsSeller
      ? (order?.TABLE_NAME ? `Table: ${order.TABLE_NAME}` : "Guest Buyer")
      : (cleanBuyerName || (buyerAccount ? `Buyer ${buyerAccount}` : "Guest Buyer"))

    return { order, buyer, items, rawItems, isTableCommand, tableCommandItems, lineMetaById, currency, grandTotal, servedOrderAmount, orderNote, paymentInfo, isGuestBuyer, displayBuyerName }
  }, [detail])

  const sellerMomo = (detail?.seller?.momo ?? "").toString().trim()
  const isUrubutoOrder = (order?.PAYMENT_NAME ?? "").toString().toUpperCase().includes("URUBUTO")
  const showMomoQR = !!sellerMomo && !isUrubutoOrder
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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold break-words">Order #{orderId}</h1>
            <p className="text-slate-600 text-sm sm:text-base">All details for this order</p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button variant="ghost" onClick={load} disabled={loading} className="gap-2">
              <RotateCw className="h-4 w-4" /> Refresh
            </Button>
            <Button variant="ghost" onClick={() => router.push("/supplier/orders")} className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Back
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
                  <CardTitle>Order Summary</CardTitle>
                </CardHeader>
                <CardContent className="grid sm:grid-cols-2 gap-3">
                  <div className="rounded-md border p-3">
                    <div className="text-sm text-slate-600">Payment</div>
                    <div className="font-medium flex items-center gap-2">
                      <span aria-hidden>{getPaymentMethodIcon(order.PAYMENT_NAME || "")}</span>
                      {paymentInfo.methodLabel}
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
                    <span>{order?.BUYER_PHONE || buyer?.TEL || buyer?.PHONE || order?.BUYER_TEL || "Not provided"}</span>
                  </div>
                  {/* <div className="flex items-center gap-2 text-slate-700">
                    <MapPin className="h-4 w-4" />
                    <span>{order?.DELIVERY_LOCATION || "Not provided"}</span>
                  </div> */}
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
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <CardTitle>Items</CardTitle>
                    <CardDescription>
                      {isTableCommand
                        ? `${rawItems.length} line${rawItems.length === 1 ? "" : "s"} · grouped by guest`
                        : `${items.length} item${items.length === 1 ? "" : "s"}`}
                    </CardDescription>
                  </div>
                  {isTableCommand ? (
                    <Badge variant="secondary" className="bg-sky-100 text-sky-800 border-sky-200">
                      Table command
                    </Badge>
                  ) : null}
                </div>
              </CardHeader>

              <CardContent className="p-4 sm:p-6">
                {isTableCommand ? (
                  <>
                    <TableCommandOrderItems
                      items={tableCommandItems}
                      lineMetaById={lineMetaById}
                      currency={currency}
                      formatAmount={n}
                    />
                    <div className="mt-4 space-y-1 border-t pt-4 text-sm text-slate-600 sm:text-right">
                      <div>Total Requested Price: {n(grandTotal)} {currency}</div>
                      <div>Total Served Price: {n(servedOrderAmount)} {currency}</div>
                      {orderNote ? <div>Order Note: {orderNote}</div> : null}
                    </div>
                  </>
                ) : (
                <>
                {/* Mobile: card layout */}
                <div className="md:hidden space-y-3">
                  {items.map((it: any, i: number) => {
                    const code = it.ITEM_CODE ?? it.code ?? `${i}`
                    const name = it.ITEM_NAME ?? it.name ?? "-"
                    const qty = qtyOf(it)
                    const servedQty =
                      pickAnyNum(it as Record<string, unknown>, "CONFIRMED_RECEIVED_QTY", "SERVED_QTY", "servedQty", "CONFIRMED_QTY") ?? 0
                    const requestedPrice = requestedPriceOf(it)
                    const servedPrice = servedPriceOf(it)
                    const totalRequested = totalRequestedOf(it)
                    const totalServed = servedQty * servedPrice
                    return (
                      <div key={`mobile-${code}-${name}-${i}`} className="rounded-lg border bg-white p-3 space-y-3">
                        <div>
                          <div className="font-medium text-slate-900">{name}</div>
                          <div className="text-xs text-slate-500 break-all">{code}</div>
                        </div>
                        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                          <div>
                            <dt className="text-xs text-slate-500 uppercase">Qty</dt>
                            <dd className="font-mono tabular-nums">{n(qty)}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-slate-500 uppercase">Served Qty</dt>
                            <dd className="font-mono tabular-nums">{n(servedQty)}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-slate-500 uppercase">Requested Price</dt>
                            <dd className="font-mono tabular-nums">{n(requestedPrice)}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-slate-500 uppercase">Served Price</dt>
                            <dd className="font-mono tabular-nums">{n(servedPrice)}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-slate-500 uppercase">Total Requested</dt>
                            <dd className="font-mono tabular-nums font-medium">{n(totalRequested)} {currency}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-slate-500 uppercase">Total Served</dt>
                            <dd className="font-mono tabular-nums font-medium">{n(totalServed)} {currency}</dd>
                          </div>
                        </dl>
                      </div>
                    )
                  })}
                  <div className="rounded-lg border bg-slate-50 px-3 py-2 text-right font-bold font-mono tabular-nums">
                    Total: {n(grandTotal)} {currency}
                  </div>
                </div>

                {/* Desktop: table */}
                <div className="hidden md:block overflow-x-auto -mx-2 sm:mx-0">
                <table className="w-full min-w-[44rem] text-sm">
                  <thead className="border-b">
                    <tr className="[&>th]:py-2 [&>th]:px-3 text-xs text-slate-500 uppercase tracking-wide">
                      <th className="text-left pl-0 w-28">Code</th>
                      <th className="text-left">Item</th>
                      <th className="text-right w-20">Qty</th>
                      <th className="text-right w-24">Served Qty</th>
                      <th className="text-right w-28">Requested Price</th>
                      <th className="text-right w-28">Served Price</th>
                      <th className="text-right w-32">Total Requested</th>
                      <th className="text-right w-32 pr-0">Total Served</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y">
                  {items.map((it: any, i: number) => {
                      const code = it.ITEM_CODE ?? it.code ?? `${i}`
                      const name = it.ITEM_NAME ?? it.name ?? "-"
                      const qty = qtyOf(it)
                      const servedQty =
                        pickAnyNum(it as Record<string, unknown>, "CONFIRMED_RECEIVED_QTY", "SERVED_QTY", "servedQty", "CONFIRMED_QTY") ?? 0
                      const requestedPrice = requestedPriceOf(it)
                      const servedPrice = servedPriceOf(it)
                      const totalRequested = totalRequestedOf(it)
                      const totalServed = servedQty * servedPrice

                      return (
                        <tr key={`${code}-${name}-${buyer?.OWNER || "anon"}`}>
                          <td className="py-2 px-3 pl-0 align-middle">{code}</td>
                          <td className="py-2 px-3 align-middle">{name}</td>
                          <td className="py-2 px-3 text-right align-middle font-mono tabular-nums">
                            {n(qty)}
                          </td>
                          <td className="py-2 px-3 text-right align-middle font-mono tabular-nums">
                            {n(servedQty)}
                          </td>
                          <td className="py-2 px-3 text-right align-middle font-mono tabular-nums">
                            {n(requestedPrice)}
                          </td>
                          <td className="py-2 px-3 text-right align-middle font-mono tabular-nums">
                            {n(servedPrice)}
                          </td>
                          <td className="py-2 px-3 text-right align-middle font-mono tabular-nums">
                            {n(totalRequested)}
                          </td>
                          <td className="py-2 pr-0 pl-3 text-right align-middle font-mono tabular-nums">
                            {n(totalServed)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>

                  <tfoot>
                    <tr className="border-t">
                      <td colSpan={8} className="py-3 pr-4 text-right font-semibold">
                        Total
                      </td>
                      <td className="py-3 pr-0 text-right font-bold font-mono tabular-nums">
                        {n(grandTotal)} {currency}
                      </td>
                    </tr>
                  </tfoot>
                </table>
                </div>
                {(() => {
                  const totals = items.reduce(
                    (acc, it: any) => {
                      const qty = qtyOf(it)
                      const servedQty =
                        pickAnyNum(it as Record<string, unknown>, "CONFIRMED_RECEIVED_QTY", "SERVED_QTY", "servedQty", "CONFIRMED_QTY") ?? 0
                      const requestedPrice = requestedPriceOf(it)
                      const servedPrice = servedPriceOf(it)
                      acc.requested += qty * requestedPrice
                      acc.served += servedQty * servedPrice
                      return acc
                    },
                    { requested: 0, served: 0 }
                  )
                  return (
                    <div className="mt-3 text-right space-y-1">
                      <div className="text-sm text-slate-600">
                        Total Requested Price: {n(totals.requested)} {currency}
                      </div>
                      <div className="text-sm text-slate-600">
                        Total Served Price: {n(totals.served)} {currency}
                      </div>
                    </div>
                  )
                })()}
                <div className="mt-3 text-right space-y-1">
                  {orderNote && <div className="text-sm text-slate-600">Order Note: {orderNote}</div>}
                </div>
                </>
                )}
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
                    <div className="font-medium">{paymentInfo.methodLabel}</div>
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
                      <div className="text-sm text-slate-600">IHUTE reference</div>
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