import { NextRequest, NextResponse } from "next/server"

import { ERX_MOCK_ENABLED } from "@/lib/erx/erx-market-flags"
import { fetchPharmacyMetricsByIds, pingErxMysql } from "@/lib/erx/erx-mysql"
import { KIGALI, haversineKm, mockNearbyPharmacies } from "@/lib/erx/erx-market-mock"
import type { ErxCandidatePharmacy } from "@/lib/erx/erx-market-types"
import { getSectorListSuppliersUrl, warmJavaBackendBase } from "@/lib/backend-config"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/pharmacies/nearby?lat&lng — eRx market step 3 candidates.
 * Real mode: Kaos sectorListSuppliers(pharmacy) + beta MySQL metrics (pharmacy_metrics
 * or seller_add_stock heartbeat). Mock only when NEXT_PUBLIC_ERX_MOCK=1.
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
    target.searchParams.set("limit", "100")
    const res = await fetch(target.toString(), {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) throw new Error(`sectorListSuppliers HTTP ${res.status}`)
    const raw = (await res.json()) as Array<Record<string, unknown>>
    let pharmacies: ErxCandidatePharmacy[] = (Array.isArray(raw) ? raw : [])
      .map((s, ix) => {
        const name = String(s.SUPPLIER_NAME ?? s.supplierName ?? s.name ?? "").trim()
        const pLat = Number(s.GPS_LATITUDE ?? s.lat ?? s.latitude) || 0
        const pLng = Number(s.GPS_LONGITUDE ?? s.lng ?? s.longitude) || 0
        return {
          id: String(s.SUPPLIER_ACCOUNT ?? s.supplierAccount ?? s.id ?? `ph-${ix}`),
          name,
          zone: String(s.SECTOR_NAME ?? s.zone ?? s.address ?? "").trim(),
          lat: pLat,
          lng: pLng,
          distKm: pLat && pLng ? haversineKm(pos, { lat: pLat, lng: pLng }) : 99,
          stars: 4.5,
          stockAcc: 3,
          lastSyncMin: 999,
          priceFactor: 1,
        }
      })
      .filter((p) => p.name)
      .sort((a, b) => a.distKm - b.distKm)

    if (!pharmacies.length) {
      return NextResponse.json({ ok: false, code: "ERX_NO_PHARMACIES" }, { status: 502 })
    }

    const dbPing = await pingErxMysql()
    if (dbPing.ok) {
      const metrics = await fetchPharmacyMetricsByIds(pharmacies.map((p) => p.id))
      pharmacies = pharmacies.map((p) => {
        const m = metrics.get(p.id)
        return m ? { ...p, stars: m.stars, stockAcc: m.stockAcc, lastSyncMin: m.lastSyncMin } : p
      })
    } else if (process.env.NODE_ENV !== "production") {
      console.warn("[erx/pharmacies] MySQL unavailable:", dbPing.error)
    }

    return NextResponse.json({ ok: true, mock: false, db: dbPing.ok, pharmacies })
  } catch (e) {
    console.error("[erx/pharmacies]", e)
    return NextResponse.json(
      { ok: false, code: "ERX_PHARMACIES_UNAVAILABLE", message: (e as Error).message },
      { status: 502 },
    )
  }
}
