"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useAuthStore } from "@/lib/auth-store"

type Detail = {
  order?: any
  items?: any[]
  seller?: any
  buyer?: any
}

export default function BuyerOrderDetailsPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const router = useRouter()
  const { isAuthenticated, user } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detail, setDetail] = useState<Detail | null>(null)

  useEffect(() => {
    if (!isAuthenticated) router.push("/login")
  }, [isAuthenticated, router])

  useEffect(() => {
    let stop = false
    async function load() {
      if (!user?.email || !orderId) return
      setLoading(true); setError(null)
      try {
        const res = await fetch("/api/orders/details", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: user.email, orderId }),
          cache: "no-store",
        })
        const json = await res.json()
        if (!res.ok || json?.ok === false) throw new Error(json?.error || "Failed to load order")
        if (!stop) setDetail({ order: json.order, items: json.items || [], seller: json.seller, buyer: json.buyer })
      } catch (e:any) {
        if (!stop) setError(e?.message || "Failed to load order")
      } finally {
        if (!stop) setLoading(false)
      }
    }
    load()
    return () => { stop = true }
  }, [user?.email, orderId])

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="container mx-auto px-4 py-8 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Order #{orderId}</h1>
            <p className="text-slate-600">All details for this order</p>
          </div>
          <Button variant="outline" onClick={() => router.push("/orders")}>Back to orders</Button>
        </div>

        {loading && <Card><CardHeader><CardTitle>Loading…</CardTitle></CardHeader></Card>}
        {error && (
          <Card>
            <CardHeader>
              <CardTitle>Couldn’t load order</CardTitle>
              <CardDescription className="text-destructive">{error}</CardDescription>
            </CardHeader>
          </Card>
        )}

        {!loading && !error && detail?.order && (
          <>
            <Card>
              <CardHeader className="flex items-center justify-between">
                <CardTitle>Summary</CardTitle>
                <Badge variant="secondary">{detail.order?.PAYMENT_NAME || "PAID"}</Badge>
              </CardHeader>
              <CardContent className="grid sm:grid-cols-3 gap-3 text-sm">
                <div>
                  <div className="text-slate-600">Seller</div>
                  <div className="font-medium">{detail.order?.SELLER_NAMES || detail.order?.SELLER_ISHYIGA_ACCOUNT}</div>
                </div>
                <div>
                  <div className="text-slate-600">Amount</div>
                  <div className="font-semibold">
                    {Number(detail.order?.AMOUNT || 0).toLocaleString()} {detail.order?.CURRENCY || "RWF"}
                  </div>
                </div>
                <div>
                  <div className="text-slate-600">Status</div>
                  <div className="font-medium">{detail.order?.ORDER_STATUS || "OPEN"}</div>
                </div>
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Buyer</CardTitle>
                  <CardDescription>Contact & delivery</CardDescription>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <div><span className="text-slate-600">Name:</span> {detail.buyer?.NAMES || detail.buyer?.OWNER || "-"}</div>
                  <div><span className="text-slate-600">Phone:</span> {detail.buyer?.PHONE || "-"}</div>
                  <div><span className="text-slate-600">Location:</span> {detail.order?.DELIVERY_LOCATION || "-"}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Seller</CardTitle>
                  <CardDescription>Contact</CardDescription>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <div><span className="text-slate-600">Name:</span> {detail.seller?.NAMES || detail.order?.SELLER_NAMES || "-"}</div>
                  <div><span className="text-slate-600">ISHYIGA:</span> {detail.order?.SELLER_ISHYIGA_ACCOUNT || "-"}</div>
                  <div><span className="text-slate-600">Phone:</span> {detail.seller?.PHONE || "-"}</div>
                </CardContent>
              </Card>
            </div>

<Card>
  <CardHeader>
    <CardTitle>Items</CardTitle>
    <CardDescription>{(detail?.items || []).length} item(s)</CardDescription>
  </CardHeader>
  <CardContent className="overflow-x-auto">
    {(() => {
      const items = detail?.items || []
      const currency = detail?.order?.CURRENCY || "RWF"

      const qtyOf = (it: any) =>
        Number(it.QUANTITY ?? it.qty ?? it.Qty ?? it.quantity ?? 0)

      // “Unit” here = price per unity
      const unitPriceOf = (it: any) =>
        Number(it.UNIT_PRICE ?? it.UNTY_PRICE ?? it.UNITY_PRICE ?? it.REQUEST_PRICE ?? it.unitPrice ?? 0)

      const grandTotal =
        items.reduce((sum: number, it: any) => sum + qtyOf(it) * unitPriceOf(it), 0)

      const fmt = (n: number) => n.toLocaleString()

      return (
        <table className="w-full text-sm">
          <thead className="border-b">
            <tr className="[&>th]:py-2 [&>th]:px-3">
              <th className="text-left w-[50%]">Item</th>
              <th className="text-right w-[10%]">Qty</th>
              <th className="text-right w-[20%]">Unit</th>
              <th className="text-right w-[20%]">Total</th>
            </tr>
          </thead>

          <tbody className="tabular-nums">
            {items.map((it: any, i: number) => {
              const qty = qtyOf(it)
              const unitPrice = unitPriceOf(it)
              const total = Number((qty * unitPrice).toFixed(2))

              return (
                <tr key={i} className="border-b last:border-b-2">
                  <td className="py-2 px-3">{it.ITEM_NAME ?? it.item_name ?? it.item ?? "-"}</td>
                  <td className="py-2 px-3 text-right">{fmt(qty)}</td>
                  <td className="py-2 px-3 text-right">{fmt(unitPrice)}</td>
                  <td className="py-2 px-3 text-right">{fmt(total)}</td>
                </tr>
              )
            })}
          </tbody>

          {/* Grand total (underline above, bold value) */}
          <tfoot>
            <tr className="border-t-2">
              <td className="py-3 px-3 font-semibold text-right" colSpan={3}>
                Total
              </td>
              <td className="py-3 px-3 font-bold text-right">
                {fmt(grandTotal)} {currency}
              </td>
            </tr>
          </tfoot>
        </table>
      )
    })()}
  </CardContent>
</Card>


          </>
        )}
      </main>
      <Footer />
    </div>
  )
}
