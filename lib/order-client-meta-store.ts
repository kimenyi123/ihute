import fs from "fs"
import path from "path"

export type OrderClientMeta = {
  buyerDeliveryAddress?: string
  sellerPaymentAck?: "paid" | "pending"
  updatedAt?: string
}

type StoreShape = Record<string, OrderClientMeta>

/** Same id may appear as "3374" vs "03374" — normalize so buyer save and seller list match. */
export function normalizeOrderIdKey(raw: string): string {
  const s = String(raw ?? "").trim()
  if (!s) return ""
  if (/^\d+$/.test(s)) return String(parseInt(s, 10))
  return s
}

export function lookupOrderMetaFromStore(store: StoreShape, rawOrderId: string): OrderClientMeta | undefined {
  const id = String(rawOrderId ?? "").trim()
  if (!id) return undefined
  const keys = [normalizeOrderIdKey(id), id].filter((k, i, a) => k && a.indexOf(k) === i)
  for (const k of keys) {
    const m = store[k]
    if (m) return m
  }
  // Legacy rows keyed e.g. "03374" while seller sends "3374"
  if (/^\d+$/.test(normalizeOrderIdKey(id))) {
    const n = normalizeOrderIdKey(id)
    for (const [k, v] of Object.entries(store)) {
      if (/^\d+$/.test(k) && normalizeOrderIdKey(k) === n && v) return v
    }
  }
  return undefined
}

const DATA_DIR = path.join(process.cwd(), ".data")
const FILE = path.join(DATA_DIR, "order-client-meta.json")

function readAll(): StoreShape {
  try {
    if (!fs.existsSync(FILE)) return {}
    const raw = fs.readFileSync(FILE, "utf8")
    const j = JSON.parse(raw) as StoreShape
    return j && typeof j === "object" ? j : {}
  } catch {
    return {}
  }
}

function writeAll(data: StoreShape) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  const tmp = `${FILE}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(data), "utf8")
  fs.renameSync(tmp, FILE)
}

export function getOrderMeta(orderId: string): OrderClientMeta | undefined {
  const store = readAll()
  return lookupOrderMetaFromStore(store, orderId)
}

/** Single file read — use for batch merges (e.g. seller order list). */
export function readAllOrderClientMeta(): StoreShape {
  return readAll()
}

export function patchOrderClientMeta(
  orderId: string,
  patch: {
    buyerDeliveryAddress?: string | null
    sellerPaymentAck?: "paid" | "pending" | null
  },
): OrderClientMeta {
  const id = String(orderId ?? "").trim()
  if (!id) throw new Error("orderId required")

  const key = normalizeOrderIdKey(id)
  const all = readAll()
  const prev = all[key] ? { ...all[key] } : ({} as OrderClientMeta)

  if ("buyerDeliveryAddress" in patch) {
    const v = patch.buyerDeliveryAddress
    if (v == null || String(v).trim() === "") delete prev.buyerDeliveryAddress
    else prev.buyerDeliveryAddress = String(v).trim().slice(0, 2000)
  }

  if ("sellerPaymentAck" in patch) {
    const v = patch.sellerPaymentAck
    if (v == null) delete prev.sellerPaymentAck
    else if (v === "paid" || v === "pending") prev.sellerPaymentAck = v
  }

  const hasAny = Boolean(prev.buyerDeliveryAddress || prev.sellerPaymentAck)
  if (!hasAny) {
    delete all[key]
    if (key !== id) delete all[id]
    writeAll(all)
    return {}
  }

  prev.updatedAt = new Date().toISOString()
  all[key] = prev
  if (key !== id) delete all[id]
  writeAll(all)
  return prev
}
