import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

const JAVA_ORDERS_URL = process.env.JAVA_ORDERS_URL || "https://ihute.rw/Trading/OrdersServlet"

/**
 * Complete Table Order - Mark table as completed/delivered
 *
 * This is called AFTER the supplier has prepared and delivered all orders
 * It marks the table order as complete and updates all order statuses
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { tableName, locationId, userEmail } = body

    if (!tableName || !locationId || !userEmail) {
      return NextResponse.json(
        { ok: false, error: "tableName, locationId, and userEmail are required" },
        { status: 400 }
      )
    }

    console.log("[table-commands/complete] Completing table order:", { tableName, locationId, userEmail })

    // Complete table order in backend
    const url = new URL(JAVA_ORDERS_URL)
    url.searchParams.set("action", "completeTableOrder")
    url.searchParams.set("tableName", tableName)
    url.searchParams.set("locationId", locationId)
    url.searchParams.set("userEmail", userEmail)

    console.log("[table-commands/complete] Calling backend:", url.toString())

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 second timeout

    try {
      const response = await fetch(url.toString(), {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        },
      })

      clearTimeout(timeoutId)

      const responseText = await response.text()
      console.log("[table-commands/complete] Backend response:", response.status, responseText.substring(0, 200))

      if (!response.ok) {
        throw new Error(`Backend returned ${response.status}: ${responseText}`)
      }

      try {
        const result = JSON.parse(responseText)

        if (result.ok) {
          console.log("[table-commands/complete] ✅ Table order completed successfully")
          return NextResponse.json({
            ok: true,
            message: result.message || "Table order completed successfully",
            tableName: result.tableName,
            orderCount: result.orderCount || 0,
          })
        } else {
          return NextResponse.json(
            { ok: false, error: result.error || "Failed to complete table order" },
            { status: 400 }
          )
        }
      } catch (parseError) {
        console.warn("[table-commands/complete] ⚠️ Backend response is not valid JSON")

        if (responseText.includes("unknown action") || responseText.includes("Unknown action")) {
          return NextResponse.json(
            {
              ok: false,
              error: "Backend has not implemented completeTableOrder action yet. Please refer to BACKEND_TABLE_COMPLETE_IMPLEMENTATION.md for implementation guide.",
            },
            { status: 501 }
          )
        }

        throw new Error(`Invalid JSON response from backend: ${responseText.substring(0, 100)}`)
      }

    } catch (fetchError: any) {
      clearTimeout(timeoutId)

      if (fetchError.name === 'AbortError') {
        throw new Error('Backend request timed out after 15 seconds')
      }

      throw fetchError
    }

  } catch (error: any) {
    console.error("[table-commands/complete] Error:", error?.message)
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to complete table order" },
      { status: 500 }
    )
  }
}
