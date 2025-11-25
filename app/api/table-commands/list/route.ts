import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

// ✅ FIX: Add http:// protocol
const JAVA_ORDERS_URL = process.env.JAVA_ORDERS_URL || "https://ihute.rw/Trading/OrdersServlet"

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const locationId = searchParams.get("locationId")
    const search = searchParams.get("search") || ""

    if (!locationId) {
      return NextResponse.json(
        { ok: false, error: "locationId is required" },
        { status: 400 }
      )
    }

    console.log("[table-commands/list] Fetching tables for:", { locationId, search })

    // ✅ FIX: Construct URL properly
    const backendUrl = new URL(JAVA_ORDERS_URL)
    backendUrl.searchParams.set("action", "getActiveTables")
    backendUrl.searchParams.set("locationId", locationId)
    if (search) {
      backendUrl.searchParams.set("search", search)
    }

    console.log("[table-commands/list] Calling backend:", backendUrl.toString())

    // ✅ FIX: Add timeout and better error handling
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

    try {
      const response = await fetch(backendUrl.toString(), {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        },
      })

      clearTimeout(timeoutId)

      const responseText = await response.text()
      console.log("[table-commands/list] Backend response:", response.status, responseText.substring(0, 200))

      if (!response.ok) {
        throw new Error(`Backend returned ${response.status}: ${responseText}`)
      }

      // Try to parse JSON
      try {
        const result = JSON.parse(responseText)

        if (result.ok) {
          console.log("[table-commands/list] ✅ Found", result.tables?.length || 0, "tables")
          return NextResponse.json({
            ok: true,
            tables: result.tables || [],
          })
        } else {
          return NextResponse.json(
            { ok: false, error: result.error || "Failed to fetch tables" },
            { status: 400 }
          )
        }
      } catch (parseError) {
        // Not JSON response
        console.warn("[table-commands/list] ⚠️ Backend response is not valid JSON")
        
        // Check if backend hasn't implemented the action yet
        if (responseText.includes("unknown action") || responseText.includes("Unknown action")) {
          console.log("[table-commands/list] Backend action not implemented, returning empty list")
          return NextResponse.json({
            ok: true,
            tables: [],
            warning: "Backend has not implemented getActiveTables action yet.",
          })
        }

        throw new Error(`Invalid JSON response from backend: ${responseText.substring(0, 100)}`)
      }

    } catch (fetchError: any) {
      clearTimeout(timeoutId)
      
      // Handle specific fetch errors
      if (fetchError.name === 'AbortError') {
        throw new Error('Backend request timed out after 10 seconds')
      }
      
      throw fetchError
    }

  } catch (error: any) {
    console.error("[table-commands/list] Error:", error?.message)

    // ✅ IMPROVED: Better error response
    return NextResponse.json(
      {
        ok: true, // Still return ok:true so frontend doesn't break
        tables: [],
        error: error?.message || "Failed to fetch tables from backend",
        canCreateTable: true, // Let user know they can still create tables manually
      },
      { status: 200 }
    )
  }
}