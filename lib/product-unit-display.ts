/**
 * Whether to show " / {unit}" next to price. Hides empty values and bare numbers
 * from item_packet (e.g. "24.0") that are not human-readable pack labels.
 */
export function unitMeaningfulForDisplay(unit: string | undefined | null): boolean {
  if (unit == null) return false
  const t = String(unit).trim()
  if (!t) return false
  if (/^-?\d+(\.\d+)?$/.test(t)) return false
  return true
}
