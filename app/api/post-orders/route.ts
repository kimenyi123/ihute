import { NextRequest, NextResponse } from "next/server"
import { getPostOrdersUrl, getProxyTimeoutMs } from "@/lib/backend-config"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

const PROXY_TIMEOUT_MS = Math.max(15000, getProxyTimeoutMs())

/** Escape for XML text content. */
function escapeXml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

/** Build XML payload for Java post_orders from JSON body. */
function buildPostOrdersXml(body: {
  header: {
    ID_INITIATOR: string
    USER_INITIATOR: string
    ID_RECEIVER: string
    USER_RECEIVER: string
    TIME?: string
    TRANSACTION_ID: string
    TRANSACTION_TYPE?: string
    PAYMENT_STATUS?: string
    PAYMENT_TYPE?: string
    PAYMENT_CARD_ID?: string
    TRANSACTION_TAXES?: string | number
    TRANSACTION_AMOUNT: string | number
    INFO_1?: string
    INFO_2?: string
    MSG_UBITANZE?: string
    TRANSACTION_ID_UBITANZE?: string
    CLIENT_GROUP?: string
  }
  ITEMSLINE: Array<{
    ITEM_NAME: string
    CODE_ISHYIGA: string
    NIKI_CODE?: string
    QUANTITY: string | number
    PRICE?: string | number
    BATCH?: string
    EXPIRE_DATE?: string
    BON_LIVRAISON?: string
    PRIX_REVIENS?: string | number
    CONFIRMED_RECEIVED_QUANTITY?: string | number
    INFO?: string
  }>
}): string {
  const h = body.header
  const time = h.TIME ?? new Date().toISOString().replace("T", " ").slice(0, 23)
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<request>\n  <header>\n'
  xml += `    <ID_INITIATOR>${escapeXml(h.ID_INITIATOR)}</ID_INITIATOR>\n`
  xml += `    <USER_INITIATOR>${escapeXml(h.USER_INITIATOR)}</USER_INITIATOR>\n`
  xml += `    <ID_RECEIVER>${escapeXml(h.ID_RECEIVER)}</ID_RECEIVER>\n`
  xml += `    <USER_RECEIVER>${escapeXml(h.USER_RECEIVER)}</USER_RECEIVER>\n`
  xml += `    <TIME>${escapeXml(time)}</TIME>\n`
  xml += `    <TRANSACTION_ID>${escapeXml(String(h.TRANSACTION_ID))}</TRANSACTION_ID>\n`
  xml += `    <TRANSACTION_TYPE>${escapeXml(h.TRANSACTION_TYPE ?? "OPEN")}</TRANSACTION_TYPE>\n`
  xml += `    <PAYMENT_STATUS>${escapeXml(h.PAYMENT_STATUS ?? "NA")}</PAYMENT_STATUS>\n`
  xml += `    <PAYMENT_TYPE>${escapeXml(h.PAYMENT_TYPE ?? "NA")}</PAYMENT_TYPE>\n`
  xml += `    <PAYMENT_CARD_ID>${escapeXml(h.PAYMENT_CARD_ID ?? "")}</PAYMENT_CARD_ID>\n`
  xml += `    <TRANSACTION_TAXES>${escapeXml(String(h.TRANSACTION_TAXES ?? ""))}</TRANSACTION_TAXES>\n`
  xml += `    <TRANSACTION_AMOUNT>${escapeXml(String(h.TRANSACTION_AMOUNT))}</TRANSACTION_AMOUNT>\n`
  xml += `    <INFO_1>${escapeXml(h.INFO_1 ?? "")}</INFO_1>\n`
  xml += `    <INFO_2>${escapeXml(h.INFO_2 ?? "")}</INFO_2>\n`
  xml += `    <MSG_UBITANZE>${escapeXml(h.MSG_UBITANZE ?? "")}</MSG_UBITANZE>\n`
  xml += `    <TRANSACTION_ID_UBITANZE>${escapeXml(h.TRANSACTION_ID_UBITANZE ?? "")}</TRANSACTION_ID_UBITANZE>\n`
  xml += `    <CLIENT_GROUP>${escapeXml(h.CLIENT_GROUP ?? "")}</CLIENT_GROUP>\n`
  xml += "  </header>\n  <ITEMSLINE>\n"

  for (const lin of body.ITEMSLINE) {
    xml += "    <LIN>\n"
    xml += `      <ITEM_NAME>${escapeXml(lin.ITEM_NAME)}</ITEM_NAME>\n`
    xml += `      <CODE_ISHYIGA>${escapeXml(lin.CODE_ISHYIGA)}</CODE_ISHYIGA>\n`
    xml += `      <NIKI_CODE>${escapeXml(lin.NIKI_CODE ?? lin.CODE_ISHYIGA)}</NIKI_CODE>\n`
    xml += `      <QUANTITY>${escapeXml(String(lin.QUANTITY))}</QUANTITY>\n`
    xml += `      <PRICE>${escapeXml(String(lin.PRICE ?? "0.0"))}</PRICE>\n`
    xml += `      <BATCH>${escapeXml(lin.BATCH ?? "NA")}</BATCH>\n`
    xml += `      <EXPIRE_DATE>${escapeXml(lin.EXPIRE_DATE ?? "010160")}</EXPIRE_DATE>\n`
    xml += `      <BON_LIVRAISON>${escapeXml(lin.BON_LIVRAISON ?? "")}</BON_LIVRAISON>\n`
    xml += `      <PRIX_REVIENS>${escapeXml(String(lin.PRIX_REVIENS ?? "0.0"))}</PRIX_REVIENS>\n`
    xml += `      <CONFIRMED_RECEIVED_QUANTITY>${escapeXml(String(lin.CONFIRMED_RECEIVED_QUANTITY ?? "0.0"))}</CONFIRMED_RECEIVED_QUANTITY>\n`
    xml += `      <INFO>${escapeXml(lin.INFO ?? "")}</INFO>\n`
    xml += "    </LIN>\n"
  }
  xml += "  </ITEMSLINE>\n</request>"
  return xml
}

