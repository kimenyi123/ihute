import fs from "fs"
import path from "path"

import { normalizeOrderIdKey } from "@/lib/order-client-meta-store"

const FILE = path.join(process.cwd(), ".data", "delivered-stock-ledger.json")

type Ledger = Record<string, { at: string }>

function read(): Ledger {
  try {
    if (!fs.existsSync(FILE)) return {}
    const j = JSON.parse(fs.readFileSync(FILE, "utf8")) as Ledger
    return j && typeof j === "object" ? j : {}
  } catch {
    return {}
  }
}

function write(data: Ledger) {
  const dir = path.dirname(FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const tmp = `${FILE}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(data), "utf8")
  fs.renameSync(tmp, FILE)
}

/** Avoid double-decrement if update-status is retried for the same order. */
export function wasStockAdjustedForDelivered(orderId: string | number): boolean {
  const k = normalizeOrderIdKey(String(orderId))
  if (!k) return false
  const all = read()
  if (all[k]) return true
  if (/^\d+$/.test(k)) {
    for (const [key, v] of Object.entries(all)) {
      if (/^\d+$/.test(key) && normalizeOrderIdKey(key) === k && v) return true
    }
  }
  return false
}

export function markStockAdjustedForDelivered(orderId: string | number): void {
  const k = normalizeOrderIdKey(String(orderId))
  if (!k) return
  const all = read()
  all[k] = { at: new Date().toISOString() }
  write(all)
}
