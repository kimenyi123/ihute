import { NextRequest, NextResponse } from "next/server"
import { runGrandmaSearch } from "@/lib/grandma-search-mysql"
import {
  GRANDMA_SEARCH_DEFAULT_PAGE_SIZE,
  parseGrandmaSearchRadiusKm,
} from "@/lib/grandma-search"
import { isValidLatLng } from "@/lib/geo-haversine"
import {
  GRANDMA_CATEGORY_TO_SECTOR_SLUG,
  isKnownGrandmaCategoryInput,
} from "@/lib/seller-category-sector"

export const runtime = "nodejs"

/**
 * Grandma production search — MySQL on existing account_signup + seller_add_stock.
 *
 * Query params:
 * - q: search text
 * - sector | category: Grandma sector slug or label
 * - lat, lng: buyer coordinates
 * - nearMe: 1 to enable geo filter/sort
 * - radiusKm: when nearMe, omit/empty → 1 km; `all` → no radius cap
 * - page, pageSize
 * - suggest: 1 to include autocomplete suggestions
 */
export async function GET(req: NextRequest) {
  const rid = crypto.randomUUID()
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
      return NextResponse.json(
        {
          ok: false,
          error: "Unknown category",
          code: "INVALID_CATEGORY",
          rid,
        },
        { status: 400 },
      )
    }

    const latRaw = sp.get("lat")
    const lngRaw = sp.get("lng")
    const lat = latRaw != null && latRaw !== "" ? Number(latRaw) : undefined
    const lng = lngRaw != null && lngRaw !== "" ? Number(lngRaw) : undefined
    const nearMe = sp.get("nearMe") === "1" || sp.get("nearMe") === "true"
    const radiusRaw = sp.get("radiusKm")
    const radiusKm = parseGrandmaSearchRadiusKm(radiusRaw)

    const pageRaw = Number(sp.get("page") || 1)
    const pageSizeRaw = Number(sp.get("pageSize") || GRANDMA_SEARCH_DEFAULT_PAGE_SIZE)
    const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1
    const pageSize =
      Number.isFinite(pageSizeRaw) && pageSizeRaw >= 1
        ? Math.min(100, Math.floor(pageSizeRaw))
        : GRANDMA_SEARCH_DEFAULT_PAGE_SIZE
    const suggest = sp.get("suggest") === "1" || sp.get("suggest") === "true"

    if (latRaw != null && latRaw !== "" && lngRaw != null && lngRaw !== "" && !isValidLatLng(lat, lng)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid latitude or longitude",
          code: "GEO_INVALID",
          rid,
        },
        { status: 400 },
      )
    }

    if (nearMe && !isValidLatLng(lat, lng)) {
      return NextResponse.json(
        {
          ok: false,
          error: "nearMe requires valid lat and lng",
          code: "GEO_REQUIRED",
          rid,
        },
        { status: 400 },
      )
    }

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
    })

    if (!result.ok) {
      return NextResponse.json(
        { ...result, rid },
        { status: result.code === "MYSQL_NOT_CONFIGURED" ? 503 : 500 },
      )
    }

    return NextResponse.json({ ...result, rid })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(`[api/grandma/search] ${rid}`, msg)
    return NextResponse.json(
      { ok: false, error: "Search temporarily unavailable", code: "SEARCH_ERROR", rid },
      { status: 500 },
    )
  }
}
