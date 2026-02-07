import { NextResponse } from "next/server"

import { getSupplierUrl } from "@/lib/backend-config"

const JAVA_SUPPLIER_URL = getSupplierUrl()

/**
 * GET /api/supplier/products/list
 *
 * Fetches supplier products from Redis (fast cache) first, then falls back to database
 *
 * Query Parameters:
 * - account: Supplier's ISHYIGA_ACCOUNT (required)
 * - category: Filter by product category (optional)
 * - status: Filter by status - active/inactive/out-of-stock (optional)
 * - limit: Number of products per page (optional, default: 50)
 * - offset: Pagination offset (optional, default: 0)
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const account = searchParams.get("account")
    const category = searchParams.get("category")
    const status = searchParams.get("status")
    const limit = searchParams.get("limit") || "50"
    const offset = searchParams.get("offset") || "0"

    if (!account) {
      return NextResponse.json(
        { ok: false, error: "Supplier account is required" },
        { status: 400 }
      )
    }

    // Mock response if backend not configured
    if (!JAVA_SUPPLIER_URL || JAVA_SUPPLIER_URL.includes("localhost")) {
      console.log("[Supplier Products] No backend configured, returning mock data")
      return NextResponse.json({
        ok: true,
        products: [],
        total: 0,
        fromCache: false,
      })
    }

    const params = new URLSearchParams()
    params.set("action", "getSupplierProducts")
    params.set("account", account)
    if (category) params.set("category", category)
    if (status) params.set("status", status)
    params.set("limit", limit)
    params.set("offset", offset)

    const res = await fetch(`${JAVA_SUPPLIER_URL}?${params.toString()}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    })

    const text = await res.text()
    let json: any

    try {
      json = JSON.parse(text)
    } catch {
      console.error("[Supplier Products] Backend returned HTML instead of JSON:", text.substring(0, 200))
      return NextResponse.json(
        {
          ok: false,
          error: "Backend is not properly configured. Expected JSON but received HTML.",
        },
        { status: 502 }
      )
    }

    if (!res.ok || !json?.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: json?.error || `HTTP ${res.status}`,
        },
        { status: 502 }
      )
    }

    return NextResponse.json(json)
  } catch (e: any) {
    console.error("[Supplier Products] Error:", e)
    return NextResponse.json({ ok: false, error: e?.message || "error" }, { status: 400 })
  }
}
