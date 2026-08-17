/**
 * Parse supplier catalog `item_state` strings, e.g. `"Ba:TY25| Ex:311236"`.
 *
 * - `Ba:` — batch / lot (any non-empty value except `NA`).
 * - `Ex:` — six digits **ddmmyy** (positions DD | MM | YY). **UI shows the encoding as-is**
 *   (`31/11/26`) — we do **not** adjust the day to fit the calendar.
 * - `expiryAt` / `isExpired` are set **only** when DD/MM/YY forms a real calendar date (strict).
 *   Invalid combinations (e.g. 31 November) still show **`31/11/26`** but are not mapped to a Date.
 *
 * Year: **70–99 → 19YY**, else **20YY** (same as Kaos `OrdersServlet` when strict parse succeeds).
 */

export type ParsedItemStateDisplay = {
  batch: string | null
  /** Literal display from `Ex:` six digits: `dd/mm/yy` (e.g. `31/11/26`). */
  expiryLabel: string | null
  /** Set only when ddmmyy is a valid calendar date (no day reduction). */
  expiryAt: Date | null
  isExpired: boolean
  /** Set when `Ex:` is missing or not six digits. */
  expiryRaw: string | null
  /** Six digits after `Ex:` when present. */
  exDdMmYyEncoded: string | null
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function parseItemStateBatchExpiry(itemState: unknown): ParsedItemStateDisplay {
  const empty: ParsedItemStateDisplay = {
    batch: null,
    expiryLabel: null,
    expiryAt: null,
    isExpired: false,
    expiryRaw: null,
    exDdMmYyEncoded: null,
  }
  if (itemState == null) return empty
  const s = String(itemState).trim()
  if (!s) return empty

  let batch: string | null = null
  let expiryAt: Date | null = null
  let expiryRaw: string | null = null
  let exDdMmYyEncoded: string | null = null
  let expiryLabel: string | null = null

  for (const part of s.split("|")) {
    const t = part.trim()
    const low = t.toLowerCase()
    if (low.startsWith("ba:")) {
      const v = t.slice(3).trim()
      if (v && !/^na$/i.test(v)) batch = v
    } else if (low.startsWith("ex:")) {
      const raw = t.slice(3).trim()
      // Not applicable / missing expiry — do not show "Ex:NA" in customer UI
      if (/^na$/i.test(raw)) {
        continue
      }
      if (raw.length === 6 && /^\d{6}$/.test(raw)) {
        exDdMmYyEncoded = raw
        expiryLabel = `${raw.slice(0, 2)}/${raw.slice(2, 4)}/${raw.slice(4, 6)}`
        const dayEnc = parseInt(raw.slice(0, 2), 10)
        const month = parseInt(raw.slice(2, 4), 10)
        const yy = parseInt(raw.slice(4, 6), 10)
        if (month >= 1 && month <= 12 && dayEnc >= 1) {
          const year = yy >= 70 ? 1900 + yy : 2000 + yy
          const d = new Date(year, month - 1, dayEnc)
          if (
            !Number.isNaN(d.getTime()) &&
            d.getFullYear() === year &&
            d.getMonth() === month - 1 &&
            d.getDate() === dayEnc
          ) {
            expiryAt = d
          }
        }
      } else if (raw.length > 0) {
        expiryRaw = raw
        expiryLabel = `Ex:${raw}`
      }
    }
  }

  const today = startOfLocalDay(new Date())
  let isExpired = false
  if (expiryAt) {
    const exDay = startOfLocalDay(expiryAt)
    isExpired = today.getTime() > exDay.getTime()
  }

  return {
    batch,
    expiryLabel,
    expiryAt,
    isExpired,
    expiryRaw,
    exDdMmYyEncoded,
  }
}

/** Hide expiry line when catalog encodes missing expiry as NA / Ex:NA / N/A. */
export function isExpiryMeaningfulForCustomerDisplay(label: string | null | undefined): boolean {
  if (label == null) return false
  const t = String(label).trim()
  if (!t) return false
  const compact = t.replace(/\s+/g, " ")
  if (/^ex:\s*na$/i.test(compact)) return false
  if (/^(na|n\/a)$/i.test(compact)) return false
  return true
}
