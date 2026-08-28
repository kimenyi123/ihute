/**
 * eRx → Ishyiga POS via post_orders (insertTransaction).
 * One XML post per pharmacy on RFQ; header marks the order as eRx:
 *   INFO_1=ERX, REFERENCE={eRx code}, USER_INITIATOR={MoH patient name},
 *   PATIENT_PHONE_NUMBER={MoH phone}, MSG_UBITANZE=KEY USED
 * Pay / responder notify comes later — this module is insert-only for now.
 */

import { getPostOrdersUrl } from "@/lib/backend-config"
import { buildPostOrdersXml } from "@/lib/post-orders-build"
import type { ErxRfqItem } from "./erx-market-types"

const POS_TIMEOUT_MS = 15000
const ERX_INITIATOR_ID = "IHUTE"
const ERX_INITIATOR_USER = "erx@ihute.rw"

export type ErxPosInsertResult = {
  pharmacyId: string
  transactionId: string
  ok: boolean
  /** Row was already on post_orders from an earlier RFQ attempt. */
  alreadyExists?: boolean
  backend?: string
  error?: string
}

function parsePosInsertResponse(res: { ok: boolean; text: string; status: number }): {
  ok: boolean
  alreadyExists: boolean
  error?: string
} {
  const text = res.text
  const alreadyExists = /already exist/i.test(text)
  const ok =
    res.ok &&
    (alreadyExists ||
      text === "1" ||
      /Transaction saved successfully/i.test(text) ||
      /^\d+$/.test(text))
  return {
    ok,
    alreadyExists,
    error: ok ? undefined : `HTTP ${res.status}: ${text.slice(0, 200)}`,
  }
}

export function erxLineCode(name: string, index: number): string {
  const slug = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40)
  return slug ? `ERX_${slug}` : `ERX_LINE_${index + 1}`
}

async function postOrdersXml(xmlBody: string): Promise<{ ok: boolean; text: string; status: number }> {
  const url = getPostOrdersUrl()
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/xml",
      Accept: "application/xml, text/plain, */*",
    },
    body: xmlBody,
    signal: AbortSignal.timeout(POS_TIMEOUT_MS),
    cache: "no-store",
  })
  const text = await res.text()
  return { ok: res.ok, text: text.trim(), status: res.status }
}

/**
 * Inserts one pending order per pharmacy on post_orders (POS poll channel).
 */
export async function pushRfqToPos(input: {
  orderId: string
  erxCode: string
  items: ErxRfqItem[]
  pharmacies: Array<{ id: string; name?: string }>
  /** Full name from MoH Patient resource (after unlock). */
  patientName?: string
  /** Normalized digits from MoH Patient telecom. */
  patientPhone?: string
  msgUbitanze?: string
}): Promise<ErxPosInsertResult[]> {
  const msg = (input.msgUbitanze || "KEY USED").trim()
  const lines = input.items.map((it, ix) => ({
    ITEM_NAME: it.name,
    CODE_ISHYIGA: erxLineCode(it.name, ix),
    QUANTITY: it.qty,
    PRICE: it.avgUnit > 0 ? it.avgUnit : 0,
    INFO: it.doseText || "",
  }))
  const amount = input.items.reduce((s, it) => s + it.qty * (it.avgUnit > 0 ? it.avgUnit : 0), 0)

  const patientName = (input.patientName || "").trim()
  const patientPhone = (input.patientPhone || "").trim()
  const seenPharmacy = new Set<string>()
  const results: ErxPosInsertResult[] = []

  for (const ph of input.pharmacies) {
    const pharmacyId = ph.id.trim()
    if (!pharmacyId || seenPharmacy.has(pharmacyId)) continue
    seenPharmacy.add(pharmacyId)
    const transactionId = `${input.orderId}-${pharmacyId}`
    const xml = buildPostOrdersXml({
      header: {
        ID_INITIATOR: ERX_INITIATOR_ID,
        USER_INITIATOR: patientName || ERX_INITIATOR_USER,
        ID_RECEIVER: pharmacyId,
        USER_RECEIVER: ph.name?.trim() || pharmacyId,
        TRANSACTION_ID: transactionId,
        TRANSACTION_TYPE: "OPEN",
        PAYMENT_STATUS: "NA",
        PAYMENT_TYPE: "NA",
        TRANSACTION_TAXES: 0,
        TRANSACTION_AMOUNT: amount,
        INFO_1: "ERX",
        INFO_2: input.erxCode,
        REFERENCE: input.erxCode,
        PATIENT_PHONE_NUMBER: patientPhone || undefined,
        SEARCH_IN_COMPANY: "YES",
        MSG_UBITANZE: msg,
        TRANSACTION_ID_UBITANZE: input.orderId,
        CLIENT_GROUP: "ERX_RFQ",
        REKISIYO_STATUS: `ERX/${input.erxCode}`,
      },
      ITEMSLINE: lines,
    })

    try {
      const res = await postOrdersXml(xml)
      const parsed = parsePosInsertResponse(res)
      if (!parsed.ok) {
        console.warn("[erx-pos] insert failed", pharmacyId, res.status, res.text.slice(0, 200))
      }
      results.push({
        pharmacyId,
        transactionId,
        ok: parsed.ok,
        alreadyExists: parsed.alreadyExists,
        backend: res.text.slice(0, 300),
        error: parsed.error,
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.warn("[erx-pos] post_orders unreachable:", pharmacyId, message)
      results.push({
        pharmacyId,
        transactionId,
        ok: false,
        error: message,
      })
    }
  }

  return results
}

/** Pay notifications — stub until payment step is wired. */
export async function notifyRespondersAfterPay(_input: {
  orderId: string
  erxCode: string
  chosenPharmacyId: string
  responderPharmacyIds: string[]
}): Promise<void> {
  /* pay comes after insert — no-op for now */
}
