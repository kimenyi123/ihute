/**
 * Parse RWF amounts from Excel/CSV/UI text.
 * Handles thousands: 3,400 · 3.400 · 3 400 · 12,500 — not as decimal 3.4.
 */
export function parseRwfAmount(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw

  let s = String(raw ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/\s*RWF\s*/gi, "")
    .replace(/[\s\u00A0\u202F]/g, "")
    .trim()
  if (!s) return 0

  const lastComma = s.lastIndexOf(",")
  const lastDot = s.lastIndexOf(".")

  if (lastComma >= 0 && lastDot >= 0) {
    if (lastComma > lastDot) {
      s = s.replace(/\./g, "").replace(",", ".")
    } else {
      s = s.replace(/,/g, "")
    }
  } else if (lastComma >= 0) {
    const after = s.slice(lastComma + 1)
    if (/^\d{3}$/.test(after)) s = s.replace(/,/g, "")
    else s = s.replace(",", ".")
  } else if (lastDot >= 0) {
    const after = s.slice(lastDot + 1)
    const before = s.slice(0, lastDot)
    if (/^\d{3}$/.test(after) && /^\d{1,3}$/.test(before)) {
      s = s.replace(/\./g, "")
    }
  }

  const n = parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

export function roundRwfPrice(raw: unknown): number {
  const n = parseRwfAmount(raw)
  return n >= 1 ? Math.round(n) : 0
}
