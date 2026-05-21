/**
 * Heuristic parsing of pasted MTN MoMo (or similar) SMS bodies to find RWF amounts
 * and compare with the Quick Shop / Umuriro order total.
 *
 * Browsers cannot read SMS inboxes; the buyer pastes the confirmation message here.
 */

function parseMoneyToken(raw: string): number | null {
  const t = raw.replace(/\s/g, "").replace(/,/g, "")
  const n = Math.round(Number.parseFloat(t))
  if (!Number.isFinite(n) || n < 1 || n > 99_999_999) return null
  return n
}

/** Collect plausible RWF amounts from free-form SMS (MTN-style “800 RWF”, “RWF 800”, …). */
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
  /** All amounts seen in the SMS (debug / UX) */
  candidates: number[]
}

/**
 * @param toleranceRwf — allow ±1–2 RWF for rounding/fees (default 2)
 */
export function matchMoMoSmsToOrderTotal(
  sms: string,
  orderTotalRwf: number,
  toleranceRwf = 2,
): MoMoSmsMatchResult {
  const candidates = extractRwfAmountCandidatesFromText(sms)
  if (!Number.isFinite(orderTotalRwf) || orderTotalRwf < 1) {
    return { matched: false, amount: null, candidates }
  }
  const hit = candidates.find((n) => Math.abs(n - orderTotalRwf) <= toleranceRwf)
  if (hit != null) return { matched: true, amount: hit, candidates }
  return { matched: false, amount: candidates.length ? candidates[candidates.length - 1] : null, candidates }
}
