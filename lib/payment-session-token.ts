import { createHmac, timingSafeEqual } from "crypto"

const SECRET = process.env.PAYMENT_SESSION_SECRET?.trim() || "ihute-dev-mm-session-secret-change-me"

export type MmProvider = "mtn" | "airtel"

export type MmSessionPayload = {
  v: 1
  step: "awaiting_confirmation"
  provider: MmProvider
  /** E.164-style digits e.g. 250788123456 */
  phone: string
  amount: number
  iat: number
  exp: number
}

function signBody(body: string): string {
  return createHmac("sha256", SECRET).update(body).digest("base64url")
}

export function signMmSession(payload: MmSessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")
  const sig = signBody(body)
  return `${body}.${sig}`
}

export function verifyMmSession(token: string): MmSessionPayload | null {
  const dot = token.lastIndexOf(".")
  if (dot <= 0) return null
  const body = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  if (!body || !sig) return null
  const expected = signBody(body)
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  } catch {
    return null
  }
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as MmSessionPayload
    if (parsed.v !== 1 || typeof parsed.exp !== "number") return null
    if (Date.now() / 1000 > parsed.exp) return null
    return parsed
  } catch {
    return null
  }
}
