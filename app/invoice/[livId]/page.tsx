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
  downloadCisInvoicePdf,
  formatInvoiceNumber,
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
      await downloadCisInvoicePdf(data, typeof window !== "undefined" ? window.location.origin : undefined)
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

  const currency = data.totals?.currency || "RWF"
  const total = data.totals?.total ?? 0
  const invoiceLabel =
    data.invoiceTitle ||
    (data.invoiceNumber ? `INVOICE ${data.invoiceNumber}` : `INVOICE ${livId}`)
  const buyerName = data.cisBuyerName || data.buyerName || ""
  const shareUrl =
    data.invoiceUrl ||
    (typeof window !== "undefined" ? `${window.location.origin}/invoice/${encodeURIComponent(livId)}` : "")
  const items = data.items || []
  const dateLabel = data.invoiceDate || data.date || ""
  const totalFmt = formatInvoiceNumber(total)

  return (
    <main className="min-h-screen bg-slate-200/80 px-2 py-4 print:bg-white print:p-0 sm:px-4 sm:py-6">
      <div className="mx-auto mb-3 flex max-w-[980px] flex-wrap items-center justify-between gap-2 print:hidden">
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

      <article className="mx-auto max-w-[980px] bg-white px-4 py-5 text-[11px] text-black shadow-md sm:px-8 sm:py-7 print:shadow-none">
        {/* Header */}
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-[42%] space-y-0.5 leading-snug">
            {data.sellerName ? <p className="text-sm font-bold uppercase">{data.sellerName}</p> : null}
            {data.sellerAddress ? <p>{data.sellerAddress}</p> : null}
            {data.sellerEmail ? <p>E-mail: {data.sellerEmail}</p> : null}
            {data.sellerTin ? <p>TIN: {data.sellerTin}</p> : null}
            {data.sellerTel ? <p>Phone: {data.sellerTel}</p> : null}
          </div>

          <div className="flex flex-col items-end gap-2">
            {dateLabel ? <p className="text-[11px]">Kigali, On {dateLabel}</p> : null}
            <div className="flex items-start gap-3">
              <Image src={RRA_LOGO_PATH} alt="RRA" width={100} height={40} className="h-10 w-auto" priority />
              <Image src={RRA_LOGO2_PATH} alt="Rwanda" width={48} height={48} className="h-12 w-12" priority />
              {shareUrl ? (
                <div className="rounded border border-slate-200 bg-white p-1">
                  <QRCode value={shareUrl} size={64} />
                </div>
              ) : null}
            </div>
            {(buyerName || data.buyerTin || data.buyerLocation) && (
              <div className="mt-1 min-w-[220px] border border-black px-2.5 py-1.5 text-left leading-snug">
                {buyerName ? <p className="font-semibold uppercase">{buyerName}</p> : null}
                {data.buyerLocation ? <p>{data.buyerLocation}</p> : null}
                {data.buyerTin ? <p>TIN: {data.buyerTin}</p> : null}
              </div>
            )}
          </div>
        </header>

        <h1 className="mt-5 text-2xl font-bold tracking-wide">{invoiceLabel}</h1>
        <div className="mt-1 border-b border-black pb-1 text-[11px] uppercase tracking-wide">
          {[
            data.paymentName ? `REFERENCE : ${data.paymentName}` : null,
            `: ${totalFmt}`,
            data.servedBy ? `SERVED BY ${data.servedBy}` : null,
          ]
            .filter(Boolean)
            .join(" ")}
        </div>

        {/* Items: header + vertical rules only (no horizontal row lines) */}
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse border border-black text-[10px] sm:text-[11px]">
            <thead>
              <tr>
                {(
                  [
                    ["CODE", "w-[9%] text-left"],
                    ["DESIGNATION", "w-[28%] text-left"],
                    ["QTE", "w-[7%] text-center"],
                    ["LOT.", "w-[8%] text-center"],
                    ["PER.", "w-[8%] text-center"],
                    ["TVA", "w-[7%] text-center"],
                    ["TAX", "w-[6%] text-center"],
                    ["SALE P.", "w-[12%] text-right"],
                    ["TOTAL", "w-[12%] text-right"],
                  ] as const
                ).map(([label, cls]) => (
                  <th
                    key={label}
                    className={`border-b-2 border-l border-r border-black px-1 py-1.5 font-bold ${cls}`}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => {
                const qty = it.qty ?? 0
                const unit = Number(it.unitPrice || 0)
                const amt = Number(it.amount ?? qty * unit)
                return (
                  <tr key={`${it.name}-${i}`}>
                    <td className="border-l border-r border-black px-1 py-1 align-top">
                      {it.itemCode || it.code || ""}
                    </td>
                    <td className="border-l border-r border-black px-1 py-1 align-top font-medium">
                      {it.name || ""}
                    </td>
                    <td className="border-l border-r border-black px-1 py-1 text-center align-top">{qty}</td>
                    <td className="border-l border-r border-black px-1 py-1 text-center align-top">
                      {it.lot || ""}
                    </td>
                    <td className="border-l border-r border-black px-1 py-1 text-center align-top">
                      {it.per || ""}
                    </td>
                    <td className="border-l border-r border-black px-1 py-1 text-center align-top">
                      {it.tva || ""}
                    </td>
                    <td className="border-l border-r border-black px-1 py-1 text-center align-top">
                      {taxLetter(it.tax)}
                    </td>
                    <td className="border-l border-r border-black px-1 py-1 text-right align-top tabular-nums">
                      {formatInvoiceNumber(unit)}
                    </td>
                    <td className="border-l border-r border-black px-1 py-1 text-right align-top tabular-nums">
                      {formatInvoiceNumber(amt)}
                    </td>
                  </tr>
                )
              })}
              {/* spacer so vertical lines continue a bit like the paper form */}
              {items.length > 0
                ? Array.from({ length: Math.min(3, Math.max(0, 4 - items.length)) }).map((_, i) => (
                    <tr key={`pad-${i}`} aria-hidden>
                      {Array.from({ length: 9 }).map((__, j) => (
                        <td key={j} className="border-l border-r border-black px-1 py-2">
                          &nbsp;
                        </td>
                      ))}
                    </tr>
                  ))
                : null}
            </tbody>
          </table>
        </div>

        {/* Totals boxes */}
        <div className="mt-0 grid grid-cols-2 border border-t-0 border-black sm:grid-cols-3 lg:grid-cols-6">
          {(
            [
              ["TOTAL A-EX RWF", "0.00"],
              ["TOTAL B-18.00% RWF", "0.00"],
              ["TOTAL C-0% RWF", "0.00"],
              ["TOTAL TAX B RWF", "0.00"],
              ["TOTAL TAX RWF", "0.00"],
              [`TOTAL ${currency}`, totalFmt],
            ] as const
          ).map(([label, value], idx) => (
            <div
              key={label}
              className={`border-black px-1 py-1.5 text-center ${idx > 0 ? "border-l" : ""} ${idx >= 2 ? "border-t sm:border-t-0" : ""} ${idx >= 3 ? "lg:border-t-0" : ""}`}
            >
              <p className="text-[9px] font-bold leading-tight sm:text-[10px]">{label}</p>
              <p className={`mt-1 tabular-nums ${idx === 5 ? "font-bold" : ""}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* BK / SDC / MRC */}
        <section className="mt-5 grid gap-4 sm:grid-cols-3">
          <div className="space-y-1 font-mono text-[10px] leading-snug">
            <p>BK :</p>
            <p>BK :</p>
            <p>BK :</p>
            <p>CODE MoMo:</p>
          </div>
          <div className="space-y-0.5 font-mono text-[10px] leading-snug">
            <p className="font-sans text-[11px] font-bold">SDC INFORMATION</p>
            <p>TIME SDC : {data.timeSdc || ""}</p>
            <p>SDC ID: {data.sdcId || ""}</p>
            <p className="break-all">Internal Data: {data.sdcInternalData || ""}</p>
            <p className="break-all">Receipt Signature: {data.receiptSignature || ""}</p>
            <p>RECEIPT NUMBER: {data.receiptNumber || ""}</p>
          </div>
          <div className="space-y-0.5 font-mono text-[10px] leading-snug">
            <p className="font-sans text-[11px] font-bold">MRC INFORMATION</p>
            <p>ITEMS NUMBER: {data.itemsNumber ?? items.length}</p>
            <p>TIME MRC: {data.timeMrc || data.timeSdc || ""}</p>
            <p>MRC: {data.mrc || ""}</p>
            <p>INVOICE NUMBER: {data.invoiceNumber || ""}</p>
            {data.ishyigaVersion ? <p>{data.ishyigaVersion}</p> : null}
          </div>
        </section>

        <p className="mt-6 text-[9px] italic leading-snug text-slate-700">
          {data.conditionsFr ||
            "*Kindly verify the expiry dates, quantities, items and prices on delivery notes before payment and order confirmation. Returns and complaints will not be acceptable once invoices have been made."}
        </p>
      </article>
    </main>
  )
}
