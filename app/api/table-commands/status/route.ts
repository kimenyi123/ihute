import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

const JAVA_ORDERS_URL = process.env.JAVA_ORDERS_URL || "http://localhost:8080/Trading/OrdersServlet"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { tableName, locationId } = body

    if (!tableName || !locationId) {
      return NextResponse.json(
        { ok: false, error: "tableName and locationId are required" },
        { status: 400 }
      )
    }

    // Check table status from backend
    const url = new URL(JAVA_ORDERS_URL)
    url.searchParams.set("action", "checkTableStatus")
    url.searchParams.set("tableName", tableName)
    url.searchParams.set("locationId", locationId)

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    })

    if (response.ok) {
      const result = await response.json()
      if (result.ok) {
        return NextResponse.json({
          ok: true,
          status: result.status, // ACTIVE, SENT, CLOSED
          createdBy: result.createdBy,
          lastSentBy: result.lastSentBy,
        })
      }
    }

    // If backend doesn't have this table or endpoint not implemented, return ACTIVE
    return NextResponse.json({
      ok: true,
      status: "ACTIVE",
      message: "Table not found in backend, assuming ACTIVE",
    })
  } catch (error: any) {
    console.error("[table-commands/status] Error:", error?.message)
    // On error, allow the operation (assume ACTIVE)
    return NextResponse.json({
      ok: true,
      status: "ACTIVE",
      message: "Error checking status, assuming ACTIVE",
    })
  }
}
