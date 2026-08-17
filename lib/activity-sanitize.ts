/** Keys that must never be persisted in activity_events. */
const FORBIDDEN_KEY =
  /password|passwd|pin|momo[_-]?pin|card[_-]?number|cardnumber|pan|cvv|cvc|secret|api[_-]?key|authorization/i

/** Rough Luhn-agnostic card pattern (13–19 digits, optional spaces/dashes). */
const CARD_NUMBER_RE = /\b(?:\d[ -]*?){13,19}\b/g

/** Rwanda-style mobile numbers and generic international digit runs. */
const PHONE_RE = /\b(?:\+?25?0?)?7[2389]\d{7}\b|\b0?7\d{8}\b/g

function maskPhones(text: string): string {
  return text.replace(PHONE_RE, "[phone_redacted]")
}

function maskCards(text: string): string {
  return text.replace(CARD_NUMBER_RE, "[card_redacted]")
}

function scrubString(value: string, maxLen: number): string {
  let s = maskCards(maskPhones(value))
  if (FORBIDDEN_KEY.test(s)) return "[redacted]"
  return s.length > maxLen ? s.slice(0, maxLen) : s
}

function scrubUnknown(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[truncated]"
  if (value == null) return value
  if (typeof value === "string") return scrubString(value, 500)
  if (typeof value === "number" || typeof value === "boolean") return value
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((v) => scrubUnknown(v, depth + 1))
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_KEY.test(k)) continue
      out[k] = scrubUnknown(v, depth + 1)
    }
    return out
  }
  return String(value)
}

export type ActivityEventInput = Record<string, unknown>

/**
 * Strip PII / secrets from a validated activity event before Mongo insert.
 * Returns null when the event should be dropped entirely.
 */
export function sanitizeActivityEvent(raw: ActivityEventInput): Record<string, unknown> | null {
  const source = String(raw.source || "").trim()
  const stage = String(raw.stage || "").trim()
  const status = String(raw.status || "").trim()
  if (!source || !stage || !status) return null

  const serialized = JSON.stringify(raw)
  if (FORBIDDEN_KEY.test(serialized)) {
    // Drop events that embed secrets anywhere in the payload.
    return null
  }

  const createdIso = String(raw.createdAt || new Date().toISOString())
  const doc: Record<string, unknown> = {
    eventId: String(raw.eventId || crypto.randomUUID()),
    createdAtIso: createdIso,
    createdAt: new Date(createdIso),
    environment: String(raw.environment || "prod"),
    source,
    stage,
    status,
  }

  if (raw.message) {
    doc.message = scrubString(String(raw.message), 500)
  }
  if (typeof raw.durationMs === "number" && Number.isFinite(raw.durationMs)) {
    doc.durationMs = raw.durationMs
  }

  if (raw.actor && typeof raw.actor === "object") {
    const a = scrubUnknown(raw.actor) as Record<string, unknown>
    const userId = a.userId ? scrubString(String(a.userId), 200) : undefined
    doc.actor = {
      type: a.type ? String(a.type).slice(0, 20) : undefined,
      sessionId: a.sessionId ? String(a.sessionId).slice(0, 64) : undefined,
      userId: userId && !PHONE_RE.test(String(a.userId || "")) ? userId : userId ? "[email_or_id]" : undefined,
      ishyigaAccount: a.ishyigaAccount ? String(a.ishyigaAccount).slice(0, 64) : undefined,
      role: a.role ? String(a.role).slice(0, 20) : undefined,
      displayName: a.displayName ? scrubString(String(a.displayName), 120) : undefined,
    }
  }

  if (raw.context && typeof raw.context === "object") {
    const c = scrubUnknown(raw.context) as Record<string, unknown>
    doc.context = {
      path: c.path ? scrubString(String(c.path), 500) : undefined,
      referrer: c.referrer ? scrubString(String(c.referrer), 500) : undefined,
      userAgent: c.userAgent ? scrubString(String(c.userAgent), 300) : undefined,
      warContext: c.warContext ? String(c.warContext).slice(0, 64) : undefined,
      ipHash: c.ipHash ? String(c.ipHash).slice(0, 128) : undefined,
    }
  }

  if (raw.entity && typeof raw.entity === "object") {
    const ent = scrubUnknown(raw.entity) as Record<string, unknown>
    doc.entity = {
      type: ent.type ? String(ent.type).slice(0, 30) : undefined,
      id: ent.id ? scrubString(String(ent.id), 200) : undefined,
      name: ent.name ? scrubString(String(ent.name), 300) : undefined,
    }
  }

  if (raw.metadata && typeof raw.metadata === "object" && !Array.isArray(raw.metadata)) {
    const meta = scrubUnknown(raw.metadata) as Record<string, unknown>
    if (Object.keys(meta).length > 0) doc.metadata = meta
  }

  return doc
}
