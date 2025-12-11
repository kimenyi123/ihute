import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

// Use your environment variable
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/Trading"
const CANDIDATES = [`${BACKEND_URL}/OrdersServlet`]

type LineIn = {
  name?: string
  item_name?: string
  qty?: number | string
  quantity?: number | string
  unitPrice?: number | string
  price?: number | string
  unit?: string
  measurement?: string
}

export async function GET() {
  return NextResponse.json({ 
    ok: true, 
    route: "/api/orders/create", 
    candidates: CANDIDATES,
    backend: BACKEND_URL 
  })
}

export async function POST(req: Request) {
  try {
    const bodyIn = await req.json().catch(() => ({} as any))

    // ---- normalize lines
    const rawItems: LineIn[] = Array.isArray(bodyIn.items) ? bodyIn.items : []
    const items = rawItems.map((it, i) => ({
      name: (it.name ?? it.item_name ?? `Item ${i + 1}`) as string,
      qty: Number(it.qty ?? it.quantity ?? 1),
      unitPrice: Number(it.unitPrice ?? it.price ?? 0),
      unit: (it.unit ?? it.measurement ?? "") as string,
    }))

    const buyerEmail = String(bodyIn.buyerEmail ?? "")
    const sellerAccount = String(bodyIn.sellerAccount ?? "")

    if (!buyerEmail || !sellerAccount || items.length === 0) {
      return NextResponse.json(
        { ok: false, error: "buyerEmail, sellerAccount and items are required" },
        { status: 400 }
      )
    }

    // ✅ VALIDATE PAYMENT METHOD
    let paymentName = String(bodyIn.paymentName ?? "PAY_ON_DELIVERY").toUpperCase()
    const validPaymentMethods = [
      "PAY_ON_DELIVERY", 
      "PAID_MTN_MOMO", 
      "PAID_CARD",
      "MTN_MOMO",
      "MOMO",
      "CARD"
    ]

    if (!validPaymentMethods.includes(paymentName)) {
      return NextResponse.json(
        { ok: false, error: `Invalid payment method: ${paymentName}` },
        { status: 400 }
      )
    }

    // ✅ GENERATE PAYMENT ID IF NOT PROVIDED
    let paymentId = String(bodyIn.paymentId ?? "")
    if (!paymentId) {
      paymentId = `COD_${Date.now()}`
    }

    // Build shared fields
    const shared = {
      buyerEmail,
      buyerName: String(bodyIn.buyerName ?? ""),
      buyerPhone: String(bodyIn.buyerPhone ?? ""),
      buyerLocation: String(bodyIn.buyerLocation ?? "NA"),
      sellerAccount,
      sellerName: String(bodyIn.sellerName ?? ""),
      sellerPhone: String(bodyIn.sellerPhone ?? ""),
      paymentName,
      paymentId,
      reference: String(bodyIn.reference ?? paymentId),
      currency: String(bodyIn.currency ?? "RWF"),
      items,
      // Table command fields
      isTableCommand: Boolean(bodyIn.isTableCommand),
      tableName: String(bodyIn.tableName ?? ""),
      tableLocation: String(bodyIn.tableLocation ?? ""),
    }

    console.log("[orders/create] Creating order with payment:", {
      paymentName: shared.paymentName,
      paymentId: shared.paymentId,
      buyerEmail: shared.buyerEmail,
      sellerAccount: shared.sellerAccount,
      itemsCount: shared.items.length,
      isTableCommand: shared.isTableCommand,
      tableName: shared.tableName || "N/A"
    })

    let lastError = null

    for (const url of CANDIDATES) {
      try {
        console.log("[orders/create] Trying:", url)
        
        // Build form data
        const form = new URLSearchParams()
        form.set("action", "createOrder")
        form.set("buyerEmail", shared.buyerEmail)
        form.set("buyerName", shared.buyerName)
        form.set("buyerPhone", shared.buyerPhone)
        form.set("buyerLocation", shared.buyerLocation)
        form.set("sellerAccount", shared.sellerAccount)
        form.set("sellerName", shared.sellerName)
        form.set("sellerPhone", shared.sellerPhone)
        form.set("paymentName", shared.paymentName)
        form.set("paymentId", shared.paymentId)
        form.set("reference", shared.reference)
        form.set("currency", shared.currency)
        form.set("items", JSON.stringify(shared.items))
        
        // Table command fields
        if (shared.isTableCommand) {
          form.set("isTableCommand", "true")
          form.set("tableName", shared.tableName)
          form.set("tableLocation", shared.tableLocation)
        }

        console.log("[orders/create] Sending form data:", {
          paymentName: shared.paymentName,
          paymentId: shared.paymentId,
          action: "createOrder"
        })

        // Send request with timeout
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout
        
        const res = await fetch(url, {
          method: "POST",
          headers: { 
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json"
          },
          body: form.toString(),
          signal: controller.signal,
          cache: "no-store",
        })
        
        clearTimeout(timeoutId)

        const text = await res.text()
        console.log("[orders/create] Response status:", res.status)
        console.log("[orders/create] Response text (first 500 chars):", text.substring(0, 500))

        let json
        try {
          json = JSON.parse(text)
        } catch (e) {
          console.error("[orders/create] Failed to parse JSON:", e instanceof Error ? e.message : String(e))
          lastError = { 
            status: res.status, 
            raw: text.substring(0, 200),
            url,
            error: "Invalid JSON response from backend"
          }
          continue
        }

        // ✅ Handle backend response properly
        if (json.ok === false) {
          console.log("[orders/create] Backend returned error:", json.error)
          
          // If table is SENT, suggest new table name
          if (json.error && json.error.includes("already been sent")) {
            const tableMatch = json.error.match(/Table '([^']+)'/)
            const tableName = tableMatch ? tableMatch[1] : shared.tableName
            const newTableName = `${tableName}-${Date.now().toString().slice(-4)}`
            
            return NextResponse.json({
              ok: false,
              error: json.error,
              suggestion: `Please use a new table name like: ${newTableName}`,
              tableStatus: "SENT",
              canRetry: true,
              newTableName: newTableName
            }, { status: 400 })
          }
          
          return NextResponse.json({
            ok: false,
            error: json.error || "Backend error",
            details: json
          }, { status: 400 })
        }

        if (json.ok && json.orderId) {
          console.log("[orders/create] ✅ Order created successfully:", { 
            orderId: json.orderId, 
            paymentName: shared.paymentName,
            tableCommand: json.tableCommand ? "YES" : "NO"
          })
          
          return NextResponse.json({ 
            ok: true, 
            orderId: json.orderId, 
            via: url, 
            sellerTel: json?.sellerTel || "",
            paymentName: shared.paymentName,
            tableCommand: json?.tableCommand || null
          })
        }

        lastError = { 
          status: res.status, 
          raw: text.substring(0, 200),
          url,
          json
        }

      } catch (e: any) {
        console.error("[orders/create] Request failed:", e.message)
        lastError = { 
          status: 0, 
          raw: e?.message || "Network error",
          url 
        }
        continue
      }
    }

    // Nothing succeeded
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to create order",
        lastError: lastError,
        hint: `Check if backend is running at: ${BACKEND_URL}`,
        backendUrl: BACKEND_URL
      },
      { status: 502 }
    )

  } catch (e: any) {
    console.error("[orders/create] fatal:", e?.message)
    return NextResponse.json({ 
      ok: false, 
      error: e?.message || "Internal server error" 
    }, { status: 500 })
  }
}