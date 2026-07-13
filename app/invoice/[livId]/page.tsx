"use client"

import { useCallback, useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import dynamic from "next/dynamic"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Download, Loader2 } from "lucide-react"
import {
  RRA_LOGO2_PATH,
  RRA_LOGO_PATH,
  type CisInvoiceData,
  cisInvoiceDateLabel,
  cisReferenceLine,
  cisSellerDisplayName,
  cisTaxTotalBoxes,
  downloadCisInvoicePdf,
  formatInvoiceNumber,
  hasCisMrcInfo,
  hasCisSdcInfo,
  svgElementToPngDataUrl,
  taxLetter,
} from "@/lib/cis-invoice"

const QRCode = dynamic(() => import("react-qr-code"), { ssr: false })

export default function CisInvoicePage() {
  const params = useParams()
  const livId = decodeURIComponent(String(params?.livId || "")).trim()
  const [data, setData] = useState<CisInvoiceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pdfBusy, setPdfBusy] = useState(false)

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
      const json = (await res.json().catch(() => ({}))) as CisInvoiceData
      if (!res.ok || json.ok === false) {
        throw new Error(json.error || "Invoice not found")
      }
      const state = String(json.documentState || "").toUpperCase()
      const status = String(json.orderStatus || "").toUpperCase()
      if (state !== "INVOICED" && status !== "INVOICE") {
        throw new Error("This bon is not an invoice yet. Open the delivery note instead.")
      }
      setData(json)
    } catch (e) {
      setData(null)
      setError(e instanceof Error ? e.message : "Failed to load invoice")
    } finally {
      setLoading(false)
    }
  }, [livId])

  useEffect(() => {
    void load()
  }, [load])

  async function onDownload() {
    if (!data) return
    setPdfBusy(true)
    try {
      // Same bytes as `/api/orders/invoice-pdf` (shared createCisInvoicePdf builder)
      const origin = typeof window !== "undefined" ? window.location.origin : undefined
      const qs = new URLSearchParams()
      if (livId) qs.set("livId", livId)
      if (data.orderId) qs.set("orderId", String(data.orderId))
      const res = await fetch(`/api/orders/invoice-pdf?${qs}`, { cache: "no-store" })
      if (res.ok && (res.headers.get("content-type") || "").includes("pdf")) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `invoice-${livId || data.orderId || "copy"}.pdf`
        a.click()
        URL.revokeObjectURL(url)
        return
      }
      // Fallback: client-side PDF (same layout helper)
      const svg = document.querySelector<SVGElement>("[data-invoice-qr] svg")
      const fromPage = svg ? await svgElementToPngDataUrl(svg, 256) : null
      await downloadCisInvoicePdf(data, origin, fromPage)
    } catch (e) {
      setError(e instanceof Error ? e.message : "PDF download failed")
    } finally {
      setPdfBusy(false)
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-[50vh] items-center justify-center gap-2 text-slate-600">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading invoice {livId}…
      </main>
    )
  }

  if (error || !data) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Invoice {livId}</h1>
        <p className="mt-2 text-sm text-red-600">{error || "Not found"}</p>
        <div className="mt-6 flex justify-center gap-2">
          <Button asChild variant="outline">
            <Link href={`/liv/${encodeURIComponent(livId)}`}>Open delivery note</Link>
          </Button>
        </div>
      </main>
    )
  }

  const invoiceLabel =
    data.invoiceTitle ||
    (data.invoiceNumber ? `INVOICE ${data.invoiceNumber}` : `INVOICE ${livId}`)
  const buyerName = data.cisBuyerName || data.buyerName || ""
  const sellerTitle = cisSellerDisplayName(data)
  const shareUrl =
    data.invoiceUrl ||
    (typeof window !== "undefined" ? `${window.location.origin}/invoice/${encodeURIComponent(livId)}` : "")
  const items = data.items || []
  // Prefer fiscal CIS times only — never invent "Kigali, On" or fall back to order CREATED_AT
  const dateLabel = cisInvoiceDateLabel(data)
  const showLogos = hasCisSdcInfo(data)
  // Always keep SDC INFORMATION labels on the invoice (even if values are empty / NS/)
  const showSdc = true
  const showMrc = hasCisMrcInfo(data)

  return (
    <main className="min-h-screen bg-slate-200/80 px-2 py-4 print:bg-white print:p-0 sm:px-4 sm:py-6">
      <div className="mx-auto mb-3 flex max-w-[210mm] flex-wrap items-center justify-between gap-2 print:hidden">
        <p className="text-sm text-slate-600">Scanned invoice copy · {livId}</p>
        <Button
          type="button"
          className="bg-sky-700 hover:bg-sky-800"
          disabled={pdfBusy}
          onClick={() => void onDownload()}
        >
          <Download className="mr-2 h-4 w-4" />
          {pdfBusy ? "Preparing PDF…" : "Download PDF copy"}
        </Button>
      </div>

      <article className="mx-auto flex min-h-[297mm] w-full max-w-[210mm] flex-col bg-white px-5 py-6 text-[11px] text-black shadow-md print:min-h-[297mm] print:max-w-none print:shadow-none sm:px-8 sm:py-7">
        {/* Header */}
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-[42%] space-y-0.5 leading-snug">
            {sellerTitle ? <p className="text-sm font-bold uppercase">{sellerTitle}</p> : null}
            {data.sellerAddress ? <p>{data.sellerAddress}</p> : null}
            {data.sellerEmail ? <p>{data.sellerEmail}</p> : null}
            {data.sellerTin ? <p>{data.sellerTin}</p> : null}
            {data.sellerTel ? <p>{data.sellerTel}</p> : null}
          </div>

          <div className="flex flex-col items-end gap-2">
            {dateLabel ? <p className="text-[11px]">{dateLabel}</p> : null}
            <div className="flex items-start gap-3">
              {showLogos ? (
                <>
                  <Image src={RRA_LOGO_PATH} alt="RRA" width={100} height={40} className="h-10 w-auto" priority />
                  <Image src={RRA_LOGO2_PATH} alt="Rwanda" width={48} height={48} className="h-12 w-12" priority />
                </>
              ) : null}
              {shareUrl ? (
                <div data-invoice-qr className="rounded border border-slate-200 bg-white p-1">
                  <QRCode value={shareUrl} size={64} />
                </div>
              ) : null}
            </div>
            {(buyerName || data.buyerTin || data.buyerLocation) && (
              <div className="mt-1 min-w-[220px] border border-black px-2.5 py-1.5 text-left leading-snug">
                {buyerName ? <p className="font-semibold uppercase">{buyerName}</p> : null}
                {data.buyerLocation ? <p>{data.buyerLocation}</p> : null}
                {data.buyerTin ? <p>{data.buyerTin}</p> : null}
              </div>
            )}
          </div>
        </header>

        <h1 className="mt-5 text-2xl font-bold tracking-wide">{invoiceLabel}</h1>
        <div className="mt-1 border-b border-black pb-1 text-[11px] uppercase tracking-wide">
          {cisReferenceLine(data)}
        </div>

        {/* Items table — tall A4 body; vertical column lines through empty space */}
        <div className="mt-3 flex min-h-[165mm] flex-1 flex-col border border-black print:min-h-[170mm]">
          <div
            className="grid shrink-0 border-b-2 border-black text-[10px] font-bold sm:text-[11px]"
            style={{
              gridTemplateColumns: "14% 23% 7% 8% 8% 7% 6% 12% 12%",
            }}
          >
            {(
              [
                ["CODE", "text-left"],
                ["DESIGNATION", "text-left"],
                ["QTE", "text-center"],
                ["LOT.", "text-center"],
                ["PER.", "text-center"],
                ["TVA", "text-center"],
                ["TAX", "text-center"],
                ["SALE P.", "text-right"],
                ["TOTAL", "text-right"],
              ] as const
            ).map(([label, align], i) => (
              <div
                key={label}
                className={`px-1 py-1.5 ${align} ${i < 8 ? "border-r border-black" : ""}`}
              >
                {label}
              </div>
            ))}
          </div>

          <div className="relative min-h-0 flex-1">
            {/* full-height vertical column rules */}
            <div
              className="pointer-events-none absolute inset-0 grid"
              style={{ gridTemplateColumns: "14% 23% 7% 8% 8% 7% 6% 12% 12%" }}
              aria-hidden
            >
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className={i < 8 ? "border-r border-black" : ""} />
              ))}
            </div>

            <div className="relative z-[1]">
              {items.map((it, rowIdx) => {
                const qty = it.qty ?? 0
                const unit = Number(it.unitPrice || 0)
                const amt = Number(it.amount ?? qty * unit)
                const cells = [
                  { t: it.itemCode || it.code || "", a: "text-left break-all leading-tight" },
                  { t: it.name || "", a: "text-left font-medium leading-tight" },
                  { t: String(qty), a: "text-center" },
                  { t: it.lot || "", a: "text-center" },
                  { t: it.per || "", a: "text-center" },
                  { t: it.tva || "", a: "text-center" },
                  { t: taxLetter(it.tax), a: "text-center" },
                  { t: formatInvoiceNumber(unit), a: "text-right tabular-nums" },
                  { t: formatInvoiceNumber(amt), a: "text-right tabular-nums" },
                ]
                return (
                  <div
                    key={`${it.name}-${rowIdx}`}
                    className="grid text-[10px] sm:text-[11px]"
                    style={{ gridTemplateColumns: "14% 23% 7% 8% 8% 7% 6% 12% 12%" }}
                  >
                    {cells.map((c, i) => (
                      <div key={i} className={`px-1 py-1 ${c.a}`}>
                        {c.t}
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Totals boxes — values from CIS taxTotals */}
        <div className="mt-0 grid grid-cols-2 border border-t-0 border-black sm:grid-cols-3 lg:grid-cols-6">
          {cisTaxTotalBoxes(data).map(([label, value], idx) => (
            <div
              key={label}
              className={`border-black px-1 py-1.5 text-center ${idx > 0 ? "border-l" : ""} ${idx >= 2 ? "border-t sm:border-t-0" : ""} ${idx >= 3 ? "lg:border-t-0" : ""}`}
            >
              <p className="text-[9px] font-bold leading-tight sm:text-[10px]">{label}</p>
              <p className={`mt-1 tabular-nums ${idx === 5 ? "font-bold" : ""}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* BK / SDC / MRC — SDC + RRA logos only when CIS sent SDC */}
        {(showSdc || showMrc) && (
          <section className="mt-5 grid gap-4 sm:grid-cols-3">
            <div className="space-y-1 font-mono text-[10px] leading-snug">
              <p>BK :</p>
              <p>BK :</p>
              <p>BK :</p>
              <p>CODE MoMo:</p>
            </div>
            <div className="space-y-0.5 font-mono text-[10px] leading-snug">
              {showSdc ? (
                <>
                  <p className="font-sans text-[11px] font-bold">SDC INFORMATION</p>
                  <p>TIME SDC : {data.timeSdc || ""}</p>
                  <p>SDC ID: {data.sdcId || ""}</p>
                  <p className="break-all">Internal Data: {data.sdcInternalData || ""}</p>
                  <p className="break-all">Receipt Signature: {data.receiptSignature || ""}</p>
                  <p>RECEIPT NUMBER: {data.receiptNumber || ""}</p>
                </>
              ) : null}
            </div>
            <div className="space-y-0.5 font-mono text-[10px] leading-snug">
              {showMrc ? (
                <>
                  <p className="font-sans text-[11px] font-bold">MRC INFORMATION</p>
                  <p>ITEMS NUMBER: {data.itemsNumber ?? items.length}</p>
                  <p>TIME MRC: {data.timeMrc || data.timeSdc || ""}</p>
                  <p>MRC: {data.mrc || ""}</p>
                  <p>INVOICE NUMBER: {data.invoiceNumber || ""}</p>
                  {data.ishyigaVersion ? <p>{data.ishyigaVersion}</p> : null}
                </>
              ) : null}
            </div>
          </section>
        )}

        <p className="mt-6 text-[9px] italic leading-snug text-slate-700">
          {data.conditionsFr ||
            "*Kindly verify the expiry dates, quantities, items and prices on delivery notes before payment and order confirmation. Returns and complaints will not be acceptable once invoices have been made."}
        </p>
      </article>
    </main>
  )
}
