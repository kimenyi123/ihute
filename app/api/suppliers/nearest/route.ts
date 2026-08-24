import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

import { getFetchSuggestionsUrl } from "@/lib/backend-config"

/**
 * ENHANCED Find Nearest Suppliers API
 * 
 * Features:
 * - Uses Java backend for accurate Haversine distance calculation
 * - Checks ALL suppliers (no grid limitations)
 * - Returns exact distances sorted by proximity
 * - Validates Rwanda boundaries
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const rawLat = body.latitude ?? body.lat
    const rawLon = body.longitude ?? body.lng ?? body.lon
    const rawRadius = body.radius ?? body.radiusKm
    const limit = body.limit
    const withStockOnly = body.withStockOnly !== undefined ? body.withStockOnly : true

    // Validate required parameters
    if (rawLat === undefined || rawLat === null || rawLon === undefined || rawLon === null) {
      return NextResponse.json(
        { ok: false, error: "latitude and longitude are required" },
        { status: 400 }
      )
    }

    // Validate coordinates are numbers
    const lat = typeof rawLat === "number" ? rawLat : parseFloat(rawLat)
    const lon = typeof rawLon === "number" ? rawLon : parseFloat(rawLon)

    if (isNaN(lat) || isNaN(lon) || !isFinite(lat) || !isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return NextResponse.json(
        { ok: false, error: "Invalid coordinates (lat: -90 to 90, lng: -180 to 180)" },
        { status: 400 }
      )
    }

    // Validate Rwanda boundaries
    const RWANDA_BOUNDS = {
      minLat: -2.9,
      maxLat: -1.0,
      minLng: 28.8,
      maxLng: 31.0
    }

    const isInRwanda = 
      lat >= RWANDA_BOUNDS.minLat && 
      lat <= RWANDA_BOUNDS.maxLat &&
      lon >= RWANDA_BOUNDS.minLng && 
      lon <= RWANDA_BOUNDS.maxLng

    if (!isInRwanda) {
      console.warn(`[nearest-suppliers] ⚠️ Coordinates outside Rwanda: (${lat}, ${lon})`)
    }

    // Validate and set defaults for radius and limit
    const searchRadius = Math.max(0.1, Math.min(500, Number(rawRadius) || 50)) // 0.1-500 km
    const resultLimit = Math.max(1, Math.min(100, Number(limit) || 20))   // 1-100 results

    console.log("[nearest-suppliers] Finding suppliers near:", {
      latitude: lat.toFixed(6),
      longitude: lon.toFixed(6),
      radius: searchRadius,
      limit: resultLimit,
      withStockOnly,
      inRwanda: isInRwanda
    })

    // Call Java backend with enhanced method
    const url = new URL(getFetchSuggestionsUrl())
    url.searchParams.set("action", "getNearestSuppliers")
    url.searchParams.set("latitude", lat.toString())
    url.searchParams.set("longitude", lon.toString())
    url.searchParams.set("radius", searchRadius.toString())
    url.searchParams.set("limit", resultLimit.toString())
    url.searchParams.set("withStockOnly", withStockOnly.toString())

    console.log("[nearest-suppliers] Calling backend:", url.toString())

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

    try {
      const response = await fetch(url.toString(), {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": "Ishyiga-Next.js-Frontend"
        },
      })

      clearTimeout(timeoutId)

      const responseText = await response.text()
      console.log(
        "[nearest-suppliers] Backend response:",
        response.status,
        responseText.substring(0, 200)
      )

      if (!response.ok) {
        throw new Error(`Backend returned ${response.status}: ${responseText}`)
      }

      try {
        const result = JSON.parse(responseText)

        if (result.ok || result.suppliers) {
          const suppliers = result.suppliers || []
          
          console.log(`[nearest-suppliers] ✅ Found ${suppliers.length} suppliers`)

          // Sort by distance (backend should already do this, but ensure it)
          suppliers.sort((a: any, b: any) => (a.distance || 0) - (b.distance || 0))

          return NextResponse.json({
            ok: true,
            suppliers,
            count: suppliers.length,
            userLocation: {
              latitude: lat,
              longitude: lon,
              inRwanda: isInRwanda
            },
            searchParams: {
              radius: searchRadius,
              limit: resultLimit
            }
          })
        } else {
          return NextResponse.json(
            { 
              ok: false, 
              error: result.error || "Failed to find suppliers",
              userLocation: { latitude: lat, longitude: lon }
            },
            { status: 400 }
          )
        }
      } catch (parseError) {
        console.warn("[nearest-suppliers] ⚠️ Backend response is not valid JSON")

        // Check if backend hasn't implemented the feature yet
        if (
          responseText.includes("unknown action") ||
          responseText.includes("Unknown action") ||
          responseText.includes("Invalid action")
        ) {
          return NextResponse.json(
            {
              ok: false,
              error: "Backend has not implemented getNearestSuppliers action yet",
              hint: "Please update fetchSuggestions.java with enhanced methods",
              suppliers: [],
              userLocation: { latitude: lat, longitude: lon }
            },
            { status: 501 }
          )
        }

        throw new Error(
          `Invalid JSON response from backend: ${responseText.substring(0, 100)}`
        )
      }
    } catch (fetchError: any) {
      clearTimeout(timeoutId)

      if (fetchError.name === "AbortError") {
        throw new Error("Backend request timed out after 30 seconds")
      }

      throw fetchError
    }
  } catch (error: any) {
    console.error("[nearest-suppliers] ❌ Error:", error?.message)
    return NextResponse.json(
      { 
        ok: false, 
        error: error?.message || "Failed to find nearest suppliers",
        suppliers: []
      },
      { status: 500 }
    )
  }
}

/**
 * GET endpoint for testing
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  
  const rawLat = searchParams.get("latitude") ?? searchParams.get("lat")
  const rawLon = searchParams.get("longitude") ?? searchParams.get("lng") ?? searchParams.get("lon")
  const rawRadius = searchParams.get("radius") ?? searchParams.get("radiusKm")
  const rawLimit = searchParams.get("limit")
  const withStockOnly = searchParams.get("withStockOnly") !== "false"

  if (!rawLat || !rawLon) {
    return NextResponse.json(
      { ok: false, error: "latitude and longitude are required" },
      { status: 400 }
    )
  }

  // Convert to POST body and reuse POST handler
  const body = {
    latitude: parseFloat(rawLat),
    longitude: parseFloat(rawLon),
    radius: rawRadius ? parseFloat(rawRadius) : 50,
    radiusKm: rawRadius ? parseFloat(rawRadius) : 50,
    limit: rawLimit ? parseInt(rawLimit) : 20,
    withStockOnly
  }

  // Create a new Request object with POST method
  const postReq = new Request(req.url, {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json"
    }
  })

  return POST(postReq)
}