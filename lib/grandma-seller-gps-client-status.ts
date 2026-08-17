/** Browser-safe GPS sync status (no infrastructure details). */
export type GrandmaGpsPersistClientStatus = {
  ok: boolean
  skipped: boolean
  reason: string | null
}

export type SellerGpsPersistResultForClient =
  | { ok: true; updatedSeller: number; updatedSignup: number }
  | { ok: false; skipped: boolean; error: string }

export function toClientGpsPersistStatus(
  result: SellerGpsPersistResultForClient | null | undefined,
): GrandmaGpsPersistClientStatus {
  if (!result) {
    return {
      ok: false,
      skipped: true,
      reason: "GPS persistence did not run",
    }
  }
  if (result.ok) {
    return { ok: true, skipped: false, reason: null }
  }
  if (result.skipped) {
    return {
      ok: false,
      skipped: true,
      reason: "GPS persistence database is not configured",
    }
  }
  return {
    ok: false,
    skipped: false,
    reason: "GPS persistence failed",
  }
}