/**
 * GET – health check, returns post_orders URL (no secret data).
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "/api/post-orders",
    postOrdersUrl: getPostOrdersUrl(),
  })
}

/**
 * POST – proxy to Java post_orders (Trading/post_orders).
 * - Content-Type: application/json → build XML from body and forward.
 * - Content-Type: application/xml or text/xml → forward body as-is.
 */
export async function POST(req: NextRequest) {
  const postOrdersUrl = getPostOrdersUrl()
  let xmlBody: string
  const contentType = req.headers.get("content-type") ?? ""

  try {
    if (contentType.includes("application/json")) {
      const json = await req.json()
      xmlBody = buildPostOrdersXml(json)
    } else if (contentType.includes("application/xml") || contentType.includes("text/xml")) {
      xmlBody = await req.text()
    } else {
      return NextResponse.json(
        {
          ok: false,
          error: "Content-Type must be application/json or application/xml",
        },
        { status: 400 }
      )
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Invalid request body"
    return NextResponse.json({ ok: false, error: msg }, { status: 400 })
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS)

  try {
    const res = await fetch(postOrdersUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/xml",
        Accept: "application/xml, text/plain, */*",
      },
      body: xmlBody,
      signal: controller.signal,
      cache: "no-store",
    })
    clearTimeout(timeoutId)

    const text = await res.text()

    if (!res.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: `Backend returned ${res.status}`,
          status: res.status,
          body: text.slice(0, 500),
        },
        { status: res.status >= 500 ? 502 : res.status }
      )
    }

    // Backend often returns "1" or minimal body on success
    const trimmed = text.trim()
    if (/^\d+$/.test(trimmed) || trimmed === "") {
      return NextResponse.json({
        ok: true,
        result: trimmed || "1",
        postOrdersUrl,
      })
    }

    // If backend returns XML or other text, pass through
    try {
      const parsed = JSON.parse(text)
      return NextResponse.json({ ok: true, ...parsed, postOrdersUrl })
    } catch {
      return NextResponse.json({
        ok: true,
        result: text,
        postOrdersUrl,
      })
    }
  } catch (e: unknown) {
    clearTimeout(timeoutId)
    const msg = e instanceof Error ? e.message : String(e)
    const isAbort = e instanceof Error && e.name === "AbortError"
    return NextResponse.json(
      {
        ok: false,
        error: isAbort ? "Request to post_orders timed out" : msg,
        postOrdersUrl,
      },
      { status: 502 }
    )
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  })
}
