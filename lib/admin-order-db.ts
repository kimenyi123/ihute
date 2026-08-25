/** Same allow-list as kaos AdminServlet / admin-sellers.html, plus client-order schema. */

export const ORDER_MONITOR_DBS = [
  { id: "chaos_beta", label: "Beta", hint: "chaos_beta", token: "b" },
  { id: "chaos_test", label: "Production", hint: "chaos_test", token: "p" },
  { id: "chaos_dev", label: "Dev", hint: "chaos_dev", token: "d" },
  { id: "chaos_theta", label: "Theta", hint: "chaos_theta", token: "t" },
] as const

export type OrderMonitorDb = (typeof ORDER_MONITOR_DBS)[number]["id"]

/** Client checkout orders live in this schema's order_transaction tables. */
export const CLIENT_ORDER_MONITOR_DB: OrderMonitorDb = "chaos_theta"

const STORAGE_KEY = "ihute_admin_order_monitor_db"

/** Opaque URL/API codes — never put real schema names in browser links. */
const TOKEN_BY_DB: Record<OrderMonitorDb, string> = {
  chaos_beta: "b",
  chaos_test: "p",
  chaos_dev: "d",
  chaos_theta: "t",
}

const DB_BY_TOKEN: Record<string, OrderMonitorDb> = {
  b: "chaos_beta",
  p: "chaos_test",
  d: "chaos_dev",
  t: "chaos_theta",
  // longer aliases (still not schema names)
  beta: "chaos_beta",
  prod: "chaos_test",
  production: "chaos_test",
  dev: "chaos_dev",
  theta: "chaos_theta",
  client: "chaos_theta",
}

export function isOrderMonitorDb(value: string | null | undefined): value is OrderMonitorDb {
  return ORDER_MONITOR_DBS.some((d) => d.id === value)
}

/** Encode schema for URL / query strings (opaque). */
export function encodeOrderMonitorDb(db: OrderMonitorDb): string {
  return TOKEN_BY_DB[db]
}

/**
 * Decode ?db= value from URL or API.
 * Accepts opaque tokens (b|p|d) and legacy plaintext schema names for old bookmarks.
 */
export function decodeOrderMonitorDb(value: string | null | undefined): OrderMonitorDb | null {
  if (!value) return null
  const raw = value.trim().toLowerCase()
  if (!raw) return null
  if (isOrderMonitorDb(raw)) return raw
  return DB_BY_TOKEN[raw] ?? null
}

/** Prefer ?db= (opaque or legacy), then localStorage, then client-order schema. */
export function readOrderMonitorDb(): OrderMonitorDb {
  if (typeof window === "undefined") return CLIENT_ORDER_MONITOR_DB
  const fromUrl = decodeOrderMonitorDb(new URLSearchParams(window.location.search).get("db"))
  if (fromUrl) return fromUrl
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (isOrderMonitorDb(stored)) return stored
  const storedDecoded = decodeOrderMonitorDb(stored)
  if (storedDecoded) return storedDecoded
  return CLIENT_ORDER_MONITOR_DB
}

export function writeOrderMonitorDb(db: OrderMonitorDb) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(STORAGE_KEY, db)
}

/** Human label for UI (no schema name required). */
export function orderMonitorDbLabel(db: string): string {
  const found = ORDER_MONITOR_DBS.find((d) => d.id === db)
  return found ? found.label : db
}

/** Admin-only detail when helpful (tooltips). Prefer not putting this in shareable URLs. */
export function orderMonitorDbHint(db: string): string {
  const found = ORDER_MONITOR_DBS.find((d) => d.id === db)
  return found ? found.hint : db
}
