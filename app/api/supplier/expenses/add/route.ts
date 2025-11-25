import { NextResponse } from "next/server"

const JAVA_SUPPLIER_URL = process.env.JAVA_SUPPLIER_URL || "https://ihute.rw/Trading/SupplierServlet"

/**
 * POST /api/supplier/expenses/add
 *
 * Add a new expense for the supplier
 *
 * Body:
 * - account: Supplier's ISHYIGA_ACCOUNT (required)
 * - amount: Expense amount (required)
 * - description: Expense description (required)
 * - category: Expense category (optional)
 * - expenseDate: Date of expense (required, YYYY-MM-DD)
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { account, amount, description, category, expenseDate } = body

    if (!account || !amount || !description || !expenseDate) {
      return NextResponse.json(
        { ok: false, error: "Account, amount, description, and expenseDate are required" },
        { status: 400 }
      )
    }

    // Mock response if backend not configured
    if (!JAVA_SUPPLIER_URL || JAVA_SUPPLIER_URL.includes("localhost")) {
      console.log("[Supplier Expenses] No backend configured, returning mock success")
      return NextResponse.json({
        ok: true,
        message: "Expense added successfully (mock)",
        expenseId: Math.random().toString(36).substring(7),
      })
    }

    const params = new URLSearchParams()
    params.set("action", "addExpense")
    params.set("account", account)
    params.set("amount", amount.toString())
    params.set("description", description)
    if (category) params.set("category", category)
    params.set("expenseDate", expenseDate)

    const res = await fetch(JAVA_SUPPLIER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
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
