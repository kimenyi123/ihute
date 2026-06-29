/** Rwanda — backend stock sync times are wall-clock strings without timezone. */
const RWANDA_TZ = "Africa/Kigali"
const RWANDA_LOCALE = "en-RW"
const SQL_DATETIME =
  /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d{1,3})?/

/**
 * Parse IHUTE SQL datetime as literal wall clock (no timezone conversion).
 * Backend stores Rwanda local time as `yyyy-MM-dd HH:mm:ss`.
 */
export function parseSupplierSyncTimestampMs(raw: unknown): number | null {
  if (raw == null) return null
  const s = String(raw).trim()
  if (!s) return null

  const m = SQL_DATETIME.exec(s)
  if (m) {
    return new Date(
      Number(m[1]),
      Number(m[2]) - 1,
      Number(m[3]),
      Number(m[4]),
      Number(m[5]),
      Number(m[6] ?? "0"),
    ).getTime()
  }

  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d.getTime()
}

/** Show the timestamp digits from the API without timezone shifting. */
export function formatSupplierSyncTimestamp(raw: unknown): string {
  if (raw == null || String(raw).trim() === "") return "—"
  const s = String(raw).trim()
  const m = SQL_DATETIME.exec(s)
  if (m) {
    const day = String(Number(m[3])).padStart(2, "0")
    const month = String(Number(m[2])).padStart(2, "0")
    const year = m[1]
    const hour = String(Number(m[4])).padStart(2, "0")
    const minute = String(Number(m[5])).padStart(2, "0")
    return `${day}/${month}/${year}, ${hour}:${minute}`
  }
  const ms = parseSupplierSyncTimestampMs(raw)
  if (ms != null) {
    return new Date(ms).toLocaleString(RWANDA_LOCALE, {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: RWANDA_TZ,
    })
  }
  return s
}

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const

/** Java `Timestamp.getTime()` on our MySQL `heure` encodes Rwanda wall clock as UTC — do not add +2 again. */
const ORDER_EPOCH_DISPLAY_TZ = "UTC"

function formatInstantWallClock(
  ms: number,
  timeZone: string,
): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(ms))
}

function formatSqlDatetimeMatch(m: RegExpExecArray): string {
  const day = String(Number(m[3])).padStart(2, "0")
  const month = MONTH_SHORT[Number(m[2]) - 1] ?? m[2]
  const year = m[1]
  const hour = String(Number(m[4])).padStart(2, "0")
  const minute = String(Number(m[5])).padStart(2, "0")
  const second = String(Number(m[6] ?? "0")).padStart(2, "0")
  return `${day} ${month} ${year}, ${hour}:${minute}:${second}`
}

/**
 * Order placed at — Rwanda wall clock with seconds.
 * Prefer SQL string from API (`ORDER_PLACED_AT`); numeric ms uses UTC (not Africa/Kigali).
 */
export function formatOrderPlacedAtRwanda(raw?: unknown): string {
  if (raw != null && String(raw).trim() !== "") {
    const s = String(raw).trim()
    const m = SQL_DATETIME.exec(s)
    if (m) {
      return formatSqlDatetimeMatch(m)
    }
    if (typeof raw === "number" && Number.isFinite(raw)) {
      return formatInstantWallClock(raw, ORDER_EPOCH_DISPLAY_TZ)
    }
    if (/Z$|[+-]\d{2}:\d{2}$/.test(s)) {
      const ms = new Date(s).getTime()
      if (Number.isFinite(ms)) {
        return formatInstantWallClock(ms, RWANDA_TZ)
      }
    }
    const ms = parseSupplierSyncTimestampMs(raw)
    if (ms != null && Number.isFinite(ms)) {
      return formatInstantWallClock(ms, ORDER_EPOCH_DISPLAY_TZ)
    }
  }
  return formatInstantWallClock(Date.now(), RWANDA_TZ)
}

export function formatSupplierSyncTimestampOrNull(raw: unknown): string | null {
  if (raw == null || String(raw).trim() === "") return null
  return formatSupplierSyncTimestamp(raw)
}
