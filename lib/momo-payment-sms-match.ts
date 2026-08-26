/**
 * Heuristic parsing of pasted MTN MoMo (or similar) SMS bodies to find RWF amounts
 * and compare with the Quick Shop / Umuriro / Grandma order total.
 *
 * Browsers cannot read SMS inboxes; the buyer must paste the **full** confirmation SMS —
 * a bare TxId alone is rejected.
 */

function parseMoneyToken(raw: string): number | null {
  const t = raw.replace(/\s/g, "").replace(/,/g, "")
  const n = Math.round(Number.parseFloat(t))
  if (!Number.isFinite(n) || n < 1 || n > 99_999_999) return null
  return n
}

/** Collect plausible RWF amounts from free-form SMS (MTN-style "800 RWF", "RWF 800", …). */
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

export type MoMoSmsRejectReason =
  | "none"
  | "amount_mismatch"
  | "no_amount"
  | "expired_sms"
  | "wrong_merchant"
  | "no_txid"
  | "bare_txid"
  | "incomplete_sms"

export type MoMoSmsMatchResult = {
  matched: boolean
  /** Amount that matched the order (within tolerance), if any */
  amount: number | null
  /** MTN TxId / transaction id when present in pasted SMS */
  txId: string | null
  /** Free-form reference / note / motif when present in the SMS */
  referenceNote: string | null
  /** ISO timestamp from SMS when parsed */
  paidAtIso: string | null
  /** All amounts seen in the SMS (debug / UX) */
  candidates: number[]
  /** Whether the transaction date/time is recent enough */
  dateValid: boolean | null
  /** Parsed date from the SMS (if found) */
  parsedDate: string | null
  /** Whether the merchant code in SMS matches the expected shop code */
  merchantCodeValid: boolean | null
  /** Payment recipient name when available from the SMS */
  receiverName?: string | null
  /** Payment recipient phone number when available from the SMS */
  receiverPhone?: string | null
  /** Payment recipient merchant code when available from the SMS */
  receiverCode?: string | null
  /** Reason for rejection */
  rejectReason: MoMoSmsRejectReason
}

