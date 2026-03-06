// app/api/supplier/stock/route.ts
import { NextRequest, NextResponse } from "next/server"

import { getBackendBase } from "@/lib/backend-config"

const STOCK_SERVLET_URL = `${getBackendBase()}/SupplierStock`

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

// POST endpoint for adding products and Excel import
export async function POST(req: NextRequest) {
  const controller = new AbortController()
  const searchParams = req.nextUrl.searchParams
  const action = searchParams.get("action")
  // Excel import can take minutes (parse + DB batch + Redis per item); use 5 min for importExcel
  const timeoutMs =
    action === "importExcel"
      ? Number(process.env.SUPPLIER_STOCK_IMPORT_TIMEOUT_MS) || 300000 // 5 min default
      : 30000
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    console.log(`[SUPPLIER-STOCK] POST action: ${action}`)

    const contentType = req.headers.get('content-type') || ''

    let body: any
    let headers: HeadersInit = {}

    // Handle multipart/form-data (Excel upload)
    if (contentType.includes('multipart/form-data')) {
      console.log(`[SUPPLIER-STOCK] Handling multipart upload for action: ${action}`)
      
      const formData = await req.formData()
      body = formData
      
      // Don't set content-type header - let fetch set it with boundary
    } 
    // Handle JSON body (regular API calls)
    else if (contentType.includes('application/json')) {
      const jsonData = await req.json()
      body = JSON.stringify({ ...jsonData, action: action || jsonData.action || "getProducts" })
      headers['Content-Type'] = 'application/json'
      headers['Accept'] = 'application/json'
    }
    else {
      return NextResponse.json(
        { ok: false, error: "Unsupported content type" },
        { status: 400 }
      )
    }

    // Build URL with action parameter for multipart requests
    let url = STOCK_SERVLET_URL
    if (action) {
      url += `?action=${encodeURIComponent(action)}`
    }

    console.log(`[SUPPLIER-STOCK] Calling backend: ${url}`)

    // Forward cookies from the incoming request to the backend
    const cookieHeader = req.headers.get('cookie');
    if (cookieHeader) {
      headers['Cookie'] = cookieHeader;
      console.log(`[SUPPLIER-STOCK] Forwarding cookies to backend`);
    }

    const resp = await fetch(url, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
      cache: "no-store",
    })

    console.log(`[SUPPLIER-STOCK] Backend response status: ${resp.status}`)

    const responseText = await resp.text()
    console.log(`[SUPPLIER-STOCK] Backend response: ${responseText.substring(0, 200)}...`)

    let data: any
    try {
      data = JSON.parse(responseText)
    } catch (parseError) {
      console.error("[SUPPLIER-STOCK] Failed to parse response as JSON:", parseError)
      console.error("[SUPPLIER-STOCK] Raw response:", responseText)
      return NextResponse.json(
        { ok: false, error: "Invalid response from backend: " + responseText.substring(0, 100) },
        { status: 500 }
      )
    }

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


// DELETE endpoint for deleting products
export async function DELETE(req: NextRequest) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), Number(process.env.PROXY_TIMEOUT_MS ?? 12000))

  try {
    const searchParams = req.nextUrl.searchParams
    const itemCode = searchParams.get("itemCode")
    const account = searchParams.get("account")

    console.log(`[SUPPLIER-STOCK] DELETE request - itemCode: ${itemCode}, account: ${account}`)

    if (!itemCode) {
      return NextResponse.json(
        { ok: false, error: "itemCode required" },
        { status: 400 }
      )
    }

    // Build URL with query parameters
    let url = `${STOCK_SERVLET_URL}?itemCode=${encodeURIComponent(itemCode)}`
    if (account) {
      url += `&account=${encodeURIComponent(account)}`
    }

    console.log(`[SUPPLIER-STOCK] Calling backend DELETE: ${url}`)

    // Forward cookies from the incoming request to the backend
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      "Accept": "application/json"
    }
    
    const cookieHeader = req.headers.get('cookie')
    if (cookieHeader) {
      headers['Cookie'] = cookieHeader
      console.log(`[SUPPLIER-STOCK] Forwarding cookies to backend`)
    }

    const resp = await fetch(url, {
      method: "DELETE",
      headers,
      signal: controller.signal,
      cache: "no-store",
    })

    console.log(`[SUPPLIER-STOCK] Backend DELETE response status: ${resp.status}`)

    const responseText = await resp.text()
    let data: any

    try {
      data = JSON.parse(responseText)
    } catch (parseError) {
      console.error("[SUPPLIER-STOCK] Failed to parse DELETE response:", parseError)
      return NextResponse.json(
        { ok: false, error: "Invalid response from backend" },
        { status: 500 }
      )
    }

    if (!resp.ok || !data.ok) {
      return NextResponse.json(
        { ok: false, error: data.error || "Failed to delete product" },
        { status: resp.status || 500 }
      )
    }

    return NextResponse.json(data)

  } catch (e: any) {
    console.error("[SUPPLIER-STOCK] DELETE error:", e)

    if (e.name === 'AbortError') {
      return NextResponse.json(
        { ok: false, error: "Request timeout" },
        { status: 504 }
      )
    }

    return NextResponse.json(
      { ok: false, error: e?.message || "Failed to delete product" },
      { status: 500 }
    )
  } finally {
    clearTimeout(timeout)
  }
}
