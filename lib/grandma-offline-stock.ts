/**
 * Offline cache + pending sync for Grandma seller stock (Items panel).
 * Uses localStorage; flush when navigator.onLine becomes true.
 */

export type OfflineStockLine = {
  id: number
  itemName: string
  nikiCode: string
  quantity: number
  salePrice: number
  costPrice: number
}

type PendingPatch = { type: "patch"; nikiCode: string; quantity: number; at: number }
type PendingAdd = {
  type: "add"
  itemName: string
  sectorSlug: string
  costPrice: number
  salePrice: number
  quantity: number
  at: number
}
export type PendingStockOp = PendingPatch | PendingAdd

const CACHE_PREFIX = "grandma_stock_cache_v1_"
const PENDING_PREFIX = "grandma_stock_pending_v1_"

function cacheKey(sellerAccount: string) {
  return `${CACHE_PREFIX}${encodeURIComponent(sellerAccount.trim())}`
}

function pendingKey(sellerAccount: string) {
  return `${PENDING_PREFIX}${encodeURIComponent(sellerAccount.trim())}`
}

export function loadCachedLines(sellerAccount: string): OfflineStockLine[] | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(cacheKey(sellerAccount))
    if (!raw) return null
    const parsed = JSON.parse(raw) as { lines?: OfflineStockLine[] }
    if (!Array.isArray(parsed.lines)) return null
    return parsed.lines
  } catch {
    return null
  }
}

export function saveCachedLines(sellerAccount: string, lines: OfflineStockLine[]) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(cacheKey(sellerAccount), JSON.stringify({ lines, savedAt: Date.now() }))
  } catch {
    /* ignore quota */
  }
}

export function loadPendingOps(sellerAccount: string): PendingStockOp[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(pendingKey(sellerAccount))
    if (!raw) return []
    const parsed = JSON.parse(raw) as { ops?: PendingStockOp[] }
    return Array.isArray(parsed.ops) ? parsed.ops : []
  } catch {
    return []
  }
}

function savePendingOps(sellerAccount: string, ops: PendingStockOp[]) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(pendingKey(sellerAccount), JSON.stringify({ ops }))
  } catch {
    /* ignore */
  }
}

export function enqueuePatch(sellerAccount: string, nikiCode: string, quantity: number) {
  const ops = loadPendingOps(sellerAccount)
  ops.push({ type: "patch", nikiCode, quantity, at: Date.now() })
  savePendingOps(sellerAccount, ops)
}

export function enqueueAdd(sellerAccount: string, payload: Omit<PendingAdd, "type" | "at">) {
  const ops = loadPendingOps(sellerAccount)
  ops.push({ type: "add", ...payload, at: Date.now() })
  savePendingOps(sellerAccount, ops)
}

export function clearPending(sellerAccount: string) {
  savePendingOps(sellerAccount, [])
}

export function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false
}

export type FlushResult = { ok: number; fail: number; lastError?: string }

/** POST pending ops to Next API routes (same as online paths). */
export async function flushPendingOps(
  sellerAccount: string,
  onProgress?: (msg: string) => void,
): Promise<FlushResult> {
  const acc = sellerAccount.trim()
  if (!acc) return { ok: 0, fail: 0 }

  const ops = loadPendingOps(acc)
  if (ops.length === 0) return { ok: 0, fail: 0 }

  let ok = 0
  let fail = 0
  let lastError: string | undefined
  const remaining: PendingStockOp[] = []

  for (const op of ops) {
    try {
      if (op.type === "patch") {
        onProgress?.(`Syncing qty ${op.nikiCode}…`)
        const res = await fetch("/api/grandma/sellers/inventory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sellerAccount: acc, nikiCode: op.nikiCode, quantity: op.quantity }),
        })
        const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
        if (!res.ok || !json?.ok) {
          throw new Error(json.error || `HTTP ${res.status}`)
        }
      } else {
        onProgress?.(`Syncing new item ${op.itemName.slice(0, 24)}…`)
        const res = await fetch("/api/grandma/sellers/items/temp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sellerAccount: acc,
            itemName: op.itemName,
            sectorSlug: op.sectorSlug,
            costPrice: op.costPrice,
            salePrice: op.salePrice,
            quantity: op.quantity,
          }),
        })
        const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
        if (!res.ok || !json?.ok) {
          throw new Error(json.error || `HTTP ${res.status}`)
        }
      }
      ok += 1
    } catch (e: unknown) {
      fail += 1
      lastError = e instanceof Error ? e.message : String(e)
      remaining.push(op)
    }
  }

  savePendingOps(acc, remaining)
  return { ok, fail, lastError }
}
