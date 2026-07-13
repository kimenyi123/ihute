import { NextRequest, NextResponse } from "next/server"
import { getOrdersUrl } from "@/lib/backend-config"
import { buildCisInvoicePdfBytes, type CisInvoiceData } from "@/lib/cis-invoice"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Same CIS/RRA invoice PDF as `/invoice/[livId]` Download.
 * Accepts `orderId` and/or `livId`.
 */
export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get("orderId")?.trim()
  const livIdParam = req.nextUrl.searchParams.get("livId")?.trim() || req.nextUrl.searchParams.get("livid")?.trim()
  if (!orderId && !livIdParam) {
    return NextResponse.json({ ok: false, error: "orderId or livId is required" }, { status: 400 })
  }

  const origin =
    req.headers.get("origin") ||
    req.nextUrl.origin ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://dev.ihute.rw"

  try {
    const note = await fetchInvoiceNote({ orderId, livId: livIdParam, publicSiteUrl: origin })
    if (!note || note.ok === false) {
      return NextResponse.json(
        { ok: false, error: note?.error || "Invoice not found" },
        { status: 404 },
      )
    }
    const state = String(note.documentState || "").toUpperCase()
    const status = String(note.orderStatus || "").toUpperCase()
    if (state !== "INVOICED" && status !== "INVOICE") {
      return NextResponse.json(
        { ok: false, error: "Order is not invoiced yet" },
        { status: 409 },
      )
    }

    const livId = String(note.livId || note.livid || livIdParam || "").trim()
    if (livId && !note.invoiceUrl) {
      note.invoiceUrl = `${origin.replace(/\/+$/, "")}/invoice/${encodeURIComponent(livId)}`
    }
    if (livId && !note.livId) {
      note.livId = livId
      note.livid = livId
    }

    const bytes = await buildCisInvoicePdfBytes(note, origin)
    const filename = `invoice-${livId || orderId || "copy"}.pdf`
    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename=${filename}`,
        "Cache-Control": "private, max-age=60",
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to build invoice PDF"
    return NextResponse.json({ ok: false, error: msg }, { status: 502 })
  }
}

async function fetchInvoiceNote(args: {
  orderId?: string | null
  livId?: string | null
  publicSiteUrl: string
}): Promise<CisInvoiceData | null> {
  const base = getOrdersUrl()
  if (args.livId) {
    const url = new URL(base)
    url.searchParams.set("livid", args.livId)
    url.searchParams.set("publicSiteUrl", args.publicSiteUrl)
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    })
    return (await res.json().catch(() => null)) as CisInvoiceData | null
  }

  const url = new URL(base)
  url.searchParams.set("action", "getDeliveryNote")
  url.searchParams.set("orderId", String(args.orderId))
  url.searchParams.set("publicSiteUrl", args.publicSiteUrl)
  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  })
  return (await res.json().catch(() => null)) as CisInvoiceData | null
}
