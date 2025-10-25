// app/supplier/orders/[orderId]/page.tsx
"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Phone, MapPin, User2, RotateCw } from "lucide-react"
import { useAuthStore } from "@/lib/auth-store"

type Detail = { order?: any; items?: any[]; seller?: any; buyer?: any }

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

  const { order, buyer, items, created, currency, grandTotal } = useMemo(() => {
    const order = detail?.order
    const buyer = detail?.buyer
    const items = detail?.items ?? []
    const created = order?.CREATED_AT
      ? new Date(typeof order.CREATED_AT === "number" ? order.CREATED_AT : order.CREATED_AT)
      : null
    const currency = order?.CURRENCY || "RWF"
    const grandTotal = items.reduce((sum, it) => sum + totalOf(it), 0)
    return { order, buyer, items, created, currency, grandTotal }
  }, [detail])

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
              <CardTitle>Couldn’t load order</CardTitle>
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
                    <Badge variant="secondary">{order.PAYMENT_NAME || "PAY_ON_DELIVERY"}</Badge>
                  </div>
                  <CardDescription>{created ? created.toLocaleString() : ""}</CardDescription>
                </CardHeader>
                <CardContent className="grid sm:grid-cols-3 gap-3">
                  <div className="rounded-md border p-3">
                    <div className="text-sm text-slate-600">Status</div>
                    <div className="font-medium">{order.ORDER_STATUS || "OPEN"}</div>
                  </div>
                  <div className="rounded-md border p-3">
                    <div className="text-sm text-slate-600">Amount</div>
                    <div className="font-bold text-lg">
                      {n(Number(order.AMOUNT || grandTotal || 0))} {currency}
                    </div>
                  </div>
                  <div className="rounded-md border p-3">
                    <div className="text-sm text-slate-600">Delivery</div>
                    <div className="font-medium">{order.DELIVERY_LOCATION || "NA"}</div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Buyer</CardTitle>
                  <CardDescription>Contact & identity</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2 text-slate-800">
                    <User2 className="h-4 w-4" />
                    <span>{buyer?.OWNER || buyer?.NAMES || "GUEST"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-700">
                    <Phone className="h-4 w-4" />
                    <span>{buyer?.PHONE || "NA"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-700">
                    <MapPin className="h-4 w-4" />
                    <span>{order?.DELIVERY_LOCATION || "NA"}</span>
                  </div>
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
          <th className="text-right w-20">Qty</th>
          {/* Unit removed */}
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

          return (
            <tr key={code}>
              <td className="py-2 px-3 pl-0 align-middle">{code}</td>
              <td className="py-2 px-3 align-middle">{name}</td>
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
          {/* Header now has 5 columns (Code, Item, Qty, Unit Price, Total) */}
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

          </>
        )}
      </main>
      <Footer />
    </div>
  )
}
