// app/api/supplier/stock/route.ts
import { NextRequest, NextResponse } from "next/server"

import { getSupplierStockUrl } from "@/lib/backend-config"
import { importStockExcelViaAddProduct } from "@/lib/supplier-stock-excel-import"

const STOCK_SERVLET_URL = getSupplierStockUrl()

type ImportExcelBackendPayload = {
  ok?: boolean
  message?: string
  itemsImported?: number
  itemsUpdated?: number
  rowsParsed?: number
  rowsSkipped?: number
  error?: string
}

/** Abort when client disconnects or route timeout fires. */
function mergeAbortSignals(signals: AbortSignal[]): AbortSignal {
  const anyFn = (AbortSignal as unknown as { any?: (s: AbortSignal[]) => AbortSignal }).any
  if (typeof anyFn === "function") {
    try {
      return anyFn(signals)
    } catch {
      /* continue */
    }
  }
  const c = new AbortController()
  const on = () => {
    try {
      c.abort()
    } catch {
      /* ignore */
    }
  }
  for (const s of signals) {
    if (s.aborted) {
      on()
      break
    }
    s.addEventListener("abort", on)
  }
  return c.signal
}

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

    const lastStockUploadAt =
      data.lastStockUploadAt ??
      data.last_stock_upload_at ??
      null

    return NextResponse.json(
      {
        ok: true,
        products,
        count: products.length,
        source: data.source || "unknown",
        lastStockUploadAt,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "private, no-store, max-age=0, must-revalidate",
        },
      },
    )

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
  let effectiveAction = searchParams.get("action")
  // Excel import can take minutes (parse + DB batch + Redis per item); use 5 min for importExcel
  const timeoutMs =
    effectiveAction === "importExcel"
      ? Number(process.env.SUPPLIER_STOCK_IMPORT_TIMEOUT_MS) || 300000 // 5 min default
      : 30000
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const contentType = req.headers.get('content-type') || ''

    let body: any
    const headers: HeadersInit = {}

    // Handle multipart/form-data (Excel upload)
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData()
      const account =
        searchParams.get("account")?.trim() ||
        String(formData.get("account") ?? "").trim()
      if (!effectiveAction) {
        effectiveAction = String(formData.get("action") ?? "").trim() || null
      }

      if (effectiveAction === "importExcel" && account) {
        const cookie = req.headers.get("cookie") || ""
        const fileEntry = formData.get("file")
        const fileName =
          fileEntry instanceof File
            ? fileEntry.name
            : String(formData.get("fileName") ?? "upload.xlsx")

        const forwardFd = new FormData()
        if (fileEntry instanceof Blob) {
          forwardFd.append("file", fileEntry, fileName)
        }
        forwardFd.append("account", account)

        const urlWithAccount = `${STOCK_SERVLET_URL}?action=importExcel&account=${encodeURIComponent(account)}`
        let data: ImportExcelBackendPayload | null = null
        let backendFailed = false
        let javaUnreachable = false

        try {
          const backendResp = await fetch(urlWithAccount, {
            method: "POST",
            headers: { Cookie: cookie },
            body: forwardFd,
            signal: controller.signal,
            cache: "no-store",
          })
          const responseText = await backendResp.text()
          try {
            data = JSON.parse(responseText) as ImportExcelBackendPayload
          } catch {
            backendFailed = true
          }
          if (!backendResp.ok || data?.ok === false) {
            backendFailed = true
          }
        } catch (e) {
          backendFailed = true
          javaUnreachable = true
          if (e instanceof Error && e.name === "AbortError") {
            clearTimeout(timeout)
            return NextResponse.json(
              {
                ok: false,
                error:
                  "Import timed out. Try fewer rows or split the file, then upload again.",
              },
              { status: 504 },
            )
          }
        }

        const imported =
          (data?.itemsImported ?? 0) + (data?.itemsUpdated ?? 0)
        if (!backendFailed && data?.ok && imported > 0) {
          clearTimeout(timeout)
          return NextResponse.json({
            ...data,
            message:
              data.message ||
              `Imported ${imported} product(s) into your stock.`,
          })
        }

        // Java responded with an error (e.g. POI classpath) — never run destructive fallback.
        if (!javaUnreachable) {
          clearTimeout(timeout)
          const err =
            data?.error ||
            "Bulk import failed on the Java server. Rebuild the WAR (POI jars) and upload again."
          return NextResponse.json(
            {
              ok: false,
              error: err,
              itemsImported: data?.itemsImported ?? 0,
            },
            { status: 502 },
          )
        }

        if (fileEntry instanceof Blob) {
          const merged = mergeAbortSignals([controller.signal, req.signal])
          const fallback = await importStockExcelViaAddProduct(
            fileEntry,
            fileName,
            account,
            cookie,
            merged,
          )
          clearTimeout(timeout)
          const note =
            backendFailed && fallback.ok
              ? " Saved via row-by-row import (Java bulk import was unavailable)."
              : ""
          return NextResponse.json({
            ...fallback,
            message: `${fallback.message || "Import finished."}${note}`,
          })
        }

        clearTimeout(timeout)
        return NextResponse.json(
          {
            ok: false,
            error:
              data?.error ||
              "Bulk import failed. Fix the Java backend and upload again — do not retry repeatedly or counts will stack.",
            itemsImported: data?.itemsImported ?? 0,
          },
          { status: backendFailed ? 502 : 400 },
        )
      }

      body = formData
    } 
    // Handle JSON body (regular API calls)
    else if (contentType.includes('application/json')) {
      const jsonData = await req.json()
      // Use action from body when not in query (e.g. edit page sends action in body only)
      if (!effectiveAction) effectiveAction = jsonData?.action || "getProducts"
      body = JSON.stringify({ ...jsonData, action: effectiveAction })
      headers['Content-Type'] = 'application/json'
      headers['Accept'] = 'application/json'
    }
    else {
      return NextResponse.json(
        { ok: false, error: "Unsupported content type" },
        { status: 400 }
      )
    }

    // Build URL with action parameter so backend receives updateProduct/addProduct etc.
    let url = STOCK_SERVLET_URL
    if (effectiveAction) {
      url += `?action=${encodeURIComponent(effectiveAction)}`
    }

    console.log(`[SUPPLIER-STOCK] POST action: ${effectiveAction}, calling backend: ${url}`)

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
    // Extract itemCode from path: /api/supplier/stock/ITEM123
    const pathname = req.nextUrl.pathname
    const pathSegments = pathname.split('/')
    let itemCode = pathSegments[pathSegments.length - 1] // Get last segment
    
    // If not in path, try query parameters
    if (!itemCode || itemCode === 'stock') {
      itemCode = searchParams.get("itemCode") || ""
    }
    
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