/** True when the paste is only a transaction id (no SMS body). */
export function looksLikeBareTxId(text: string): boolean {
  const s = String(text ?? "").trim()
  if (!s) return false
  // Digits only, or TxId:digits with nothing else meaningful
  if (/^\d{6,20}$/.test(s)) return true
  if (/^TxId\s*:\s*\d{6,20}$/i.test(s)) return true
  if (/^(?:Txn|Transaction)\s*(?:ID|Id)?\s*[:#]?\s*\d{6,20}$/i.test(s)) return true
  return false
}

/**
 * Full MoMo confirmation SMS usually has currency, a narrative verb, and a timestamp.
 * Reject short pastes that are not a confirmation body.
 */
export function looksLikeFullPaymentSms(text: string): boolean {
  const s = String(text ?? "").replace(/\u00a0/g, " ").trim()
  if (!s || looksLikeBareTxId(s)) return false
  if (s.length < 40) return false
  const hasMoney = /(?:RWF|FRW|Frw|frw)/i.test(s)
  const hasNarrative =
    /(?:payment of|transf(?:er+ed|ared)\s+to|was completed|successful|you have sent|umeha|kwishyura)/i.test(s)
  const hasStamp =
    /\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(s) ||
    /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}/.test(s) ||
    /\d{1,2}:\d{2}/.test(s)
  // Strong signal: money + (story or time)
  if (hasMoney && (hasNarrative || hasStamp)) return true
  // Longer MTN blobs often start with *165*S* or *EN#
  if (/^\*?16[0-9]\*?S?\*/i.test(s) && hasMoney) return true
  if (/^\*?EN#/i.test(s) && hasMoney) return true
  return false
}

/** MTN MoMo confirmation SMS — e.g. `TxId:28066831087*S*Your payment of…` */
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

/** Optional buyer note / motif / message field when carriers include one. */
export function extractMoMoReferenceNoteFromSms(text: string): string | null {
  const s = String(text ?? "").replace(/\u00a0/g, " ")
  const patterns = [
    /\b(?:note|message|motif|reason|memo)\s*[:\-]\s*([^\n.*]{2,80})/i,
    /\b(?:for|ref(?:erence)?)\s*[:\-]\s*([A-Za-z][^\n.*]{1,80})/i,
  ]
  for (const re of patterns) {
    const m = s.match(re)
    const note = m?.[1]?.trim().replace(/\s+/g, " ")
    if (!note) continue
    // Avoid capturing "for 1500 RWF" style money clauses
    if (/^\d[\d\s,.]*\s*(?:RWF|FRW)?$/i.test(note)) continue
    if (/^(?:RWF|FRW)\b/i.test(note)) continue
    return note.slice(0, 120)
  }
  return null
}

const MTN_TRANSFER_VERB = "transf(?:er+ed|ared)"

function classifyMtnParenReceiver(raw: string): { phone: string | null; code: string | null } {
  const digits = raw.replace(/\D/g, "")
  if (digits.length >= 9) return { phone: digits, code: null }
  if (digits.length >= 3) return { phone: null, code: digits }
  return { phone: null, code: null }
}

export type MtnTransferConfirmation = {
  amount: number
  receiverName: string
  receiverPhone: string | null
  receiverCode: string | null
  paidAt: Date
}

/**
 * MTN person-to-person / merchant transfer SMS, including the common
 * "transfared" misspelling and messages that omit TxId.
 * Example shape: `*165*s*600 RWF transfared to Name(07…) at 2026-08-20 15:11:40.`
 */
export function extractMtnTransferConfirmationFromSms(text: string): MtnTransferConfirmation | null {
  const s = String(text ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim()
  const pattern = new RegExp(
    `([\\d][\\d\\s,.]*)\\s*(?:RWF|FRW|Frw|frw)\\s+${MTN_TRANSFER_VERB}\\s+to\\s+([A-Za-z][^()\\n\\r]*?)\\s*(?:\\(([^)]+)\\))?\\s+at\\s+(\\d{4}[-/]\\d{1,2}[-/]\\d{1,2})\\s+(\\d{1,2}:\\d{2}(?::\\d{2})?)`,
    "i",
  )
  const m = s.match(pattern)
  if (!m) return null
  const amount = parseMoneyToken(m[1] || "")
  const receiverName = (m[2] || "").trim().replace(/\s+/g, " ")
  if (amount == null || !receiverName) return null
  const paren = classifyMtnParenReceiver(m[3] || "")
  const paidAt = extractDateFromMoMoSms(`${m[4]} ${m[5]}`)
  if (!paidAt) return null
  return {
    amount,
    receiverName,
    receiverPhone: paren.phone,
    receiverCode: paren.code,
    paidAt,
  }
}

export function extractMoMoPhonePaymentDetailsFromSms(text: string): {
  receiverName: string
  receiverPhone: string
} | null {
  const s = String(text ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ")
  const pattern = new RegExp(
    `${MTN_TRANSFER_VERB}\\s+to\\s+([^\\n\\r(]+?)\\s*\\((\\d{9,})\\)\\s*at\\s+`,
    "i",
  )
  const m = s.match(pattern)
  if (!m) return null
  return {
    receiverName: m[1].trim().replace(/[\s\n\r]+/g, " "),
    receiverPhone: m[2].trim(),
  }
}

export function extractMoMoCodePaymentDetailsFromSms(text: string): {
  receiverName: string
  receiverCode: string
} | null {
  const s = String(text ?? "")
  const pattern = /Your payment of\s+[\d\s,.]+\s*(?:RWF|FRW|Frw|frw)\s+to\s+(.+?)\s+(\d{3,})(?:\s+(?:was\s+completed\s+at|was\s+successful\b|on\b|,|\.|$))?/i
  const m = s.match(pattern)
  if (!m) return null
  return {
    receiverName: m[1].trim().replace(/[\s\n\r]+/g, " "),
    receiverCode: m[2].trim(),
  }
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
    const day = parseInt(dmyMatch[1], 10)
    const month = parseInt(dmyMatch[2], 10) - 1
    const year = parseInt(dmyMatch[3], 10)
    const timeStr = dmyMatch[4]
    const d = new Date(year, month, day)
    const timeParts = timeStr.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i)
    if (timeParts) {
      let hours = parseInt(timeParts[1], 10)
      const mins = parseInt(timeParts[2], 10)
      if (timeParts[4]?.toUpperCase() === "PM" && hours < 12) hours += 12
      if (timeParts[4]?.toUpperCase() === "AM" && hours === 12) hours = 0
      d.setHours(hours, mins, parseInt(timeParts[3] || "0", 10))
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
 * 0. Full SMS body required (not a bare TxId)
 * 1. Amount must match order total (within tolerance)
 * 2. Proof: existing TxId:… format OR a valid MTN transfer-confirmation SMS
 * 3. Transaction date must be recent (within maxAgeMinutes)
 * 4. Merchant code must match (if provided)
 *
 * @param toleranceRwf — allow ±1–2 RWF for rounding/fees (default 2)
 * @param merchantCode — the shop's MoMo merchant code (digits from USSD)
 * @param maxAgeMinutes — max allowed age of SMS (default 15 min)
 */
export function matchMoMoSmsToOrderTotal(
  sms: string,
  orderTotalRwf: number,
  toleranceRwf = 2,
  merchantCode?: string,
  maxAgeMinutes = DEFAULT_MAX_AGE_MINUTES,
): MoMoSmsMatchResult {
  const txId = extractMoMoTxIdFromSms(sms)
  const referenceNote = extractMoMoReferenceNoteFromSms(sms)
  const transferConfirmation = extractMtnTransferConfirmationFromSms(sms)
  const phonePaymentDetails = extractMoMoPhonePaymentDetailsFromSms(sms)
  const codePaymentDetails = extractMoMoCodePaymentDetailsFromSms(sms)
  const parsedDateObj = transferConfirmation?.paidAt ?? extractDateFromMoMoSms(sms)
  const parsedDate = parsedDateObj ? parsedDateObj.toISOString() : null
  const paidAtIso = parsedDate
  const candidates = extractRwfAmountCandidatesFromText(sms)

  const base: Pick<
    MoMoSmsMatchResult,
    | "candidates"
    | "txId"
    | "referenceNote"
    | "paidAtIso"
    | "parsedDate"
    | "receiverName"
    | "receiverPhone"
    | "receiverCode"
  > = {
    candidates,
    txId,
    referenceNote,
    paidAtIso,
    parsedDate,
    receiverName:
      transferConfirmation?.receiverName ??
      phonePaymentDetails?.receiverName ??
      codePaymentDetails?.receiverName ??
      null,
    receiverPhone: transferConfirmation?.receiverPhone ?? phonePaymentDetails?.receiverPhone ?? null,
    receiverCode: transferConfirmation?.receiverCode ?? codePaymentDetails?.receiverCode ?? null,
  }

  if (looksLikeBareTxId(sms)) {
    return {
      ...base,
      matched: false,
      amount: null,
      dateValid: null,
      merchantCodeValid: null,
      rejectReason: "bare_txid",
    }
  }

  if (!looksLikeFullPaymentSms(sms)) {
    return {
      ...base,
      matched: false,
      amount: null,
      dateValid: null,
      merchantCodeValid: null,
      rejectReason: "incomplete_sms",
    }
  }

  if (!Number.isFinite(orderTotalRwf) || orderTotalRwf < 1) {
    return {
      ...base,
      matched: false,
      amount: null,
      dateValid: null,
      merchantCodeValid: null,
      rejectReason: "no_amount",
    }
  }

  // 1. Check amount match against order total.
  // Format B uses the transfer amount only (ignore fee / balance).
  const hit = transferConfirmation
    ? Math.abs(transferConfirmation.amount - orderTotalRwf) <= toleranceRwf
      ? transferConfirmation.amount
      : undefined
    : candidates.find((n) => Math.abs(n - orderTotalRwf) <= toleranceRwf)
  if (hit == null) {
    if (!transferConfirmation && !candidates.length) {
      return {
        ...base,
        matched: false,
        amount: null,
        dateValid: null,
        merchantCodeValid: null,
        rejectReason: "no_amount",
      }
    }
    return {
      ...base,
      matched: false,
      amount: transferConfirmation?.amount ?? candidates[candidates.length - 1] ?? null,
      dateValid: null,
      merchantCodeValid: null,
      rejectReason: "amount_mismatch",
    }
  }

  // 2. Proof: existing TxId:… format OR a parsed MTN transfer confirmation (Format B).
  if (!txId && !transferConfirmation) {
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

/** Normalized rail for order_transaction.BANK / ebm.rw bank field. */
export function normalizePaymentBank(
  paymentNameOrBank: string,
): "momo" | "airtel" | "urubuto" | "azampay" | "cash" | "other" {
  const m = String(paymentNameOrBank || "").toLowerCase()
  if (m.includes("airtel")) return "airtel"
  if (m.includes("urubuto")) return "urubuto"
  if (m.includes("azampay")) return "azampay"
  if (m.includes("momo") || m === "mtn") return "momo"
  if (m.includes("cash") || m.includes("delivery") || m.includes("table")) return "cash"
  return "other"
}
