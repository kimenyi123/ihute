import fs from "fs"
import path from "path"

/** Bidirectional map: public token ↔ internal order id (string). */
type StoreShape = {
  byOrderId: Record<string, string>
  byToken: Record<string, string>
}

const DATA_DIR = path.join(process.cwd(), ".data")
const FILE = path.join(DATA_DIR, "order-tracking-tokens.json")

function readStore(): StoreShape {
  try {
    if (!fs.existsSync(FILE)) return { byOrderId: {}, byToken: {} }
    const raw = fs.readFileSync(FILE, "utf8")
    const j = JSON.parse(raw) as StoreShape
    return {
      byOrderId: j?.byOrderId && typeof j.byOrderId === "object" ? j.byOrderId : {},
      byToken: j?.byToken && typeof j.byToken === "object" ? j.byToken : {},
    }
  } catch {
    return { byOrderId: {}, byToken: {} }
  }
}

function writeStore(s: StoreShape) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  const tmp = `${FILE}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(s), "utf8")
  fs.renameSync(tmp, FILE)
}

export function loadTrackingTokenStore(): StoreShape {
  return readStore()
}

export function saveTrackingTokenMapping(orderId: string, token: string) {
  const id = String(orderId ?? "").trim()
  const t = String(token ?? "").trim().toUpperCase()
  if (!id || !t) return
  const s = readStore()
  const prevTok = s.byOrderId[id]
  if (prevTok && prevTok !== t) delete s.byToken[prevTok]
  s.byOrderId[id] = t
  s.byToken[t] = id
  writeStore(s)
}
