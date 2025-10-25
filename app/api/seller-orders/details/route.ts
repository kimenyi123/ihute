// app/api/seller-orders/details/route.ts
import { NextResponse } from "next/server"

const PRIMARY_URL =
  process.env.JAVA_ORDERS_URL || "https://ihute.rw/Trading/OrdersServlet"

const FALLBACK_URLS = [
  process.env.JAVA_ORDERS_ALT_URL,
  "https://ihute.rw/Trading/Kaos/OrdersServlet",
].filter(Boolean) as string[]

function safeParse(raw: string) {
  if (!raw) throw new Error("empty body")
  const t = raw.trim()
  if (t.startsWith("<!doctype") || t.startsWith("<html")) throw new Error("html body")
  try { return JSON.parse(raw) } catch {}
  let s = raw.replace(/\uFEFF/g, "").trim()
  const i = s.search(/[{\[]/)
  if (i > 0) s = s.slice(i)
  try { return JSON.parse(s) } catch {}
  s = s.replace(/[\u0000-\u001F\u007F]+/g, " ")
  return JSON.parse(s)
}

function normalize(data: any) {
  const order  = data?.order ?? null
  const items0 =
    (Array.isArray(data?.items) && data.items) ||
    (order && Array.isArray(order.items) ? order.items : []) || []
  const seller = data?.seller ?? null
  const buyer  = data?.buyer ?? null

  const items = items0.map((it: any) => {
    const qty = Number(it.QUANTITY ?? it.qty ?? it.quantity ?? it.ITEM_QTY ?? 0)
    const unitPrice = Number(
      it.UNIT_PRICE ?? it.UNITY_PRICE ?? it.REQUEST_PRICE ?? it.unitPrice ?? it.price ?? 0
    )
    return {
      ITEM_NAME: it.ITEM_NAME ?? it.name ?? "",
      QUANTITY: qty,
      UNIT_PRICE: unitPrice,
      total: qty * unitPrice,
      UNIT: it.UNIT ?? it.unit ?? it.measurement ?? "",
      ITEM_CODE: it.ITEM_CODE ?? it.code ?? String(it.ID_ORDER ?? ""),
      ...it,
    }
  })

  return { order, items, seller, buyer }
}

async function callOrdersServlet(url: string, orderId: string | number) {
  const body = new URLSearchParams({ action: "buyerOrderDetails", orderId: String(orderId) }).toString()
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
    cache: "no-store",
  })
  const text = await res.text()
  let data: any
  try { data = safeParse(text) }
  catch (e: any) {
    return { ok: false as const, http: res.status, error: `Bad/HTML body (${e?.message})`, text }
  }
  if (!res.ok || data?.ok === false) {
    return { ok: false as const, http: res.status, error: data?.error || `HTTP ${res.status}`, text }
  }
  return { ok: true as const, http: res.status, data }
}

async function readOrderId(req: Request): Promise<string | null> {
  // 1) query param
  const url = new URL(req.url)
  const fromQuery = url.searchParams.get("orderId")
  if (fromQuery) return fromQuery

  // 2) JSON body (if present)
  const ct = (req.headers.get("content-type") || "").toLowerCase()
  if (ct.includes("application/json")) {
    try {
      const j = await req.json()
      return j?.orderId ?? j?.id ?? j?.order_id ?? null
    } catch { /* empty/invalid body */ }
  }

  // 3) form body (if present)
  if (ct.includes("application/x-www-form-urlencoded")) {
    const raw = await req.text()
    const sp = new URLSearchParams(raw)
    return sp.get("orderId")
  }

  return null
}

export async function POST(req: Request) {
  try {
    const orderId = await readOrderId(req)
    if (!orderId) {
      return NextResponse.json({ ok: false, error: "orderId required" }, { status: 400 })
    }

    for (const url of [PRIMARY_URL, ...FALLBACK_URLS]) {
      console.log("[details] target:", url, "orderId:", orderId)
      const r = await callOrdersServlet(url, orderId)
      if (r.ok) {
        const out = normalize(r.data)
        return NextResponse.json({ ok: true, ...out })
      }
      console.warn("❌ details: attempt failed:", { url, http: r.http, error: r.error, snippet: (r as any).text?.slice?.(0, 200) })
    }

    return NextResponse.json({ ok: false, error: "Failed to load order details" }, { status: 502 })
  } catch (e: any) {
    console.error("❌ details: unexpected error:", e?.message)
    return NextResponse.json({ ok: false, error: e?.message || "unknown error" }, { status: 500 })
  }
}
