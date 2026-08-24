import type { Order } from "@/lib/orders-store"
import { orderIdKey } from "@/lib/order-id"

export { orderIdKey }

const PENDING_KEY = "grandma:pendingOrderV1"
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000
/** Keep “just placed” order pinned with today’s time (server list often lags or wrong date). */
export const GRANDMA_JUST_PLACED_WINDOW_MS = 6 * 60 * 60 * 1000

type PendingPayload = {
  savedAt: string
  order: Order
}

function loadGrandmaPendingPayload(): PendingPayload | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(PENDING_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PendingPayload
    if (!parsed?.order?.id || !parsed.savedAt) return null
    const age = Date.now() - Date.parse(parsed.savedAt)
    if (!Number.isFinite(age) || age > MAX_AGE_MS) return null
    return parsed
  } catch {
    return null
  }
}

export function getGrandmaPendingSavedAtMs(): number | null {
  const p = loadGrandmaPendingPayload()
  if (!p) return null
  const ms = Date.parse(p.savedAt)
  return Number.isFinite(ms) ? ms : null
}

/** True when this id was placed in the last few hours (still “your new order”). */
export function isGrandmaJustPlaced(id?: string): boolean {
  const p = loadGrandmaPendingPayload()
  if (!p) return false
  const age = Date.now() - Date.parse(p.savedAt)
  if (age < 0 || age > GRANDMA_JUST_PLACED_WINDOW_MS) return false
  if (id && orderIdKey(p.order.id) !== orderIdKey(id)) return false
  return true
}

export function getGrandmaJustPlacedOrderId(): string | null {
  const p = loadGrandmaPendingPayload()
  if (!p) return null
  if (!isGrandmaJustPlaced(p.order.id)) return null
  return p.order.id
}

export function saveGrandmaPendingOrder(order: Order) {
  if (typeof window === "undefined") return
  try {
    const payload: PendingPayload = {
      savedAt: new Date().toISOString(),
      order,
    }
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(payload))
    localStorage.setItem("grandma:lastOrderId", String(order.id))
  } catch {
    /* ignore quota / private mode */
  }
}

export function loadGrandmaPendingOrder(): Order | null {
  return loadGrandmaPendingPayload()?.order ?? null
}

/** Force the order you just placed to the top with the real placement time. */
export function elevateJustPlacedGrandmaOrder(list: Order[]): Order[] {
  const justId = getGrandmaJustPlacedOrderId()
  if (!justId) return list

  const key = orderIdKey(justId)
  const pending = loadGrandmaPendingOrder()
  const found = list.find((o) => orderIdKey(o.id) === key)
  let row: Order | null = null

  if (found && pending) {
    row = { ...found, ...pending, createdAt: pending.createdAt }
  } else if (found) {
    row = found
  } else if (pending && orderIdKey(pending.id) === key) {
    row = pending
  }

  if (!row) return list
  const rest = list.filter((o) => orderIdKey(o.id) !== key)
  return [row, ...rest]
}

/** Drop cached pending only after the “just placed” window (server dates are often wrong). */
export function clearGrandmaPendingOrderIfMatched(orderId: string, serverCreatedAt?: string) {
  const payload = loadGrandmaPendingPayload()
  if (!payload || orderIdKey(payload.order.id) !== orderIdKey(orderId)) return

  const savedMs = Date.parse(payload.savedAt)
  const age = Date.now() - savedMs
  if (Number.isFinite(age) && age < GRANDMA_JUST_PLACED_WINDOW_MS) {
    if (serverCreatedAt) {
      const serverMs = Date.parse(serverCreatedAt)
      if (Number.isFinite(serverMs) && serverMs < savedMs - 2 * 3_600_000) {
        return
      }
    }
    return
  }

  try {
    sessionStorage.removeItem(PENDING_KEY)
  } catch {
    /* ignore */
  }
}
