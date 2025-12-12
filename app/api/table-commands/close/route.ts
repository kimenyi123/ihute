import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

const JAVA_ORDERS_URL =
  process.env.JAVA_ORDERS_URL || "https://ihute.rw/Trading/OrdersServlet"

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

    console.log("[table-commands/close] Closing table:", { tableName, locationId, userEmail })

    // ✅ Build backend URL
    const url = new URL(JAVA_ORDERS_URL)
    url.searchParams.set("action", "closeTable")
    url.searchParams.set("tableName", tableName)
    url.searchParams.set("locationId", locationId)
    url.searchParams.set("userEmail", userEmail)

    console.log("[table-commands/close] Calling backend:", url.toString())

    const response = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store",
    })

    const responseText = await response.text()
    console.log("[table-commands/close] Backend response:", response.status, responseText)

    // ✅ STEP 1: Handle backend success/failure
    if (response.ok) {
      try {
        const result = JSON.parse(responseText)

        // ✅ Handle backend JSON
        if (result.ok) {
          console.log("[table-commands/close] ✅ Table closed successfully")
          return NextResponse.json({
            ok: true,
            message: result.message || "Table closed successfully",
            tableName,
          })
        } else {
          // ✅ IMPROVED: Pass through backend error messages + debug info
          console.warn("[table-commands/close] ⚠️ Backend returned an error:", result.error)
          return NextResponse.json(
            {
              ok: false,
              error: result.error || "Failed to close table",
              debug: result.debug || null, // pass through debug info if present
            },
            { status: 400 }
          )
        }
      } catch (parseError) {
        // ✅ Handle invalid JSON from backend
        console.warn("[table-commands/close] ⚠️ Backend response is not JSON:", responseText)

        if (
          responseText.includes("unknown action") ||
          responseText.includes("Unknown action")
        ) {
          return NextResponse.json(
            {
              ok: false,
              error:
                "Backend has not implemented closeTable action yet. Please refer to BACKEND_TABLE_COMMANDS.md for implementation guide.",
              backendResponse: responseText,
            },
            { status: 501 } // Not Implemented
          )
        }

        // Unexpected non-JSON response
        return NextResponse.json(
          {
            ok: false,
            error: "Invalid backend response format",
            backendResponse: responseText,
          },
          { status: 502 } // Bad Gateway
        )
      }
    }

    // ✅ STEP 2: Handle backend HTTP-level error
    throw new Error(`Backend returned ${response.status}: ${responseText}`)
  } catch (error: any) {
    console.error("[table-commands/close] ❌ Error:", error?.message)
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to close table",
      },
      { status: 500 }
    )
  }
}
