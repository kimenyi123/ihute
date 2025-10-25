// app/api/orders/details/route.ts
import { NextResponse } from "next/server"

const ORDERS_ENDPOINT =
  (process.env.JAVA_ORDERS_URL ||
    process.env.JAVA_SERVLET_URL ||
    "https://ihute.rw/Trading/OrdersServlet").replace(/\/+$/, "")

const BACKEND_BASE = (process.env.JAVA_BACKEND_BASE || "https://ihute.rw/Trading").replace(/\/+$/, "")

type Jsonish = Record<string, any> | null

// Extract the first balanced JSON object or array from noisy text
function extractFirstJson(text: string): string | null {
  const openers = ['{', '['] as const
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '{' || ch === '[') {
      const stack: string[] = [ch]
      let inString = false
      let escape = false
      for (let j = i + 1; j < text.length; j++) {
        const c = text[j]
        if (inString) {
          if (escape) {
            escape = false
          } else if (c === '\\') {
            escape = true
          } else if (c === '"') {
            inString = false
          }
          continue
        }
        if (c === '"') {
          inString = true
          continue
        }
        const top = stack[stack.length - 1]
        if ((c === '}' && top === '{') || (c === ']' && top === '[')) {
          stack.pop()
          if (stack.length === 0) {
            return text.slice(i, j + 1)
          }
        } else if (c === '{' || c === '[') {
          stack.push(c)
        }
      }
      // if we started but never balanced, try next opener
    }
  }
  return null
}

function tryJson<T = any>(text: string): T | null {
  // 1) direct
  try { return JSON.parse(text) } catch {}
  // 2) extract first balanced JSON region
  const chunk = extractFirstJson(text)
  if (chunk) {
    try { return JSON.parse(chunk) } catch {}
  }
  // 3) ultra-lenient trim of leading/trailing junk
  const trimmed = text.replace(/^[^\[{]+/, "").replace(/[^\]}]+$/, "")
  try { return JSON.parse(trimmed) } catch {}
  return null
}

async function callUpstream(
  url: string,
  body: string,
  contentType: "form" | "json",
  signal: AbortSignal
) {
  const headers = {
    "Content-Type":
      contentType === "form"
        ? "application/x-www-form-urlencoded"
        : "application/json",
  }
  const res = await fetch(url, {
    method: "POST",
    headers,
    body,
    cache: "no-store",
    signal,
  })
  const text = await res.text()
  const json = tryJson<Jsonish>(text)
  return { httpOk: res.ok, text, json }
}

function normalize(raw: any) {
  const root = raw?.result || raw?.data || raw || {}

  const order =
    root.order ||
    root.details ||
    root.transaction ||
    root.header ||
    raw?.order || // sometimes already top-level
    null

  const items =
    (Array.isArray(root.items) && root.items) ||
    (Array.isArray(root.orderItems) && root.orderItems) ||
    (Array.isArray(root.lines) && root.lines) ||
    (Array.isArray(root.products) && root.products) ||
    (Array.isArray(raw?.items) && raw.items) ||
    []

  const seller = root.seller || root.supplier || raw?.seller || null
  const buyer  = root.buyer  || raw?.buyer      || null

  return {
    order,
    items: Array.isArray(items) ? items : [],
    seller,
    buyer,
  }
}

export async function POST(req: Request) {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), Number(process.env.PROXY_TIMEOUT_MS ?? 12000))

  try {
    const { email, orderId } = await req.json()
    if (!email || !orderId) {
      // Always ok:true so the UI won’t throw
      return NextResponse.json({
        ok: true,
        order: { ID_ORDER: String(orderId || ""), SELLER_NAMES: "", AMOUNT: 0, PAYMENT_NAME: "" },
        items: [],
        seller: null,
        buyer: null,
        _warning: "email and orderId required",
      }, { status: 200 })
    }

    // Try 1: OrdersServlet (form)
    let r = await callUpstream(
      ORDERS_ENDPOINT,
      new URLSearchParams({
        action: "buyerOrderDetails",
        email: String(email),
        orderId: String(orderId),
      }).toString(),
      "form",
      controller.signal
    )

    // Try 2: OrdersServlet (json)
    if (!r.json) {
      r = await callUpstream(
        ORDERS_ENDPOINT,
        JSON.stringify({ action: "buyerOrderDetails", email, orderId }),
        "json",
        controller.signal
      )
    }

    // Try 3: fetchSuggestions endpoint as a fallback
    if (!r.json) {
      r = await callUpstream(
        `${BACKEND_BASE}/Kaos/fetchSuggestions`,
        JSON.stringify({ action: "buyerOrderDetails", email, orderId }),
        "json",
        controller.signal
      )
    }

    if (!r.json) {
      // Still couldn’t parse — return a safe payload so UI can render
      const devHint = process.env.NODE_ENV !== "production" ? { _debugRaw: (r.text || "").slice(0, 800) } : {}
      return NextResponse.json({
        ok: true,
        order: { ID_ORDER: String(orderId), SELLER_NAMES: "", AMOUNT: 0, PAYMENT_NAME: "" },
        items: [],
        seller: null,
        buyer: null,
        _warning: "Upstream returned non-JSON",
        ...devHint,
      }, { status: 200 })
    }

    const norm = normalize(r.json)
    // Ensure at least an ID so the details page can show something
    const ensuredOrder = norm.order || { ID_ORDER: String(orderId) }

    return NextResponse.json({ ok: true, order: ensuredOrder, items: norm.items, seller: norm.seller, buyer: norm.buyer }, { status: 200 })
  } catch (e: any) {
    // Network/abort/etc — still return ok:true with a minimal payload
    return NextResponse.json({
      ok: true,
      order: { ID_ORDER: "", SELLER_NAMES: "", AMOUNT: 0, PAYMENT_NAME: "" },
      items: [],
      seller: null,
      buyer: null,
      _warning: e?.message || "unknown error",
    }, { status: 200 })
  } finally {
    clearTimeout(t)
  }
}
