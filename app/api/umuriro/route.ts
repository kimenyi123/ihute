// app/api/umuriro/route.ts - Next.js API route for Umuriro payments
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { getUmuriroPaymentUrl } from "@/lib/backend-config"

const DEFAULT_TIMEOUT_MS = 30000

/**
 * GET - Check if Umuriro API is available
 */
export async function GET(req: NextRequest) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

  try {
    const target = getUmuriroPaymentUrl()

    const resp = await fetch(target, {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
      signal: controller.signal,
      cache: "no-store",
    })

    const text = await resp.text()
    let data: any

    try {
      data = JSON.parse(text)
    } catch {
      data = { ok: false, error: "Invalid JSON from backend", raw: text }
    }

    return NextResponse.json(data, {
      status: resp.status,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    })
  } catch (err: any) {
    console.error("[UMURIRO] GET error:", err?.message)
    return NextResponse.json(
      { ok: false, error: err?.message || "Request failed" },
      { status: 500 }
    )
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * POST - Create a new Umuriro payment
 * Body: { shopName, momoCode, phone?, shopCategory?, itemName, priceRwf, quantity }
 */
export async function POST(req: NextRequest) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

  try {
    // Parse request body
    const body = await req.json()
    const { shopName, momoCode, phone, shopCategory, itemName, priceRwf, quantity } = body

    // Validate required fields
    if (!shopName || !momoCode || !itemName) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields: shopName, momoCode, itemName" },
        { status: 400 }
      )
    }

    const target = getUmuriroPaymentUrl()

    console.log("[UMURIRO] Creating payment for:", shopName, "-", itemName)

    const resp = await fetch(target, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        shopName,
        momoCode,
        phone: phone || "",
        shopCategory: shopCategory || "",
        itemName,
        priceRwf: priceRwf || 0,
        quantity: quantity || 1,
      }),
      signal: controller.signal,
      cache: "no-store",
    })

    const text = await resp.text()
    let data: any

    try {
      data = JSON.parse(text)
    } catch {
      console.error("[UMURIRO] Invalid JSON from backend:", text.substring(0, 200))
      data = { ok: false, error: "Invalid response from backend", raw: text }
    }

    return NextResponse.json(data, {
      status: resp.status,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    })
  } catch (err: any) {
    console.error("[UMURIRO] POST error:", err?.message)
    
    if (err?.name === "AbortError") {
      return NextResponse.json(
        { ok: false, error: "Request timeout" },
        { status: 504 }
      )
    }

    return NextResponse.json(
      { ok: false, error: err?.message || "Request failed" },
      { status: 500 }
    )
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * OPTIONS - CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  })
}
