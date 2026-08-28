/**
 * eRx Market mock data — the random-response simulator dataset from the
 * validated spec (ihute_erx_sample_v4.html), behind NEXT_PUBLIC_ERX_MOCK=1 so
 * demos run with no backend. Pharmacies, Kigali fallback position and the
 * mock eRx record (EP-0317-170) mirror the spec verbatim.
 */

import type { ErxCandidatePharmacy } from "./erx-market-types"

export const KIGALI = { lat: -1.9536, lng: 30.0606 }

type MockPharmacy = Omit<ErxCandidatePharmacy, "distKm" | "lastSyncMin">

export const MOCK_PHARMACIES: MockPharmacy[] = [
  { id: "med", name: "Mediasol Remera", zone: "Remera", lat: -1.9578, lng: 30.1126, priceFactor: 1.0, stars: 4.8, stockAcc: 5 },
  { id: "vin", name: "Vine Pharmacy", zone: "Gisimenti · Remera", lat: -1.9557, lng: 30.1029, priceFactor: 0.97, stars: 4.6, stockAcc: 4 },
  { id: "rit", name: "Rite Pharmacy", zone: "Nyarutarama", lat: -1.933, lng: 30.0925, priceFactor: 1.04, stars: 4.9, stockAcc: 5 },
  { id: "uni", name: "Unipharma B4", zone: "Nyarutarama", lat: -1.9366, lng: 30.0958, priceFactor: 0.93, stars: 4.1, stockAcc: 3 },
  { id: "tra", name: "Tramed Pharmacy", zone: "Biryogo · Nyamirambo", lat: -1.9789, lng: 30.0533, priceFactor: 1.02, stars: 4.7, stockAcc: 4 },
  { id: "roo", name: "Rootmed Pharmacy", zone: "Masaka", lat: -2.0075, lng: 30.2005, priceFactor: 0.95, stars: 4.4, stockAcc: 4 },
  { id: "zoo", name: "Zoom Pharmacy", zone: "Kimironko", lat: -1.9469, lng: 30.1256, priceFactor: 0.99, stars: 3.9, stockAcc: 2 },
  { id: "jmp", name: "JM Pharmacy", zone: "Kicukiro", lat: -1.9884, lng: 30.1039, priceFactor: 0.91, stars: 4.2, stockAcc: 3 },
]

const SYNC_BUCKETS = [2, 4, 7, 12, 19, 33, 55, 110]

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371
  const d = (x: number) => (x * Math.PI) / 180
  const dLat = d(b.lat - a.lat)
  const dLng = d(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(d(a.lat)) * Math.cos(d(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** All pharmacies as candidates, closest first, with a random last-sync bucket (spec). */
export function mockNearbyPharmacies(pos: { lat: number; lng: number }): ErxCandidatePharmacy[] {
  return MOCK_PHARMACIES.map((p) => ({
    ...p,
    distKm: haversineKm(pos, p),
    lastSyncMin: SYNC_BUCKETS[Math.floor(Math.random() * SYNC_BUCKETS.length)],
  })).sort((a, b) => a.distKm - b.distKm)
}

/** Mock eRx record (spec) — used client-side only when the MoH HIE is not configured. */
export const MOCK_ERX = {
  code: "EP-0317-170",
  patientMasked: "A********* N.",
  patient: "Alphonsine NYIRAHABIMANA",
  items: [
    {
      name: "ALLOPURINOL 300MG TABLET",
      dose: "Uburyo bwo gufata: Dose 5 · ORAL · 2x/1d · iminsi 10",
      qty: 100,
      avgUnit: 85,
    },
    {
      name: "ACETYLSALICYLIC ACID 500MG",
      dose: "Uburyo bwo gufata: Dose 1 · ORAL · 1x/1d · iminsi 3",
      qty: 3,
      avgUnit: 150,
    },
  ],
}

/** Deterministic pseudo market-average unit price for real MoH drugs (mock pricing only). */
export function mockAvgUnitRwf(drugName: string): number {
  let h = 0
  for (let i = 0; i < drugName.length; i++) h = (h * 31 + drugName.charCodeAt(i)) >>> 0
  return 50 + (h % 46) * 10 // 50..500 RWF stepped by 10
}
