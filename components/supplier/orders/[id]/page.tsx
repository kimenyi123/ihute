// app/orders/[id]/page.tsx
"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { CheckCircle, Clock, Truck } from "lucide-react"
import { useAuthStore } from "@/lib/auth-store"

type DetailItem = {
  item_code?: string
  ITEM_CODE?: string
  item_name?: string
  ITEM_NAME?: string
  quantity?: number
  QUANTITY?: number
  unit?: string
  UNIT?: string
  unit_price?: number
  UNITY_PRICE?: number
  UNIT_PRICE?: number
}

type UpstreamOrder = {
  ID_ORDER?: string | number
  SELLER_NAMES?: string
  SELLER_OWNER?: string
  SELLER_ISHYIGA_ACCOUNT?: string
  BUYER_OWNER?: string
  PAYMENT_NAME?: string
  AMOUNT?: number
  CREATED_AT?: string
}

function money(n: number | string | undefined) {
  const v = typeof n === "number" ? n : Number(n || 0)
  return isFinite(v) ? v.toLocaleString() + " RWF" : String(n ?? "")
}

function mapStatus(name?: string) {
  const s = (name || "").toLowerCase().replace(/[\s_]+/g, " ")
  if (/(pay on delivery|pay-on-delivery|pay_on_delivery|cod)/.test(s)) return "pending" as const
  if (s.includes("delivered") || s.includes("completed")) return "delivered" as const
  if (s.includes("transit") || s.includes("shipped") || s.includes("out")) return "in-transit" as const
  if (s.includes("pending")) return "pending" as const
  if (s.includes("paid") || s.includes("success") || s.includes("processing") || s.includes("mtn momo")) return "processing" as const
  return "processing" as const
}

function StatusIcon({ status }: { status: ReturnType<typeof mapStatus> }) {
  if (status === "delivered") return <CheckCircle className="h-5 w-5 text-green-600" />
  if (status === "in-transit") return <Truck className="h-5 w-5 text-blue-600" />
  return <Clock className="h-5 w-5 text-yellow-600" />
}

function StatusBadge({ status }: { status: ReturnType<typeof mapStatus> }) {
  const variant = status === "delivered" ? "default" : status === "in-transit" ? "secondary" : "outline"
  return (
    <Badge variant={variant as any} className="capitalize">
      {status.replace("-", " ")}
    </Badge>
  )
}

