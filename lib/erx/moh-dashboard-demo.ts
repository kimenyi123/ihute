import type { ErxDashboardStats } from "@/lib/erx/erx-tracking"

/** Demo journey data when erx_tracking is empty or DB offline. */
export const MOH_ERX_DEMO_STATS: ErxDashboardStats = {
  totalRequested: 2847,
  totalServed: 2512,
  totalFailed: 335,
  avgResponseMs: 842,
  slaStarsPct: 78,
  slaStockPct: 71,
  stockAvailabilityPct: 68,
  discoveryRatePct: 42,
  pharmaciesSyncedLt3h: 94,
  pharmaciesTotal: 171,
  journeyFunnel: [
    { stage: "Unlock", count: 2847, pct: 100 },
    { stage: "Candidates", count: 2610, pct: 92 },
    { stage: "RFQ sent", count: 1984, pct: 70 },
    { stage: "Quote received", count: 1246, pct: 44 },
    { stage: "Served", count: 2512, pct: 88 },
  ],
  weeklyTrend: [312, 389, 401, 378, 420, 445, 502],
  discoveryBreakdown: [
    { label: "0 pharmacies", pct: 18 },
    { label: "1 pharmacy", pct: 34 },
    { label: "2–3 pharmacies", pct: 28 },
    { label: "4+ pharmacies", pct: 20 },
  ],
  recent: [
    {
      id: 9001,
      requested_at: new Date(Date.now() - 4 * 60_000).toISOString(),
      event_type: "CHOOSE",
      erx_code: "EP-0317-170",
      status: "SUCCESS",
      unlock_key_hint: "***7821",
      duration_ms: 910,
      picked_pharmacy_name: "Rite Pharmacy Nyarutarama",
      service_stage: "QUOTES",
    },
    {
      id: 9000,
      requested_at: new Date(Date.now() - 11 * 60_000).toISOString(),
      event_type: "RFQ",
      erx_code: "EP-0317-170",
      status: "SUCCESS",
      unlock_key_hint: "***7821",
      duration_ms: 1240,
      pharmacies_inserted: 3,
      picked_pharmacy_name: "IH-893444",
      service_stage: "RFQ",
    },
    {
      id: 8999,
      requested_at: new Date(Date.now() - 12 * 60_000).toISOString(),
      event_type: "LOOKUP",
      erx_code: "EP-0317-170",
      status: "SUCCESS",
      unlock_key_hint: "Jean",
      duration_ms: 780,
      patient_display_name: "Jean Pierre U.",
      drug_count: 3,
      service_stage: "UNLOCK",
    },
    {
      id: 8998,
      requested_at: new Date(Date.now() - 28 * 60_000).toISOString(),
      event_type: "LOOKUP",
      erx_code: "EP-0421-088",
      status: "FAIL",
      fail_code: "ERX_IDENTITY_MISMATCH",
      unlock_key_hint: "***0092",
      duration_ms: 650,
      service_stage: "UNLOCK",
    },
    {
      id: 8997,
      requested_at: new Date(Date.now() - 45 * 60_000).toISOString(),
      event_type: "RFQ",
      erx_code: "EP-0199-221",
      status: "SUCCESS",
      unlock_key_hint: "***4412",
      duration_ms: 1100,
      pharmacies_inserted: 1,
      service_stage: "RFQ",
    },
  ],
}

export function mergeWithDemoStats(live: ErxDashboardStats | null): {
  stats: ErxDashboardStats
  demoMode: boolean
} {
  const empty =
    !live ||
    (live.totalRequested === 0 && live.recent.length === 0 && live.pharmaciesTotal === 0)
  if (empty) {
    return { stats: MOH_ERX_DEMO_STATS, demoMode: true }
  }
  return { stats: live, demoMode: false }
}
