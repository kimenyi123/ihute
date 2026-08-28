/**
 * eRx → Ishyiga POS bridge. Rides the EXISTING ihute pending-orders channel
 * that Ishyiga POS already polls (Kaos OrdersServlet): RFQ lines are inserted
 * with type=ERX_RFQ so they appear on the pharmacy POS panel, and after
 * payment every responding pharmacy gets a message on the same channel
 * (chosen → serve; others → order closed, release reservation).
 *
 * TODO(real): the Kaos servlet does not accept type=ERX_RFQ yet. Until the
 * Java side lands, these calls are attempted and logged, never thrown — the
 * patient flow keeps working from the local store (mock simulator answers
 * when NEXT_PUBLIC_ERX_MOCK=1). Tracked in README-erx.md ("real vs stubbed").
 */

import { getOrdersUrl } from "@/lib/backend-config"
import type { ErxRfqItem } from "./erx-market-types"

const POS_TIMEOUT_MS = 8000

async function postToPos(payload: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch(getOrdersUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(POS_TIMEOUT_MS),
    })
    if (!res.ok) {
      console.warn("[erx-pos] POS channel HTTP", res.status, payload.action)
      return false
    }
    return true
  } catch (e) {
    console.warn("[erx-pos] POS channel unreachable:", (e as Error).message, payload.action)
    return false
  }
}

/** Inserts ERX_RFQ order lines on the pending-orders channel for each pharmacy. */
export async function pushRfqToPos(input: {
  orderId: string
  erxCode: string
  items: ErxRfqItem[]
  pharmacyIds: string[]
}): Promise<void> {
  await postToPos({
    action: "createOrder",
    type: "ERX_RFQ",
    orderId: input.orderId,
    erx_code: input.erxCode,
    pharmacyIds: input.pharmacyIds,
    lines: input.items.map((it) => ({ name: it.name, qty: it.qty })),
  })
}

/** After payment: chosen pharmacy serves, all other responders release their reservation. */
export async function notifyRespondersAfterPay(input: {
  orderId: string
  erxCode: string
  chosenPharmacyId: string
  responderPharmacyIds: string[]
}): Promise<void> {
  await Promise.all(
    input.responderPharmacyIds.map((pharmacyId) =>
      postToPos({
        action: "erxOrderResolved",
        type: "ERX_ORDER",
        orderId: input.orderId,
        erx_code: input.erxCode,
        pharmacyId,
        outcome: pharmacyId === input.chosenPharmacyId ? "SERVE" : "CLOSED_RELEASE_RESERVATION",
      }),
    ),
  )
}
