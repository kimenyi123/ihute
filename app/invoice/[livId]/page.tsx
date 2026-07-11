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
  money,
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

  return (
    <main className="min-h-screen bg-slate-100 px-3 py-6 print:bg-white print:p-0">
      <div className="mx-auto mb-4 flex max-w-[900px] flex-wrap items-center justify-between gap-2 print:hidden">
        <p className="text-sm text-slate-600">
          Scanned invoice copy · {livId}
        </p>
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

      <article className="mx-auto max-w-[900px] border border-slate-800 bg-white p-4 text-[12px] text-black shadow-sm sm:p-6 print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-0.5 leading-snug">
            <p>{data.sellerAddress || ""}</p>
            {data.sellerTel ? <p>Tel : {data.sellerTel}</p> : null}
            {data.sellerFax != null && data.sellerFax !== undefined ? (
              <p>fax: {data.sellerFax}</p>
            ) : null}
            {data.sellerEmail ? <p>E-mail : {data.sellerEmail}</p> : null}
            {data.sellerTin ? <p>TIN : {data.sellerTin}</p> : null}
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-3">
              <Image src={RRA_LOGO_PATH} alt="RRA" width={120} height={48} className="h-12 w-auto" priority />
              <Image src={RRA_LOGO2_PATH} alt="Rwanda" width={56} height={56} className="h-14 w-14" priority />
            </div>
            <p>Kigali, le {data.invoiceDate || data.date || ""}</p>
            {(buyerName || data.buyerTin || data.buyerLocation) && (
              <div className="mt-1 min-w-[200px] border border-black px-2 py-1 text-left">
                {buyerName ? <p className="font-semibold">{buyerName}</p> : null}
                {data.buyerLocation ? <p>{data.buyerLocation}</p> : null}
                {buyerName ? <p>{buyerName}</p> : null}
                {data.buyerTin ? <p>TIN : {data.buyerTin}</p> : null}
              </div>
            )}
          </div>
        </header>

        <h1 className="mt-6 text-xl font-bold tracking-wide">{invoiceLabel}</h1>
        <p className="mt-1">
          {[
            data.paymentName ? `REFERENCE : ${data.paymentName}` : null,
            total != null ? `: ${money(total, currency)}` : null,
            data.servedBy ? `SERVED BY ${data.servedBy}` : null,
          ]
            .filter(Boolean)
            .join(" ")}
        </p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse border border-black text-[11px]">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-black px-1 py-1 text-left">CODE</th>
                <th className="border border-black px-1 py-1 text-left">DESIGNATION</th>
                <th className="border border-black px-1 py-1 text-right">QTE</th>
                <th className="border border-black px-1 py-1 text-right">P.U. TTC</th>
                <th className="border border-black px-1 py-1 text-center">TAX</th>
                <th className="border border-black px-1 py-1 text-right">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={`${it.name}-${i}`}>
                  <td className="border border-black px-1 py-1">{it.itemCode || it.code || ""}</td>
                  <td className="border border-black px-1 py-1">{it.name}</td>
                  <td className="border border-black px-1 py-1 text-right">{it.qty}</td>
                  <td className="border border-black px-1 py-1 text-right">
                    {Number(it.unitPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="border border-black px-1 py-1 text-center">{it.tax || "B"}</td>
                  <td className="border border-black px-1 py-1 text-right">
                    {Number(it.amount ?? (it.qty || 0) * (it.unitPrice || 0)).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                </tr>
              ))}
              {Array.from({ length: Math.max(0, 6 - items.length) }).map((_, i) => (
                <tr key={`empty-${i}`}>
                  <td className="border border-black px-1 py-3" colSpan={6}>
                    &nbsp;
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-2 overflow-x-auto">
          <table className="w-full border-collapse border border-black text-[11px]">
            <thead>
              <tr>
                <th className="border border-black px-1 py-1">TOTAL A EX RWF</th>
                <th className="border border-black px-1 py-1">TOTAL B 18% RWF</th>
                <th className="border border-black px-1 py-1">TOTAL C 0% RWF</th>
                <th className="border border-black px-1 py-1">TOTAL TAX B RWF</th>
                <th className="border border-black px-1 py-1">TOTAL TAX RWF</th>
                <th className="border border-black px-1 py-1">TOTAL RWF</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-black px-1 py-1 text-right">0.00</td>
                <td className="border border-black px-1 py-1 text-right">0.00</td>
                <td className="border border-black px-1 py-1 text-right">0.00</td>
                <td className="border border-black px-1 py-1 text-right">0.00</td>
                <td className="border border-black px-1 py-1 text-right">0.00</td>
                <td className="border border-black px-1 py-1 text-right font-bold">
                  {Number(total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <section className="mt-6 grid gap-4 border-t border-black pt-3 sm:grid-cols-3">
          <div className="space-y-1 font-mono text-[11px]">
            <p>BK :</p>
            <p>BK :</p>
            <p>BK :</p>
            <p>CODE MoMo:</p>
          </div>
          <div className="space-y-1 font-mono text-[11px]">
            <p className="font-sans font-bold">SDC INFORMATION</p>
            <p>TIME SDC : {data.timeSdc || "—"}</p>
            <p>SDC ID: {data.sdcId || "—"}</p>
            <p className="break-all">Internal Data: {data.sdcInternalData || "—"}</p>
            <p className="break-all">Receipt Signature: {data.receiptSignature || "—"}</p>
            <p>RECEIPT NUMBER: {data.receiptNumber || "—"}</p>
          </div>
          <div className="space-y-1 font-mono text-[11px]">
            <p className="font-sans font-bold">MRC INFORMATION</p>
            <p>ITEMS NUMBER: {data.itemsNumber ?? items.length}</p>
            <p>TIME MRC: {data.timeMrc || data.timeSdc || "—"}</p>
            <p>MRC: {data.mrc || "—"}</p>
            <p>INVOICE NUMBER: {data.invoiceNumber || "—"}</p>
            {data.ishyigaVersion ? <p>{data.ishyigaVersion}</p> : null}
          </div>
        </section>

        <footer className="mt-4 flex flex-wrap items-start justify-between gap-3 border border-black p-2">
          {data.conditionsFr ? (
            <p className="max-w-[70%] text-[10px] leading-snug">{data.conditionsFr}</p>
          ) : (
            <p className="max-w-[70%] text-[10px] text-slate-400"> </p>
          )}
          {shareUrl ? (
            <div className="rounded bg-white p-1">
              <QRCode value={shareUrl} size={72} />
            </div>
          ) : null}
        </footer>
      </article>
    </main>
  )
}
