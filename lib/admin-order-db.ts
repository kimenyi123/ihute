/** Same allow-list as kaos AdminServlet / admin-sellers.html */
export const ORDER_MONITOR_DBS = [
  { id: "chaos_beta", label: "Beta", hint: "chaos_beta" },
  { id: "chaos_test", label: "Production", hint: "chaos_test" },
  { id: "chaos_dev", label: "Dev", hint: "chaos_dev" },
] as const

export type OrderMonitorDb = (typeof ORDER_MONITOR_DBS)[number]["id"]

const STORAGE_KEY = "ihute_admin_order_monitor_db"

export function isOrderMonitorDb(value: string | null | undefined): value is OrderMonitorDb {
  return ORDER_MONITOR_DBS.some((d) => d.id === value)
}

/** Prefer ?db=, then localStorage, then chaos_beta (same default as admin-sellers.html). */
export function readOrderMonitorDb(): OrderMonitorDb {
  if (typeof window === "undefined") return "chaos_beta"
  const fromUrl = new URLSearchParams(window.location.search).get("db")
  if (isOrderMonitorDb(fromUrl)) return fromUrl
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (isOrderMonitorDb(stored)) return stored
  return "chaos_beta"
}

export function writeOrderMonitorDb(db: OrderMonitorDb) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(STORAGE_KEY, db)
}

export function orderMonitorDbLabel(db: string): string {
  const found = ORDER_MONITOR_DBS.find((d) => d.id === db)
  return found ? `${found.label} (${found.hint})` : db
}
