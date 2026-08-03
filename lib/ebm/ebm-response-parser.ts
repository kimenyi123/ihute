import type { EbmParsedResponse } from "@/lib/ebm/types"

function pick(obj: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k]
    if (v != null && String(v).trim() !== "") return String(v).trim()
  }
  return null
}

function asRecord(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>
  }
  if (typeof raw === "string" && raw.trim()) {
    try {
      const j = JSON.parse(raw) as unknown
      if (j && typeof j === "object") return j as Record<string, unknown>
    } catch {
      return { rawText: raw }
    }
  }
  return {}
}

/** Parse RRA VSDC response (field names vary by deployment). */
export function parseEbmResponse(raw: unknown): EbmParsedResponse {
  const obj = asRecord(raw)
  const nested = asRecord(obj.data ?? obj.result ?? obj.response ?? obj.RESPONSE)
  const message = asRecord(nested.MESSAGE ?? nested.message)

  const status =
    pick(obj, "STATUS", "status", "Status", "resultCode", "RESULT") ??
    pick(nested, "STATUS", "status") ??
    ""

  const qrCode =
    pick(obj, "QR_CODE", "qrCode", "QRCode", "qrcode") ??
    pick(nested, "QR_CODE", "qrCode")

  const ysdcid =
    pick(obj, "ysdcid", "YSDCID", "sdcId", "SDC_ID") ??
    pick(nested, "ysdcid", "YSDCID") ??
    pick(message, "ysdcid", "YSDCID")
  const ysdcrecnum =
    pick(obj, "ysdcrecnum", "YSDCRECNUM", "receiptNumber", "RECEIPT_NUMBER") ??
    pick(nested, "ysdcrecnum", "YSDCRECNUM") ??
    pick(message, "ysdcrecnum", "YSDCRECNUM", "num")
  const ysdcintdata =
    pick(obj, "ysdcintdata", "YSDCINTDATA") ??
    pick(nested, "ysdcintdata") ??
    pick(message, "ysdcintdata", "YSDCINTDATA")
  const ysdcmrc =
    pick(obj, "ysdcmrc", "YSDCMRC") ?? pick(nested, "ysdcmrc") ?? pick(message, "ysdcmrc", "YSDCMRC")
  const ysdcmrctim =
    pick(obj, "ysdcmrctim", "YSDCMRCTIM") ??
    pick(nested, "ysdcmrctim") ??
    pick(message, "ysdcmrctim", "YSDCMRCTIM")
  const ysdcregsig =
    pick(obj, "ysdcregsig", "YSDCREGSIG", "fiscalSignature", "RECEIPT_SIGNATURE") ??
    pick(nested, "ysdcregsig", "YSDCREGSIG") ??
    pick(message, "ysdcregsig", "YSDCREGSIG")
  const ysdctime =
    pick(obj, "ysdctime", "YSDCTIME", "timeSdc") ??
    pick(nested, "ysdctime") ??
    pick(message, "ysdctime", "YSDCTIME")

  const success =
    /success/i.test(status) ||
    status === "0" ||
    status === "00" ||
    Boolean(ysdcrecnum && (ysdcregsig || qrCode))

  return {
    status,
    qrCode,
    ysdcid,
    ysdcrecnum,
    ysdcintdata,
    ysdcmrc,
    ysdcmrctim,
    ysdcregsig,
    ysdctime,
    fiscalSignature: ysdcregsig,
    receiptNumber: ysdcrecnum,
    raw: obj,
    success,
  }
}
