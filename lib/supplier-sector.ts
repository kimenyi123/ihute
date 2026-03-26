/**
 * Bar / restaurant signup categories (same rule as supplier dashboard & self-ordering).
 * Kiosk “Self Ordering” and “Tables” are only meaningful for these accounts.
 */
export function isRestoBarPreferredCategories(preferredCategories: string | null | undefined): boolean {
  const raw = String(preferredCategories ?? "").trim().toLowerCase()
  return (
    raw === "resto-bar" ||
    raw.includes("restaurant") ||
    raw.includes("resto") ||
    raw.includes("bar")
  )
}
