// app/api/supplier/stock/route.ts
import { NextRequest, NextResponse } from "next/server"

const JAVA_BACKEND_BASE = process.env.JAVA_BACKEND_BASE || "https://ihute.rw"
// const JAVA_BACKEND_BASE = process.env.JAVA_BACKEND_BASE || "http://localhost:8081"
const STOCK_SERVLET_URL = `${JAVA_BACKEND_BASE}/Trading/SupplierStock`

export async function GET(req: NextRequest) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), Number(process.env.PROXY_TIMEOUT_MS ?? 12000))

  try {
    const searchParams = req.nextUrl.searchParams
    const account = searchParams.get("account")

    if (!account) {
      return NextResponse.json(
        { ok: false, products: [], error: "account required" },
        { status: 400 }
      )
    }

    console.log(`[SUPPLIER-STOCK] Fetching products for account: ${account}`)

    const resp = await fetch(`${STOCK_SERVLET_URL}?account=${encodeURIComponent(account)}`, {
      method: "GET",
      headers: { 
        "Content-Type": "application/json",
        "Accept": "application/json" 
      },
      signal: controller.signal,
      cache: "no-store",
    })

    const text = await resp.text()
    let data: any

    try {
      data = JSON.parse(text)
    } catch {
      console.error("[SUPPLIER-STOCK] Failed to parse response")
      return NextResponse.json({ ok: false, products: [] }, { status: 200 })
    }

    // Handle different response formats
    let products: any[] = []
    
    if (Array.isArray(data)) {
      products = data
    } else if (Array.isArray(data?.products)) {
      products = data.products
    } else if (typeof data?.products === "string") {
      // Handle "No products found" string
      products = []
    }

    console.log(`[SUPPLIER-STOCK] Found ${products.length} products (source: ${data.source || 'unknown'})`)

    return NextResponse.json({ 
      ok: true,
      products,
      count: products.length,
      source: data.source || 'unknown'
    }, { status: 200 })

  } catch (e: any) {
    console.error("[SUPPLIER-STOCK] Error:", e)
    
    if (e.name === 'AbortError') {
      return NextResponse.json(
        { ok: false, products: [], error: "Request timeout" },
        { status: 504 }
      )
    }
    
    return NextResponse.json(
      { ok: false, products: [], error: e?.message },
      { status: 200 }
    )
  } finally {
    clearTimeout(timeout)
  }
}

// POST endpoint for adding products
export async function POST(req: NextRequest) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12000)

  try {
    const body = await req.json()
    const action = body.action || "getProducts"

    console.log(`[SUPPLIER-STOCK] POST action: ${action}`)

    const resp = await fetch(STOCK_SERVLET_URL, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Accept": "application/json" 
      },
      body: JSON.stringify({ ...body, action }),
      signal: controller.signal,
      cache: "no-store",
    })

    const data = await resp.json().catch(() => ({ ok: false }))

    if (!resp.ok || !data.ok) {
      return NextResponse.json(
        { ok: false, error: data.error || "Failed to process request" },
        { status: resp.status || 500 }
      )
    }

    return NextResponse.json(data)

  } catch (e: any) {
    console.error("[SUPPLIER-STOCK] POST error:", e)
    return NextResponse.json(
      { ok: false, error: e?.message || "Failed to process request" },
      { status: 500 }
    )
  } finally {
    clearTimeout(timeout)
  }
}