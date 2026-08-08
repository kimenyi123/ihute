/**
 * Persist shop GPS onto existing Kaos columns after Grandma seller create.
 * No new tables — reuses supplier_latitude / supplier_longitude on
 * account_seller + account_signup (Near Me reads account_signup).
 */
import {
  createOnboardingMysqlConnection,
  getOnboardingMysqlConfig,
  isMysqlUnreachableError,
} from "@/lib/onboarding-mysql"
import { isValidLatLng } from "@/lib/geo-haversine"

export type SellerGpsPersistInput = {
  ishyigaAccount: string
  latitude: number
  longitude: number
  gpsAccuracy?: number | null
}

export type SellerGpsPersistResult =
  | { ok: true; updatedSeller: number; updatedSignup: number }
  | { ok: false; skipped?: boolean; error: string }

export async function persistGrandmaSellerGps(
  input: SellerGpsPersistInput,
): Promise<SellerGpsPersistResult> {
  const account = String(input.ishyigaAccount ?? "").trim()
  if (!account) return { ok: false, error: "missing ishyigaAccount" }
  if (!isValidLatLng(input.latitude, input.longitude)) {
    return { ok: false, error: "invalid latitude/longitude" }
  }
  if (!getOnboardingMysqlConfig()) {
    return { ok: false, skipped: true, error: "MySQL not configured" }
  }

  const lat = Number(input.latitude)
  const lng = Number(input.longitude)
  const accuracy =
    input.gpsAccuracy != null && Number.isFinite(Number(input.gpsAccuracy))
      ? Math.round(Number(input.gpsAccuracy) * 100) / 100
      : null

  let conn
  try {
    conn = await createOnboardingMysqlConnection()
    const [sellerResult] = await conn.execute(
      `UPDATE account_seller
       SET supplier_latitude = ?,
           supplier_longitude = ?,
           gps_accuracy = COALESCE(?, gps_accuracy),
           gps_last_updated = CURRENT_TIMESTAMP,
           location_source = 'AUTO'
       WHERE ishyiga_account = ?`,
      [lat, lng, accuracy, account],
    )
    const [signupResult] = await conn.execute(
      `UPDATE account_signup
       SET supplier_latitude = ?,
           supplier_longitude = ?,
           gps_accuracy = COALESCE(?, gps_accuracy),
           gps_last_updated = CURRENT_TIMESTAMP
       WHERE ISHYIGA_ACCOUNT = ?`,
      [lat, lng, accuracy, account],
    )
    const updatedSeller = Number((sellerResult as { affectedRows?: number }).affectedRows ?? 0)
    const updatedSignup = Number((signupResult as { affectedRows?: number }).affectedRows ?? 0)
    return { ok: true, updatedSeller, updatedSignup }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (isMysqlUnreachableError(e)) {
      return { ok: false, skipped: true, error: `MySQL unreachable: ${msg}` }
    }
    return { ok: false, error: msg }
  } finally {
    try {
      await conn?.end()
    } catch {
      /* ignore */
    }
  }
}