export default function OrderDetailsPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const orderId = String(params?.id ?? "")
  const { user, isAuthenticated } = useAuthStore()

  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [order, setOrder] = useState<UpstreamOrder | null>(null)
  const [items, setItems] = useState<DetailItem[]>([])
  const [marking, setMarking] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) router.push("/login")
  }, [isAuthenticated, router])

  useEffect(() => {
    let cancel = false
    async function load() {
      if (!user?.email || !orderId) return
      setLoading(true)
      setErr(null)
      try {
        // Primary: dedicated details endpoint
        const res = await fetch("/api/orders/details", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: user.email, orderId }),
          cache: "no-store",
        })
        const json = await res.json()
        if (!res.ok || json?.ok === false) throw new Error(json?.error || "Failed to load order")

        // Expected: { ok: true, order: {...}, items: [...] }
        const oi = Array.isArray(json?.items) ? json.items : []
        if (!cancel) {
          setOrder(json?.order || null)
          setItems(oi)
        }
      } catch (e: any) {
        // Graceful fallback: try the generic servlet forwarder if available
        try {
          // const res2 = await fetch("/api/fetchSuggestions", {
             const res2 = await fetch("/Trading/Kaos/fetchSuggestions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ transactionId: orderId }),
            cache: "no-store",
          })
          const json2 = await res2.json().catch(() => ({}))
          const items2 = Array.isArray(json2?.items) ? json2.items : []
          if (!cancel) {
            setOrder({
              ID_ORDER: orderId,
              SELLER_NAMES: "",
              PAYMENT_NAME: "",
              AMOUNT: 0,
              CREATED_AT: new Date().toISOString(),
            })
            setItems(items2)
          }
        } catch (err2: any) {
          if (!cancel) setErr(e?.message || "Failed to load order")
        }
      } finally {
        if (!cancel) setLoading(false)
      }
    }
    load()
    return () => {
      cancel = true
    }
  }, [user?.email, orderId])

  const status = mapStatus(order?.PAYMENT_NAME)
  const createdStr = order?.CREATED_AT ? new Date(order.CREATED_AT).toLocaleString() : ""
  const totals = useMemo(() => {
    const rows = items.map((it) => {
      const qty = Number(it.quantity ?? it.QUANTITY ?? 0)
      const unit = String(it.unit ?? it.UNIT ?? "")
      const price = Number(it.unit_price ?? it.UNITY_PRICE ?? it.UNIT_PRICE ?? 0)
      const name = String(it.item_name ?? it.ITEM_NAME ?? "Item")
      const code = String(it.item_code ?? it.ITEM_CODE ?? "")
      const line = qty * price
      return { name, code, qty, unit, price, line }
    })
    const subtotal = rows.reduce((s, r) => s + (isFinite(r.line) ? r.line : 0), 0)
    return { rows, subtotal }
  }, [items])

  const markReceived = async () => {
    try {
      setMarking(true)
      const res = await fetch("/api/orders/mark-received", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      })
      const json = await res.json()
      if (!res.ok || json?.ok === false) throw new Error(json?.error || "Failed to mark as received")
      // optimistically reflect delivered state
      setOrder((o) => ({ ...(o || {}), PAYMENT_NAME: "DELIVERED" }))
    } catch (e: any) {
      setErr(e?.message || "Failed to mark as received")
    } finally {
      setMarking(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Order #{orderId}</h1>
            <p className="text-slate-600">{createdStr}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusIcon status={status} />
            <StatusBadge status={status} />
          </div>
        </div>

        {loading ? (
          <Card>
            <CardHeader><CardTitle className="text-lg">Loading…</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">Fetching order details.</CardContent>
          </Card>
        ) : err ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Couldn’t load order</CardTitle>
              <CardDescription className="text-destructive">{err}</CardDescription>
            </CardHeader>
            <CardContent><Button onClick={() => router.push("/orders")}>Back to Orders</Button></CardContent>
          </Card>
        ) : (
          <>
            <Card className="mb-6">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Summary</CardTitle>
                <CardDescription>
                  {order?.SELLER_NAMES || order?.SELLER_OWNER || order?.SELLER_ISHYIGA_ACCOUNT || "Supplier"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Total</span>
                  <span className="font-semibold">{money(order?.AMOUNT ?? totals.subtotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Status</span>
                  <StatusBadge status={status} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Items</CardTitle>
                <CardDescription>{totals.rows.length} item{totals.rows.length === 1 ? "" : "s"}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="hidden md:grid md:grid-cols-12 text-xs font-medium text-slate-500">
                  <div className="col-span-6">Item</div>
                  <div className="col-span-2 text-right">Qty</div>
                  <div className="col-span-2 text-right">Unit Price</div>
                  <div className="col-span-2 text-right">Line Total</div>
                </div>
                <Separator className="my-2" />
                <div className="space-y-3">
                  {totals.rows.map((r, idx) => (
                    <div key={idx} className="grid grid-cols-1 md:grid-cols-12 items-start gap-1 md:gap-2">
                      <div className="md:col-span-6">
                        <div className="font-medium text-slate-900">{r.name}</div>
                        <div className="text-xs text-slate-500">Code: {r.code || "-"}</div>
                      </div>
                      <div className="md:col-span-2 md:text-right text-slate-700">
                        {r.qty} {r.unit}
                      </div>
                      <div className="md:col-span-2 md:text-right text-slate-700">
                        {money(r.price)}
                      </div>
                      <div className="md:col-span-2 md:text-right font-semibold">
                        {money(r.line)}
                      </div>
                    </div>
                  ))}
                </div>
                <Separator className="my-4" />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Subtotal</span>
                  <span className="font-semibold">{money(totals.subtotal)}</span>
                </div>
              </CardContent>
            </Card>

            <div className="mt-6 flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => router.push("/orders")}>Back to Orders</Button>
              <Button onClick={markReceived} disabled={marking || status === "delivered"}>
                {marking ? "Marking…" : "Mark as received"}
              </Button>
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  )
}
