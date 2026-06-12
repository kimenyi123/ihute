/**
 * Heuristic parsing of pasted MTN MoMo (or similar) SMS bodies to find RWF amounts
 * and compare with the Quick Shop / Umuriro order total.
 *
 * Browsers cannot read SMS inboxes; the buyer pastes the confirmation message here.
 *
 * Enhanced: also validates transaction date/time freshness and merchant code match.
 */

function parseMoneyToken(raw: string): number | null {
  const t = raw.replace(/\s/g, "").replace(/,/g, "")
  const n = Math.round(Number.parseFloat(t))
  if (!Number.isFinite(n) || n < 1 || n > 99_999_999) return null
  return n
}

/** Collect plausible RWF amounts from free-form SMS (MTN-style "800 RWF", "RWF 800", \u2026). */
export function extractRwfAmountCandidatesFromText(text: string): number[] {
  const s = String(text ?? "").replace(/\u00a0/g, " ")
  const found = new Set<number>()
  const patterns: RegExp[] = [
    /\b([\d][\d\s,.]*)\s*(?:RWF|FRW|Frw|frw)\b/gi,
    /\b(?:RWF|FRW|Frw|frw)\s*:?\s*([\d][\d\s,.]*)\b/gi,
  ]
  for (const re of patterns) {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(s)) !== null) {
      const tok = (m[1] || "").trim()
      if (!tok) continue
      const n = parseMoneyToken(tok)
      if (n != null) found.add(n)
    }
  }
  return [...found].sort((a, b) => a - b)
}

export type MoMoSmsMatchResult = {
  matched: boolean
  /** Amount that matched the order (within tolerance), if any */
  amount: number | null
  /** MTN TxId / transaction id when present in pasted SMS */
  txId: string | null
  /** All amounts seen in the SMS (debug / UX) */
  candidates: number[]
  /** Whether the transaction date/time is recent enough */
  dateValid: boolean | null
  /** Parsed date from the SMS (if found) */
  parsedDate: string | null
  /** Whether the merchant code in SMS matches the expected shop code */
  merchantCodeValid: boolean | null
  /** Reason for rejection */
  rejectReason: "none" | "amount_mismatch" | "no_amount" | "expired_sms" | "wrong_merchant" | "no_txid"
}

/** MTN MoMo confirmation SMS \u2014 e.g. `TxId:28066831087*S*Your payment of\u2026` */
export function extractMoMoTxIdFromSms(text: string): string | null {
  const s = String(text ?? "")
  const patterns = [
    /\bTxId:\s*(\d+)/i,
    /\bTxn\s*Id[:\s]*(\d+)/i,
    /\bTransaction\s*(?:ID|Id|id)[:\s]*(\d+)/i,
    /\bRef(?:erence)?[:\s]*(\d{8,})/i,
  ]
  for (const re of patterns) {
    const m = s.match(re)
    const id = m?.[1]?.trim()
    if (id && /^\d{6,}$/.test(id)) return id
  }
  return null
}

/**
 * Extract date/time from MTN MoMo SMS.
 * MTN format examples:
 *   "...on 2026-05-25 13:27:00..."
 *   "...at 25/05/2026 13:27..."
 *   "...25-May-2026 13:27..."
 *   "...2026/05/25 1:27 PM..."
 */
export function extractDateFromMoMoSms(text: string): Date | null {
  const s = String(text ?? "")
  const patterns = [
    // ISO-like: 2026-05-25 13:27:00 or 2026-05-25T13:27
    /(\d{4}-\d{2}-\d{2})[T\s]+(\d{1,2}:\d{2}(?::\d{2})?)/i,
    // dd/mm/yyyy HH:mm
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)/i,
    // dd-Mon-yyyy HH:mm
    /(\d{1,2})[\/\-](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\/\-](\d{4})\s+(\d{1,2}:\d{2})/i,
  ]

  // ISO-like
  const isoMatch = s.match(patterns[0])
  if (isoMatch) {
    const d = new Date(`${isoMatch[1]}T${isoMatch[2]}`)
    if (!Number.isNaN(d.getTime())) return d
  }

  // dd/mm/yyyy or dd-mm-yyyy
  const dmyMatch = s.match(patterns[1])
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1])
    const month = parseInt(dmyMatch[2]) - 1
    const year = parseInt(dmyMatch[3])
    const timeStr = dmyMatch[4]
    const d = new Date(year, month, day)
    const timeParts = timeStr.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i)
    if (timeParts) {
      let hours = parseInt(timeParts[1])
      const mins = parseInt(timeParts[2])
      if (timeParts[4]?.toUpperCase() === "PM" && hours < 12) hours += 12
      if (timeParts[4]?.toUpperCase() === "AM" && hours === 12) hours = 0
      d.setHours(hours, mins, parseInt(timeParts[3] || "0"))
    }
    if (!Number.isNaN(d.getTime())) return d
  }

  // dd-Mon-yyyy
  const monMatch = s.match(patterns[2])
  if (monMatch) {
    const dateStr = `${monMatch[1]} ${monMatch[2]} ${monMatch[3]} ${monMatch[4]}`
    const d = new Date(dateStr)
    if (!Number.isNaN(d.getTime())) return d
  }

  return null
}

