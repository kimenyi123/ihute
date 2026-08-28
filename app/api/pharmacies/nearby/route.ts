import { NextRequest, NextResponse } from "next/server"

import { ERX_MOCK_ENABLED } from "@/lib/erx/erx-market-flags"
import { KIGALI, haversineKm, mockNearbyPharmacies } from "@/lib/erx/erx-market-mock"
import type { ErxCandidatePharmacy } from "@/lib/erx/erx-market-types"
import { getSectorListSuppliersUrl, warmJavaBackendBase } from "@/lib/backend-config"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/pharmacies/nearby?lat&lng — eRx market step 3 candidates.
 * ALL pharmacies serving the area are candidates, closest first (MoH drug
 * codes differ from pharmacy codes, so every nearby counter gets the RFQ and
 * confirms item + price itself).
 *
 * Real mode maps the existing Kaos sectorListSuppliers(sector=pharmacy)
 * payload; stars/stockAcc/lastSync come from pharmacy_metrics once the
 * nightly job lands (TODO — defaults until then). Mock mode (or an
 * unreachable backend) serves the spec dataset so demos never dead-end.
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
    const pharmacies: ErxCandidatePharmacy[] = (Array.isArray(raw) ? raw : [])
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
          // TODO(real): read from pharmacy_metrics (stars 90d, stock_acc 30d, last POS heartbeat).
          stars: 4.5,
          stockAcc: 3,
          lastSyncMin: 999,
          priceFactor: 1,
        }
      })
      .filter((p) => p.name)
      .sort((a, b) => a.distKm - b.distKm)
    if (!pharmacies.length) throw new Error("no pharmacies in payload")
    return NextResponse.json({ ok: true, mock: false, pharmacies })
  } catch (e) {
    console.warn("[erx/pharmacies] falling back to mock list:", (e as Error).message)
    return NextResponse.json({ ok: true, mock: true, pharmacies: mockNearbyPharmacies(pos) })
  }
}