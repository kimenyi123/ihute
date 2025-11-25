import { NextResponse } from "next/server"

const JAVA_SUPPLIER_URL = process.env.JAVA_SUPPLIER_URL || "http://localhost:8080/Trading/SupplierServlet"

/**
 * GET /api/supplier/expenses/list
 *
 * Get list of expenses for the supplier
 *
 * Query Parameters:
 * - account: Supplier's ISHYIGA_ACCOUNT (required)
 * - startDate: Filter start date (optional, YYYY-MM-DD)
 * - endDate: Filter end date (optional, YYYY-MM-DD)
 * - category: Filter by category (optional)
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const account = searchParams.get("account")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const category = searchParams.get("category")

    if (!account) {
      return NextResponse.json(
        { ok: false, error: "Supplier account is required" },
        { status: 400 }
      )
    }

    // Mock response if backend not configured
    if (!JAVA_SUPPLIER_URL || JAVA_SUPPLIER_URL.includes("localhost")) {
      console.log("[Supplier Expenses] No backend configured, returning mock data")
      return NextResponse.json({
        ok: true,
        expenses: [],
        totalExpenses: 0,
      })
    }

    const params = new URLSearchParams()
    params.set("action", "getExpenses")
    params.set("account", account)
    if (startDate) params.set("startDate", startDate)
    if (endDate) params.set("endDate", endDate)
    if (category) params.set("category", category)

    const res = await fetch(`${JAVA_SUPPLIER_URL}?${params.toString()}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    })

    const text = await res.text()
    let json: any

    try {
      json = JSON.parse(text)
    } catch {
      console.error("[Supplier Expenses] Backend returned HTML instead of JSON:", text.substring(0, 200))
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
    console.error("[Supplier Expenses] Error:", e)
    return NextResponse.json({ ok: false, error: e?.message || "error" }, { status: 400 })
  }
}
