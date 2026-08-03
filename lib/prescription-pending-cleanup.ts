/**
 * Delete abandoned pending prescription uploads older than PRESCRIPTION_PENDING_MAX_AGE_MS.
 * Used on next upload (opportunistic) and by /api/internal/cleanup-prescription-pending (CRON_SECRET).
 */
import { existsSync, readdirSync, rmSync, statSync } from "fs"
import path from "path"
import {
  getPrescriptionUploadsRoot,
  PRESCRIPTION_PENDING_MAX_AGE_MS,
} from "@/lib/prescription-upload-paths"

export type PendingCleanupResult = {
  scanned: number
  deleted: number
  errors: number
  maxAgeMs: number
}

export function cleanupStalePendingPrescriptions(
  maxAgeMs: number = PRESCRIPTION_PENDING_MAX_AGE_MS,
): PendingCleanupResult {
  const pendingRoot = path.join(getPrescriptionUploadsRoot(), "pending")
  const result: PendingCleanupResult = {
    scanned: 0,
    deleted: 0,
    errors: 0,
    maxAgeMs,
  }
  if (!existsSync(pendingRoot)) return result

  const now = Date.now()
  let entries: string[] = []
  try {
    entries = readdirSync(pendingRoot)
  } catch {
    return result
  }

  for (const name of entries) {
    const full = path.join(pendingRoot, name)
    result.scanned++
    try {
      const st = statSync(full)
      const mtime = st.mtimeMs || st.ctimeMs || 0
      if (now - mtime < maxAgeMs) continue
      rmSync(full, { recursive: true, force: true })
      result.deleted++
    } catch {
      result.errors++
    }
  }
  return result
}
