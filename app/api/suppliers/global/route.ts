// app/api/suppliers/global/route.ts
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

type RequestBody = {
  latitude?: number
  lat?: number
  longitude?: number
  lng?: number
  lon?: number
  radius?: number
  radiusKm?: number
  limit?: number
  country?: string
}

type Supplier = {
  supplierId: string
  supplier_id?: string
  supplierName: string
  nickname?: string
  location?: string
  distance: number
  distance_km?: number
  latitude?: number
  longitude?: number
  productCount?: number
  rating?: number
  gps_quality?: string
}

type BackendResponse = {
  ok?: boolean
  suppliers?: Supplier[]
  count?: number
  error?: string
}

const normalizeCoordinate = (value: number | string | null | undefined): number | undefined => {
  if (value === null || value === undefined) return undefined
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

import { getFetchSuggestionsUrl } from "@/lib/backend-config"

/**
 * Global Supplier Search API
 * Finds suppliers globally based on GPS coordinates
 */
export async function POST(request: Request) {
  try {
    const body: RequestBody = await request.json().catch(() => ({}))
    const rawLat = body.latitude ?? body.lat
    const rawLon = body.longitude ?? body.lng ?? body.lon
    const rawRadius = body.radius ?? body.radiusKm
    const limit = Math.max(1, Math.min(100, Number(body.limit) || 20))
    const country = body.country

    // Validate coordinates
    if (rawLat === undefined || rawLat === null || rawLon === undefined || rawLon === null) {
      return NextResponse.json(
        { ok: false, error: 'Latitude and longitude are required' },
        { status: 400 }
      )
    }

    // Validate coordinate ranges
    const lat = normalizeCoordinate(rawLat)
    const lon = normalizeCoordinate(rawLon)

    if (lat === undefined || lon === undefined || !isFinite(lat) || !isFinite(lon)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid coordinates format' },
        { status: 400 }
      )
    }

    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return NextResponse.json(
        { ok: false, error: 'Coordinates out of valid range (lat: -90 to 90, lng: -180 to 180)' },
        { status: 400 }
      )
    }

    const radius = Math.max(0.1, Math.min(500, Number(rawRadius) || 50))

    console.log('[global-suppliers] Searching globally:', {
      latitude: lat.toFixed(6),
      longitude: lon.toFixed(6),
      radius,
      limit,
      country: country || 'auto'
    })

    // Call Java backend
    const javaResponse = await fetch(getFetchSuggestionsUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'getNearestSuppliersGlobal',
        latitude: lat,
        lat,
        longitude: lon,
        lon,
        lng: lon,
        radius,
        radiusKm: radius,
        limit,
        country: country || 'auto'
      })
    })

    if (!javaResponse.ok) {
      const errorText = await javaResponse.text()
      console.error('[global-suppliers] Backend error:', javaResponse.status, errorText)
      throw new Error('Backend service unavailable')
    }

    const result: BackendResponse = await javaResponse.json()

    return NextResponse.json({
      ok: true,
      success: true,
      suppliers: result.suppliers || [],
      count: result.suppliers?.length || 0,
      userLocation: { latitude: lat, longitude: lon },
      searchMetrics: {
        radius,
        radiusKm: radius,
        resultsCount: result.suppliers?.length || 0,
        timestamp: new Date().toISOString()
      }
    })

  } catch (error: any) {
    console.error('[global-suppliers] Error:', error?.message)
    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to search suppliers',
        details: error?.message || 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * GET endpoint for testing
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const rawLat = searchParams.get('latitude') ?? searchParams.get('lat')
  const rawLon = searchParams.get('longitude') ?? searchParams.get('lng') ?? searchParams.get('lon')
  const rawRadius = searchParams.get('radius') ?? searchParams.get('radiusKm')
  const rawLimit = searchParams.get('limit')
  const country = searchParams.get('country')

  if (!rawLat || !rawLon) {
    return NextResponse.json(
      { ok: false, error: 'Latitude and longitude are required' },
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
    country: country || undefined
  }

  // Create a new Request object with POST method
  const postReq = new Request(request.url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json'
    }
  })

  return POST(postReq)
}
