import { NextResponse } from "next/server"

const JAVA_SUPPLIER_URL = process.env.JAVA_SUPPLIER_URL || "http://localhost:8080/Trading/SupplierServlet"

/**
 * GET /api/supplier/stats
 *
 * Fetches live supplier dashboard statistics from Redis/Database
 *
 * Query Parameters:
 * - account: Supplier's ISHYIGA_ACCOUNT (required)
 * - startDate: Filter start date (optional, format: YYYY-MM-DD)
 * - endDate: Filter end date (optional, format: YYYY-MM-DD)
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const account = searchParams.get("account")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    if (!account) {
      return NextResponse.json(
        { ok: false, error: "Supplier account is required" },
        { status: 400 }
      )
    }

    // Mock response if backend not configured
    if (!JAVA_SUPPLIER_URL || JAVA_SUPPLIER_URL.includes("localhost")) {
      console.log("[Supplier Stats] No backend configured, returning mock data")
      return NextResponse.json({
        ok: true,
        stats: {
          totalIncome: 0,
          totalOrders: 0,
          totalProducts: 0,
          lowStockItems: 0,
          inStockItems: 0,
          avgRating: 0,
          newReviews: 0,
          pendingReturns: 0,
          pendingOrders: 0,
          totalCustomers: 0,
          newCustomers: 0,
          repeatCustomerRate: 0,
          avgOrderValue: 0,
          customerLifetimeValue: 0,
        },
        incomeData: [],
        ordersData: [],
        topProducts: [],
        inventoryByCategory: [],
        ratingsDistribution: [],
        recentActivity: [],
        performanceComparison: {
          totalOrders: { current: 0, previous: 0, growth: 0 },
          totalIncome: { current: 0, previous: 0, growth: 0 },
          avgRating: { current: 0, previous: 0, growth: 0 },
          conversionRate: { current: 0, previous: 0, growth: 0 },
        },
      })
    }

    const params = new URLSearchParams()
    params.set("action", "getSupplierStats")
    params.set("account", account)
    if (startDate) params.set("startDate", startDate)
    if (endDate) params.set("endDate", endDate)

    const res = await fetch(`${JAVA_SUPPLIER_URL}?${params.toString()}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    })

    const text = await res.text()
    let json: any

    try {
      json = JSON.parse(text)
    } catch {
      console.error("[Supplier Stats] Backend returned HTML instead of JSON:", text.substring(0, 200))
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
    console.error("[Supplier Stats] Error:", e)
    return NextResponse.json({ ok: false, error: e?.message || "error" }, { status: 400 })
  }
}
