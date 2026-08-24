import { NextRequest, NextResponse } from "next/server"
import { runGrandmaSearch } from "@/lib/grandma-search-java"
import { warmJavaBackendBase } from "@/lib/backend-config"
import {
  GRANDMA_SEARCH_DEFAULT_PAGE_SIZE,
  parseGrandmaSearchRadiusKm,
  grandmaSearchRadiusParamError,
  GRANDMA_PUBLIC_SEARCH_UNAVAILABLE,
  GRANDMA_PUBLIC_NEARME_UNAVAILABLE,
  GRANDMA_PUBLIC_GPS_PERMISSION,
  GRANDMA_PUBLIC_INVALID_SEARCH,
  GRANDMA_PUBLIC_INVALID_RADIUS,
} from "@/lib/grandma-search"
import { isValidLatLng } from "@/lib/geo-haversine"
import {
  GRANDMA_CATEGORY_TO_SECTOR_SLUG,
  isKnownGrandmaCategoryInput,
} from "@/lib/seller-category-sector"

export const runtime = "nodejs"

/**
 * Grandma production search — Java/Tomcat APIs, then Next.js ranking.
 * Does not open a Next.js MySQL connection.
 *
 * Query params:
 * - q: search text
 * - sector | category: Grandma sector slug or label
 * - lat, lng: buyer coordinates
 * - nearMe: 1 to enable geo filter/sort
 * - radiusKm: when nearMe, omit/empty → 1 km; `all` → no radius cap
 * - page, pageSize
 * - suggest: 1 to include autocomplete suggestions
 * - suggestOnly: 1 to return prefix suggestions without full shop ranking
 */
export async function GET(req: NextRequest) {
  const rid = crypto.randomUUID()
  const started = Date.now()
  let nearMe = false
  try {
    const sp = req.nextUrl.searchParams
    const q = sp.get("q")?.trim() ?? ""
    const category = sp.get("category")?.trim() ?? ""
    let sector = sp.get("sector")?.trim() ?? ""
    if (!sector && category) {
      sector =
        GRANDMA_CATEGORY_TO_SECTOR_SLUG[category as keyof typeof GRANDMA_CATEGORY_TO_SECTOR_SLUG] ||
        category.toLowerCase().replace(/\s+/g, "-")
    }

    const categoryOrSector = sector || category
    if (categoryOrSector && !isKnownGrandmaCategoryInput(categoryOrSector)) {
      console.warn(`[api/grandma/search] ${rid} INVALID_CATEGORY`)
      return NextResponse.json(
        {
          ok: false,
          error: GRANDMA_PUBLIC_INVALID_SEARCH,
        },
        { status: 400 },
      )
    }

    const latRaw = sp.get("lat")
    const lngRaw = sp.get("lng")
    const lat = latRaw != null && latRaw !== "" ? Number(latRaw) : undefined
    const lng = lngRaw != null && lngRaw !== "" ? Number(lngRaw) : undefined
    nearMe = sp.get("nearMe") === "1" || sp.get("nearMe") === "true"
    const radiusRaw = sp.get("radiusKm")
    const radiusErr = grandmaSearchRadiusParamError(radiusRaw)
    if (radiusErr) {
      console.warn(`[api/grandma/search] ${rid} INVALID_RADIUS`)
      return NextResponse.json(
        {
          ok: false,
          error: GRANDMA_PUBLIC_INVALID_RADIUS,
        },
        { status: 400 },
      )
    }
    const radiusKm = parseGrandmaSearchRadiusKm(radiusRaw)

    const pageRaw = Number(sp.get("page") || 1)
    const pageSizeRaw = Number(sp.get("pageSize") || GRANDMA_SEARCH_DEFAULT_PAGE_SIZE)
    const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1
    const pageSize =
      Number.isFinite(pageSizeRaw) && pageSizeRaw >= 1
        ? Math.min(100, Math.floor(pageSizeRaw))
        : GRANDMA_SEARCH_DEFAULT_PAGE_SIZE
    const suggest = sp.get("suggest") === "1" || sp.get("suggest") === "true"
    const suggestOnly = sp.get("suggestOnly") === "1" || sp.get("suggestOnly") === "true"

    if (latRaw != null && latRaw !== "" && lngRaw != null && lngRaw !== "" && !isValidLatLng(lat, lng)) {
      console.warn(`[api/grandma/search] ${rid} GEO_INVALID`)
      return NextResponse.json(
        {
          ok: false,
          error: GRANDMA_PUBLIC_GPS_PERMISSION,
        },
        { status: 400 },
      )
    }

    if (nearMe && !isValidLatLng(lat, lng)) {
      console.warn(`[api/grandma/search] ${rid} GEO_REQUIRED`)
      return NextResponse.json(
        {
          ok: false,
          error: GRANDMA_PUBLIC_GPS_PERMISSION,
        },
        { status: 400 },
      )
    }

    await warmJavaBackendBase()

    const result = await runGrandmaSearch({
      q,
      sector,
      category,
      lat: isValidLatLng(lat, lng) ? lat : undefined,
      lng: isValidLatLng(lat, lng) ? lng : undefined,
      radiusKm: nearMe ? radiusKm : null,
      nearMe,
      page,
      pageSize,
      suggest,
      suggestOnly,
    })

    if (!result.ok) {
      const ms = Date.now() - started
      console.warn(`[api/grandma/search] ${rid} ${result.code} ms=${ms} qLen=${q.length} nearMe=${nearMe}`)
      const unavailable = result.code === "JAVA_UNREACHABLE"
      return NextResponse.json(
        {
          ok: false,
          error: nearMe ? GRANDMA_PUBLIC_NEARME_UNAVAILABLE : GRANDMA_PUBLIC_SEARCH_UNAVAILABLE,
        },
        { status: unavailable ? 503 : 500 },
      )
    }

    const ms = Date.now() - started
    console.info(
      `[api/grandma/search] ${rid} ok total=${result.total} shops=${result.shops.length} sug=${result.suggestions.length} ms=${ms} qLen=${q.length} nearMe=${nearMe} suggestOnly=${suggestOnly}`,
    )
    return NextResponse.json(result)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(`[api/grandma/search] ${rid} SEARCH_ERROR`, msg.slice(0, 160))
    return NextResponse.json(
      { ok: false, error: nearMe ? GRANDMA_PUBLIC_NEARME_UNAVAILABLE : GRANDMA_PUBLIC_SEARCH_UNAVAILABLE },
      { status: 500 },
    )
  }
}
