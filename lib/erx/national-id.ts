/** Rwanda Indangamuntu (national ID) — digits-only comparison, no length assertion (MOH's value is authoritative). */
export function normalizeNationalId(raw: string): string {
  return (raw || "").replace(/\D/g, "")
}
