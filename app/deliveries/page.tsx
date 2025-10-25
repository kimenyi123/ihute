"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/lib/auth-store"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Star } from "lucide-react"

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

  if (loading) return <div className="container mx-auto px-4 py-8">Loading…</div>
  if (err) return <div className="container mx-auto px-4 py-8 text-red-600">{err}</div>

  return (
    <div className="container mx-auto px-4 py-8 space-y-4">
      <h1 className="text-2xl font-bold">Deliveries</h1>
      {rows.length === 0 ? (
        <Card><CardHeader><CardTitle>No deliveries</CardTitle></CardHeader></Card>
      ) : rows.map(row => (
        <Card key={row.orderId}>
          <CardHeader>
            <CardTitle>Order #{row.orderId} — {row.sellerName}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span>Status</span>
              <span className={`font-medium ${row.status === "RECEIVED" ? "text-green-700" : ""}`}>{row.status}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Subtotal</span>
              <span className="font-semibold">{row.subtotal.toLocaleString()} RWF</span>
            </div>

            {row.status === "PENDING" && (
              <Button onClick={() => markReceived(row.orderId)} disabled={busy === row.orderId}>
                {busy === row.orderId ? "Updating…" : "Mark as Received"}
              </Button>
            )}

            {/* Optional rating — can rate anytime, but you might gate it to RECEIVED only */}
            <div className="pt-2 border-t">
              <div className="flex items-center gap-2">
                {[1,2,3,4,5].map(s => (
                  <button key={s} onClick={() => setRating(r => ({ ...r, [row.orderId]: s }))} aria-label={`${s} stars`}>
                    <Star className={`h-5 w-5 ${ (rating[row.orderId] || 0) >= s ? "fill-yellow-400 text-yellow-400" : "text-slate-400" }`} />
                  </button>
                ))}
              </div>
              <textarea
                className="mt-2 w-full rounded border p-2 text-sm"
                placeholder="Optional feedback…"
                value={feedback[row.orderId] || ""}
                onChange={(e) => setFeedback(f => ({ ...f, [row.orderId]: e.target.value }))}
              />
              <div className="mt-2">
                <Button variant="outline" onClick={() => sendRating(row.orderId)} disabled={busy === row.orderId}>
                  {busy === row.orderId ? "Sending…" : "Submit Rating"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