/**
 * Check if a merchant/pay code appears in the SMS text.
 * MTN MoMo SMS typically includes the merchant code or name.
 */
export function extractMerchantCodeFromSms(text: string, expectedCode: string): boolean {
  if (!expectedCode || expectedCode.length < 3) return true
  const s = String(text ?? "")
  const code = expectedCode.replace(/\D/g, "")
  if (!code) return true
  return s.includes(code)
}

/**
 * Max age of a transaction SMS to be considered valid (in minutes).
 * Default: 15 minutes. Prevents reuse of old SMS messages.
 */
const DEFAULT_MAX_AGE_MINUTES = 15

/**
 * Enhanced MoMo SMS matching:
 * 1. Amount must match order total (within tolerance)
 * 2. TxId must be present (proves it's a real confirmation)
 * 3. Transaction date must be recent (within maxAgeMinutes)
 * 4. Merchant code must match (if provided)
 *
 * @param toleranceRwf \u2014 allow \u00b11\u20132 RWF for rounding/fees (default 2)
 * @param merchantCode \u2014 the shop's MoMo merchant code (digits from USSD)
 * @param maxAgeMinutes \u2014 max allowed age of SMS (default 15 min)
 */
export function matchMoMoSmsToOrderTotal(
  sms: string,
  orderTotalRwf: number,
  toleranceRwf = 2,
  merchantCode?: string,
  maxAgeMinutes = DEFAULT_MAX_AGE_MINUTES,
): MoMoSmsMatchResult {
  const candidates = extractRwfAmountCandidatesFromText(sms)
  const txId = extractMoMoTxIdFromSms(sms)
  const parsedDateObj = extractDateFromMoMoSms(sms)
  const parsedDate = parsedDateObj ? parsedDateObj.toISOString() : null

  const base: Pick<MoMoSmsMatchResult, "candidates" | "txId" | "parsedDate"> = {
    candidates,
    txId,
    parsedDate,
  }

  if (!Number.isFinite(orderTotalRwf) || orderTotalRwf < 1) {
    return { ...base, matched: false, amount: null, dateValid: null, merchantCodeValid: null, rejectReason: "no_amount" }
  }

  // 1. Check amount match
  const hit = candidates.find((n) => Math.abs(n - orderTotalRwf) <= toleranceRwf)
  if (hit == null) {
    if (!candidates.length) {
      return { ...base, matched: false, amount: null, dateValid: null, merchantCodeValid: null, rejectReason: "no_amount" }
    }
    return {
      ...base,
      matched: false,
      amount: candidates[candidates.length - 1],
      dateValid: null,
      merchantCodeValid: null,
      rejectReason: "amount_mismatch",
    }
  }

  // 2. TxId must be present for a genuine confirmation
  if (!txId) {
    return {
      ...base,
      matched: false,
      amount: hit,
      dateValid: null,
      merchantCodeValid: null,
      rejectReason: "no_txid",
    }
  }

  // 3. Check transaction freshness (date/time)
  let dateValid: boolean | null = null
  if (!parsedDateObj) {
    return {
      ...base,
      matched: false,
      amount: hit,
      dateValid: false,
      merchantCodeValid: null,
      rejectReason: "expired_sms",
    }
  }

  const now = new Date()
  const ageMs = now.getTime() - parsedDateObj.getTime()
  const maxAgeMs = maxAgeMinutes * 60 * 1000
  dateValid = ageMs >= -60_000 && ageMs <= maxAgeMs
  if (!dateValid) {
    return {
      ...base,
      matched: false,
      amount: hit,
      dateValid: false,
      merchantCodeValid: null,
      rejectReason: "expired_sms",
    }
  }

  // 4. Check merchant code match
  let merchantCodeValid: boolean | null = null
  if (merchantCode && merchantCode.length >= 3) {
    merchantCodeValid = extractMerchantCodeFromSms(sms, merchantCode)
    if (!merchantCodeValid) {
      return {
        ...base,
        matched: false,
        amount: hit,
        dateValid,
        merchantCodeValid: false,
        rejectReason: "wrong_merchant",
      }
    }
  }

  return {
    ...base,
    matched: true,
    amount: hit,
    dateValid,
    merchantCodeValid,
    rejectReason: "none",
  }
}
