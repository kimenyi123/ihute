import { NextRequest, NextResponse } from "next/server"

import { ERX_MOCK_ENABLED } from "@/lib/erx/erx-market-flags"
import { fetchPharmacyGpsByIds, fetchPharmacyMetricsByIds, pingErxMysql } from "@/lib/erx/erx-mysql"
import { KIGALI, mockNearbyPharmacies } from "@/lib/erx/erx-market-mock"
import { haversineKm, normalizeSupplierLatLng } from "@/lib/geo-haversine"
import type { ErxCandidatePharmacy } from "@/lib/erx/erx-market-types"
import { getSectorListSuppliersUrl, warmJavaBackendBase } from "@/lib/backend-config"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/pharmacies/nearby?lat&lng — eRx market step 3 candidates.
 * Real mode: Kaos sectorListSuppliers(pharmacy) + beta MySQL (rating_star, certificate,
 * seller_add_stock SYNCED_TIME). Mock only when NEXT_PUBLIC_ERX_MOCK=1.
 */
export async function GET(req: NextRequest) {
  const lat = Number(req.nextUrl.searchParams.get("lat")) || KIGALI.lat
  const lng = Number(req.nextUrl.searchParams.get("lng")) || KIGALI.lng
  const pos = { lat, lng }

  if (ERX_MOCK_ENABLED) {
    return NextResponse.json({ ok: true, mock: true, pharmacies: mockNearbyPharmacies(pos) })
  }

  try {
    await warmJavaBackendBase()
    const target = new URL(getSectorListSuppliersUrl())
    target.searchParams.set("sector", "pharmacy")
    target.searchParams.set("limit", "500")
    const res = await fetch(target.toString(), {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) throw new Error(`sectorListSuppliers HTTP ${res.status}`)
    const raw = (await res.json()) as Array<Record<string, unknown>>
    let pharmacies: ErxCandidatePharmacy[] = (Array.isArray(raw) ? raw : [])
      .map((s, ix) => {
        const name = String(
          s.SUPPLIER_NAME ??
            s.supplierName ??
            s.seller_name ??
            s.SELLER_NAME ??
            s.OWNER ??
            s.name ??
            "",
        ).trim()
        const id = String(
          s.SUPPLIER_ACCOUNT ??
            s.supplierAccount ??
            s.seller_account ??
            s.ACC ??
            s.ISHYIGA_ACCOUNT ??
            s.id ??
            `ph-${ix}`,
        ).trim()
        const coords =
          normalizeSupplierLatLng(
            s.GPS_LATITUDE ?? s.supplier_latitude ?? s.latitude ?? s.lat,
            s.GPS_LONGITUDE ?? s.supplier_longitude ?? s.longitude ?? s.lng,
          ) ?? null
        const pLat = coords?.lat ?? 0
        const pLng = coords?.lng ?? 0
        return {
          id,
          name,
          zone: String(
            s.SECTOR_NAME ?? s.seller_location ?? s.LOCATION ?? s.zone ?? s.address ?? "",
          ).trim(),
          lat: pLat,
          lng: pLng,
          distKm: coords ? haversineKm(pos.lat, pos.lng, pLat, pLng) : 99,
          stars: null,
          stockAcc: null,
          lastSyncMin: 999,
          priceFactor: 1,
        }
      })
      .filter((p) => p.id && p.name)
      .sort((a, b) => a.distKm - b.distKm)

    const seenIds = new Set<string>()
    pharmacies = pharmacies.filter((p) => {
      if (seenIds.has(p.id)) return false
      seenIds.add(p.id)
      return true
    })

    if (!pharmacies.length) {
      return NextResponse.json({ ok: false, code: "ERX_NO_PHARMACIES" }, { status: 502 })
    }

    const dbPing = await pingErxMysql()
    let database: string | undefined
    if (dbPing.ok) {
      database = dbPing.database
      const ids = pharmacies.map((p) => p.id)
      const [metrics, gps] = await Promise.all([
        fetchPharmacyMetricsByIds(ids),
        fetchPharmacyGpsByIds(ids),
      ])
      let gpsHits = 0
      pharmacies = pharmacies.map((p) => {
        const m = metrics.get(p.id)
        const g = gps.get(p.id) ?? (p.lat && p.lng ? { lat: p.lat, lng: p.lng } : null)
        if (g) gpsHits++
        const distKm = g ? haversineKm(pos.lat, pos.lng, g.lat, g.lng) : p.distKm
        return {
          ...(m ? { ...p, stars: m.stars, stockAcc: m.stockAcc, lastSyncMin: m.lastSyncMin } : p),
          lat: g?.lat ?? p.lat,
          lng: g?.lng ?? p.lng,
          distKm,
        }
      })
      pharmacies.sort((a, b) => a.distKm - b.distKm)
      return NextResponse.json({
        ok: true,
        mock: false,
        db: true,
        database,
        gpsEnriched: gpsHits,
        pharmacies,
      })
    } else if (process.env.NODE_ENV !== "production") {
      console.warn("[erx/pharmacies] MySQL unavailable:", dbPing.error)
    }

    return NextResponse.json({
      ok: true,
      mock: false,
      db: false,
      database,
      gpsEnriched: 0,
      pharmacies,
    })
  } catch (e) {
    console.error("[erx/pharmacies]", e)
    return NextResponse.json(
      { ok: false, code: "ERX_PHARMACIES_UNAVAILABLE", message: (e as Error).message },
      { status: 502 },
    )
  }
}
