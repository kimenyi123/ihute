"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import dynamic from "next/dynamic"
import { useParams } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Eye, FileText, Loader2 } from "lucide-react"

const QRCode = dynamic(() => import("react-qr-code"), { ssr: false })

type DocumentState = "DELIVERY_NOTE" | "INVOICE_REQUESTED" | "INVOICED"

type LivBon = {
  ok?: boolean
  livId?: string
  orderId?: number
  sellerName?: string
  sessionType?: "table" | "single"
  tableName?: string | null
  date?: string
  servedBy?: string | null
  orderStatus?: string
  documentState?: DocumentState | string
  items?: Array<{ name?: string; qty?: number; unitPrice?: number; amount?: number }>
  totals?: { subtotal?: number; total?: number; currency?: string }
  paymentStatus?: string
  trackUrl?: string
  livUrl?: string
  qrPayload?: string
  invoicePdfUrl?: string | null
  error?: string
}

function money(n: number | undefined, currency = "RWF") {
  if (n == null || Number.isNaN(n)) return "—"
  return `${Math.round(n).toLocaleString()} ${currency}`
}

export default function LivBonPage() {
  const params = useParams()
  const livId = decodeURIComponent(String(params?.livId || "")).trim()
  const [bon, setBon] = useState<LivBon | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [invoiceBusy, setInvoiceBusy] = useState(false)
  const [invoiceMsg, setInvoiceMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!livId) {
      setError("Missing LIV id")
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : ""
      const p = new URLSearchParams({ livId })
      if (origin) p.set("publicSiteUrl", origin)
      const res = await fetch(`/api/orders/by-liv?${p}`, { cache: "no-store" })
      const json = (await res.json().catch(() => ({}))) as LivBon
      if (!res.ok || json.ok === false) {
        throw new Error(json.error || "Bon not found")
      }
      setBon(json)
    } catch (e) {
      setBon(null)
      setError(e instanceof Error ? e.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }, [livId])

  useEffect(() => {
    void load()
  }, [load])

  async function askForInvoice() {
    const liv = (bon?.livId || livId || "").trim()
    if (!liv && !bon?.orderId) return
    setInvoiceBusy(true)
    setInvoiceMsg(null)
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : ""
      const body: Record<string, unknown> = { publicSiteUrl: origin }
      if (liv) body.livid = liv
      else body.orderId = bon?.orderId
      const res = await fetch("/api/orders/request-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        message?: string
        error?: string
        livId?: string
        livid?: string
      }
      if (!res.ok || json.ok === false) {
        throw new Error(json.error || "Request failed")
      }
      setInvoiceMsg(
        json.message ||
          `This person is asking for invoice for ${json.livId || json.livid || liv}`,
      )
      await load()
    } catch (e) {
      setInvoiceMsg(e instanceof Error ? e.message : "Request failed")
    } finally {
      setInvoiceBusy(false)
    }
  }

  const currency = bon?.totals?.currency || "RWF"
  const documentState = String(bon?.documentState || "DELIVERY_NOTE").toUpperCase()
  const qrValue = bon?.qrPayload || bon?.trackUrl || bon?.livUrl || ""

  if (loading) {
    return (
      <main className="mx-auto flex min-h-[50vh] max-w-lg items-center justify-center px-4 py-16 text-slate-600">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading {livId || "bon"}…
      </main>
    )
  }

  if (error || !bon) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-slate-900">{livId || "Delivery note"}</h1>
        <p className="mt-2 text-sm text-red-600">{error || "Not found"}</p>
        <Button asChild className="mt-6" variant="outline">
          <Link href="/">Back to IHUTE</Link>
        </Button>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm text-slate-900">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">COMMANDE / ORDER</p>
        <h1 className="mt-1 text-2xl font-semibold">{bon.sellerName || "IHUTE"}</h1>
        <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-600">
          <Badge variant="outline" className="font-mono">
            {bon.livId || livId}
          </Badge>
          {bon.tableName ? <span>TABLE: {bon.tableName}</span> : null}
          {bon.date ? <span>PRINTED: {bon.date}</span> : null}
          {bon.servedBy ? <span>BY: {bon.servedBy}</span> : null}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge variant="secondary">{String(bon.orderStatus || "OPEN")}</Badge>
          <Badge variant="outline">{documentState.replace(/_/g, " ")}</Badge>
        </div>

        <ul className="mt-6 space-y-3 border-t border-slate-100 pt-4">
          {(bon.items || []).map((it, i) => (
            <li key={`${it.name}-${i}`} className="flex justify-between gap-3 text-sm">
              <div>
                <p className="font-medium">{it.name || "Item"}</p>
                <p className="text-slate-500">
                  {it.qty ?? 0} × {money(it.unitPrice, currency)}
                </p>
              </div>
              <p className="font-medium tabular-nums">{money(it.amount ?? (it.qty || 0) * (it.unitPrice || 0), currency)}</p>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex justify-between border-t border-slate-200 pt-4 text-base font-semibold">
          <span>TOTAL</span>
          <span className="tabular-nums">{money(bon.totals?.total, currency)}</span>
        </div>

        {qrValue ? (
          <div className="mt-6 flex flex-col items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 p-4">
            <div className="rounded-lg bg-white p-3">
              <QRCode value={qrValue} size={128} />
            </div>
            <p className="text-center text-xs text-slate-500">Scan to open this delivery note</p>
          </div>
        ) : null}

        <div className="mt-6 space-y-2">
          {documentState === "DELIVERY_NOTE" ? (
            <Button
              type="button"
              className="w-full bg-indigo-600 hover:bg-indigo-700"
              disabled={invoiceBusy}
              onClick={() => void askForInvoice()}
            >
              <FileText className="mr-2 h-4 w-4" />
              {invoiceBusy ? "Requesting…" : "Ask for invoice"}
            </Button>
          ) : null}

          {documentState === "INVOICE_REQUESTED" ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Invoice requested — waiting on seller
            </p>
          ) : null}

          {documentState === "INVOICED" ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" className="w-full bg-sky-700 hover:bg-sky-800" asChild>
                <Link href={`/invoice/${encodeURIComponent(bon.livId || livId)}`}>
                  <Eye className="mr-2 h-4 w-4" />
                  View / download invoice
                </Link>
              </Button>
            </div>
          ) : null}

          {invoiceMsg ? <p className="text-sm text-slate-600">{invoiceMsg}</p> : null}

          {bon.orderId ? (
            <Button asChild variant="outline" className="w-full">
              <Link href={`/track-order/${bon.orderId}`}>Open full track page</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </main>
  )
}
