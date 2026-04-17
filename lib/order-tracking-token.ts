import crypto from "crypto"
import { loadTrackingTokenStore, saveTrackingTokenMapping } from "@/lib/order-tracking-token-store"

/** 32 chars — avoids 0/O and 1/I confusion in URLs. */
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
const TOKEN_LEN = 5
const SPACE = 32n ** BigInt(TOKEN_LEN)

function getSecret(): string {
  return (
    process.env.ORDER_TRACKING_SECRET ||
    process.env.ORDER_TRACKING_HMAC_SECRET ||
    process.env.AUTH_SECRET ||
    "ihute-dev-order-tracking-secret-change-me"
  )
}

export function normalizePublicToken(raw: string): string {
  return String(raw ?? "")
    .trim()
    .toUpperCase()
}

/**
 * True if this could be a public tracking code (not a plain numeric order id).
 * 5-digit numeric order ids stay on the legacy path (all digits → raw id).
 */
export function isPublicTrackingTokenFormat(raw: string): boolean {
  const s = normalizePublicToken(raw)
  if (s.length !== TOKEN_LEN) return false
  if (!/^[0-9A-Z]+$/.test(s)) return false
  if (/^[0-9]{5}$/.test(s)) return false
  return true
}

function encodeIndexToToken(index: bigint): string {
  let x = index % SPACE
  if (x < 0n) x += SPACE
  let out = ""
  for (let i = 0; i < TOKEN_LEN; i++) {
    const d = Number(x % 32n)
    out = ALPHABET[d] + out
    x /= 32n
  }
  return out
}

/**
 * Deterministic candidates; registers first free token for this order id.
 */
export function getOrCreatePublicTokenForOrderId(orderId: string): string {
  const id = String(orderId ?? "").trim()
  if (!id) throw new Error("orderId required")

  const store = loadTrackingTokenStore()
  const existing = store.byOrderId[id]
  if (existing) return existing

  const secret = getSecret()
  let nonce = 0
  while (nonce < 50_000) {
    const h = crypto.createHmac("sha256", secret).update(`ihute:ot:${id}:${nonce}`).digest()
    let n = 0n
    for (let i = 0; i < 10; i++) n = (n << 8n) | BigInt(h[i])
    const token = encodeIndexToToken(n)

    if (/^[0-9]{5}$/.test(token)) {
      nonce++
      continue
    }

    const takenBy = store.byToken[token]
    if (!takenBy || takenBy === id) {
      saveTrackingTokenMapping(id, token)
      return token
    }
    nonce++
  }

  throw new Error("Could not allocate tracking token")
}

export function resolvePublicTokenToOrderId(raw: string): string | null {
  const t = normalizePublicToken(raw)
  if (t.length !== TOKEN_LEN) return null
  const store = loadTrackingTokenStore()
  const id = store.byToken[t]
  return id ? String(id) : null
}
