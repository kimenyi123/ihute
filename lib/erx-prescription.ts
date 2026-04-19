/**
 * Electronic prescription (eRx) line item — matches Ishyiga E-PRESCRIPTION measurement flow.
 * Serialized to cart `notes` (JSON) for DB / order APIs that expect a single text column.
 */
export type ErxPrescription = {
  measurement: string
  every: string
  toBeTakenDays: string
  quantityOnce: string
  instructionNotes: string
  route: string
  refill: "YES" | "NO"
}

export const ERX_MEASUREMENT_OPTIONS = [
  "TABLET",
  "CAPSULE",
  "ML",
  "DROPS",
  "CREAM",
  "SYRUP",
  "INJECTION",
  "OTHER",
] as const

export const ERX_EVERY_OPTIONS = [
  "AS NEEDED",
  "1 HOUR = 24 TIMES A DAY",
  "1 HOUR — 24 TIMES A DAY",
  "2 HOURS — 12 TIMES A DAY",
  "4 HOURS — 6 TIMES A DAY",
  "6 HOURS — 4 TIMES A DAY",
  "8 HOURS — 3 TIMES A DAY",
  "12 HOURS — 2 TIMES A DAY",
  "24 HOURS — ONCE A DAY",
  "WEEKLY",
] as const

export const ERX_ROUTE_OPTIONS = ["Oral", "Topical", "Sublingual", "Rectal", "Inhalation", "Otic", "Ophthalmic", "Other"] as const

export function serializeErxForNotes(erx: ErxPrescription): string {
  return JSON.stringify({ type: "ihute_erx_v1", ...erx })
}

export function parseErxFromNotes(notes: string | undefined): ErxPrescription | null {
  if (!notes || !notes.trim()) return null
  try {
    const o = JSON.parse(notes) as Record<string, unknown>
    if (o?.type !== "ihute_erx_v1") return null
    return {
      measurement: String(o.measurement ?? ""),
      every: String(o.every ?? ""),
      toBeTakenDays: String(o.toBeTakenDays ?? ""),
      quantityOnce: String(o.quantityOnce ?? ""),
      instructionNotes: String(o.instructionNotes ?? ""),
      route: String(o.route ?? ""),
      refill: o.refill === "YES" ? "YES" : "NO",
    }
  } catch {
    return null
  }
}

/** Stable key for merging cart lines with the same product + same prescription. */
export function prescriptionLineKey(item: { erx?: ErxPrescription | null; notes?: string | null }): string {
  if (item.erx) return JSON.stringify(item.erx)
  const parsed = parseErxFromNotes(item.notes ?? undefined)
  if (parsed) return JSON.stringify(parsed)
  return (item.notes ?? "").toString().trim()
}
