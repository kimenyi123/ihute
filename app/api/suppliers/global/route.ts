// app/api/suppliers/global/route.ts
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

type RequestBody = {
  latitude: number
  longitude: number
  radius?: number
  limit?: number
  country?: string
}

type Supplier = {
  supplierId: string
  supplierName: string
  location?: string
  distance: number
  latitude?: number
  longitude?: number
  productCount?: number
}

type BackendResponse = {
  ok?: boolean
  suppliers?: Supplier[]
  error?: string
}

import { getFetchSuggestionsUrl } from "@/lib/backend-config"

/**
 * Global Supplier Search API
 * Finds suppliers globally based on GPS coordinates
 */
export async function POST(request: Request) {
  try {
    const body: RequestBody = await request.json()
    const { latitude, longitude, radius = 50, limit = 20, country } = body

    // Validate coordinates
    if (!latitude || !longitude) {
      return NextResponse.json(
        { error: 'Latitude and longitude are required' },
        { status: 400 }
      )
    }

    // Validate coordinate ranges
    const lat = parseFloat(latitude.toString())
    const lon = parseFloat(longitude.toString())

    if (isNaN(lat) || isNaN(lon)) {
      return NextResponse.json(
        { error: 'Invalid coordinates format' },
        { status: 400 }
      )
    }

    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return NextResponse.json(
        { error: 'Coordinates out of valid range' },
        { status: 400 }
      )
    }

    console.log('[global-suppliers] Searching globally:', {
      latitude: lat.toFixed(6),
      longitude: lon.toFixed(6),
      radius,
      limit,
      country: country || 'auto'
    })

    // Call Java backend with dynamic geocoding
    const javaResponse = await fetch(getFetchSuggestionsUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'getNearestSuppliersGlobal',
        latitude: lat,
        longitude: lon,
        radius,
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
      success: true,
      suppliers: result.suppliers || [],
      userLocation: { latitude: lat, longitude: lon },
      searchMetrics: {
        radius,
        resultsCount: result.suppliers?.length || 0,
        timestamp: new Date().toISOString()
      }
    })

  } catch (error: any) {
    console.error('[global-suppliers] Error:', error?.message)
    return NextResponse.json(
      {
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

  const latitude = searchParams.get('latitude')
  const longitude = searchParams.get('longitude')
  const radius = searchParams.get('radius')
  const limit = searchParams.get('limit')
  const country = searchParams.get('country')

  if (!latitude || !longitude) {
    return NextResponse.json(
      { error: 'Latitude and longitude are required' },
      { status: 400 }
    )
  }

  // Convert to POST body and reuse POST handler
  const body = {
    latitude: parseFloat(latitude),
    longitude: parseFloat(longitude),
    radius: radius ? parseInt(radius) : 50,
    limit: limit ? parseInt(limit) : 20,
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
