import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

import { getOrdersUrl } from "@/lib/backend-config"

const JAVA_ORDERS_URL = getOrdersUrl()

/**
 * Send Table Order - Lock the table and notify supplier
 *
 * This is called AFTER all members have added their items to cart
 * It combines all orders and sends them to the supplier as one table order
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

    console.log("[table-commands/send] Sending table order:", { tableName, locationId, userEmail })

    // Send table order to backend (this locks the table)
    const url = new URL(JAVA_ORDERS_URL)
    url.searchParams.set("action", "sendTableOrder")
    url.searchParams.set("tableName", tableName)
    url.searchParams.set("locationId", locationId)
    url.searchParams.set("userEmail", userEmail)

    console.log("[table-commands/send] Calling backend:", url.toString())

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
      console.log("[table-commands/send] Backend response:", response.status, responseText.substring(0, 200))

      if (!response.ok) {
        throw new Error(`Backend returned ${response.status}: ${responseText}`)
      }

      try {
        const result = JSON.parse(responseText)

        if (result.ok) {
          console.log("[table-commands/send] ✅ Table order sent successfully")
          return NextResponse.json({
            ok: true,
            message: result.message || "Table order sent successfully",
            tableName: result.tableName,
            orderCount: result.orderCount || 0,
            totalAmount: result.totalAmount || 0,
            orders: result.orders || [],
          })
        } else {
          return NextResponse.json(
            { ok: false, error: result.error || "Failed to send table order" },
            { status: 400 }
          )
        }
      } catch (parseError) {
        console.warn("[table-commands/send] ⚠️ Backend response is not valid JSON")

        if (responseText.includes("unknown action") || responseText.includes("Unknown action")) {
          return NextResponse.json(
            {
              ok: false,
              error: "Backend has not implemented sendTableOrder action yet. Please refer to BACKEND_TABLE_SEND_IMPLEMENTATION.md for implementation guide.",
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
    console.error("[table-commands/send] Error:", error?.message)
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to send table order" },
      { status: 500 }
    )
  }
}
