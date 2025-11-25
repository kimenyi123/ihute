"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/lib/auth-store"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { HalfStarRating } from "@/components/half-star-rating"
import { CheckCircle, Package } from "lucide-react"

type DeliveryRow = {
  orderId: number
  sellerName: string
  subtotal: number
  status: "PENDING" | "RECEIVED"
}

export default function DeliveriesPage() {
  const router = useRouter()
  const { isAuthenticated, user } = useAuthStore()
  const [rows, setRows] = useState<DeliveryRow[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [rating, setRating] = useState<Record<number, number>>({}) // orderId -> stars
  const [feedback, setFeedback] = useState<Record<number, string>>({}) // orderId -> text
  const [busy, setBusy] = useState<number | null>(null)

  useEffect(() => {
    if (!isAuthenticated) router.push("/login")
  }, [isAuthenticated, router])

  useEffect(() => {
    let cancel = false
    async function load() {
      setLoading(true); setErr(null)
      try {
        const res = await fetch("/api/delivery/list", { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ email: user?.email }) })
        const json = await res.json()
        if (!res.ok || !json?.ok) throw new Error(json?.error || "Failed to load")
        const data: DeliveryRow[] = json.rows || []
        if (!cancel) setRows(data)
      } catch (e:any) {
        if (!cancel) setErr(e?.message || "Error")
      } finally {
        if (!cancel) setLoading(false)
      }
    }
    load()
    return () => { cancel = true }
  }, [user?.email])

  const markReceived = async (orderId: number) => {
    try {
      setBusy(orderId)
      const res = await fetch("/api/delivery/received", { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ orderId }) })
      const json = await res.json()
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Failed")
      setRows(r => r.map(x => x.orderId === orderId ? { ...x, status: "RECEIVED" } : x))
    } catch (e:any) {
      alert(e?.message || "Failed")
    } finally {
      setBusy(null)
    }
  }

  const sendRating = async (orderId: number) => {
    try {
      setBusy(orderId)
      const stars = rating[orderId] || 0
      const fb = feedback[orderId] || ""
      const res = await fetch("/api/delivery/rate", { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ orderId, stars, feedback: fb }) })
      const json = await res.json()
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Failed")
      alert("Thanks for your feedback!")
    } catch (e:any) {
      alert(e?.message || "Failed")
    } finally {
      setBusy(null)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <div className="container mx-auto px-4 py-8">Loading…</div>
      <Footer />
    </div>
  )
  if (err) return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <div className="container mx-auto px-4 py-8 text-red-600">{err}</div>
      <Footer />
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <div className="container mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">My Deliveries</h1>
          <p className="text-slate-600 mt-1">Review and rate your received orders</p>
        </div>
      {rows.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              No Deliveries Yet
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-600">Your received orders will appear here.</p>
          </CardContent>
        </Card>
      ) : rows.map(row => (
        <Card key={row.orderId} className="hover:shadow-md transition-shadow">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-lg">Order #{row.orderId}</CardTitle>
                <p className="text-sm text-slate-600 mt-1">from {row.sellerName}</p>
              </div>
              {row.status === "RECEIVED" && (
                <div className="flex items-center gap-1 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  <span className="text-sm font-medium">Received</span>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 py-2">
              <div>
                <span className="text-xs text-slate-600 uppercase">Status</span>
                <p className={`font-semibold ${row.status === "RECEIVED" ? "text-green-700" : "text-orange-600"}`}>
                  {row.status}
                </p>
              </div>
              <div>
                <span className="text-xs text-slate-600 uppercase">Total</span>
                <p className="font-bold text-lg">{row.subtotal.toLocaleString()} RWF</p>
              </div>
            </div>

            {row.status === "PENDING" && (
              <Button 
                onClick={() => markReceived(row.orderId)} 
                disabled={busy === row.orderId}
                className="w-full"
                size="lg"
              >
                {busy === row.orderId ? "Confirming…" : "Confirm Delivery Received"}
              </Button>
            )}

            {/* Rating Section */}
            <div className="pt-4 border-t space-y-3">
              <h3 className="text-sm font-semibold">Rate Your Experience</h3>
              <HalfStarRating
                value={rating[row.orderId] || 0}
                onChange={(value) => setRating(r => ({ ...r, [row.orderId]: value }))}
                maxStars={5}
                size="lg"
                showValue={true}
              />
              <textarea
                className="w-full rounded-lg border border-slate-300 p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Share your feedback about the delivery…"
                rows={3}
                value={feedback[row.orderId] || ""}
                onChange={(e) => setFeedback(f => ({ ...f, [row.orderId]: e.target.value }))}
              />
              <Button 
                variant="outline" 
                onClick={() => sendRating(row.orderId)} 
                disabled={busy === row.orderId || !rating[row.orderId]}
                className="w-full"
              >
                {busy === row.orderId ? "Submitting…" : "Submit Rating"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
      </div>
      <Footer />
    </div>
  )
}
