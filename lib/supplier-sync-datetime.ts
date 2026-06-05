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

export function formatSupplierSyncTimestampOrNull(raw: unknown): string | null {
  if (raw == null || String(raw).trim() === "") return null
  return formatSupplierSyncTimestamp(raw)
}
