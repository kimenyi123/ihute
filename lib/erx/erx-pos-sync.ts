/**
 * Pull pharmacy answers from order_transaction / order_transaction_list after POS
 * receive_order_response updates CONFIRMED_RECEIVED_QTY + UNITY_PRICE.
 */

import type { RowDataPacket } from "mysql2/promise"

import { erxLineCode } from "@/lib/erx/erx-pos-channel"
import type { ErxPosSyncAnswer, ErxQuoteLine, ErxRfqItem } from "@/lib/erx/erx-market-types"
import { getErxMysqlPool } from "@/lib/erx/erx-mysql"

export const ERX_SYNC_POLL_SEC = 10

type PosLineRow = RowDataPacket & {
  order_number: string
  seller_ishyiga_account: string
  order_status: string | null
  served_amount: number | null
  item_code: string
  item_name: string
  quantity: number
  confirmed_qty: number
  request_price: number
  unity_price: number
}

export type PosPharmacyPull = {
  pharmacyId: string
  orderNumber: string
  orderStatus: string
  servedAmount: number
  lines: Array<{
    itemCode: string
    itemName: string
    needQty: number
    confirmedQty: number
    unitPrice: number
  }>
  outcome: "CALLING" | "FULL" | "PARTIAL" | "DECLINED"
  goods: number
  syncAnswer: ErxPosSyncAnswer
}

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function deriveOutcome(
  items: ErxRfqItem[],
  lines: PosPharmacyPull["lines"],
  orderStatus: string,
): PosPharmacyPull["outcome"] {
  const answered = lines.filter((l) => l.confirmedQty > 0 && l.unitPrice > 0)
  if (!answered.length) {
    const st = (orderStatus || "").toUpperCase()
    if (st.includes("DECLIN") || st.includes("CANCEL") || st.includes("REFUSE")) return "DECLINED"
    return "CALLING"
  }
  let fullCount = 0
  for (let ix = 0; ix < items.length; ix++) {
    const it = items[ix]
    const code = erxLineCode(it.name, ix)
    const line =
      lines.find((l) => l.itemCode === code) ||
      lines.find((l) => l.itemName.trim().toLowerCase() === it.name.trim().toLowerCase())
    if (line && line.confirmedQty >= it.qty && line.unitPrice > 0) fullCount++
  }
  if (fullCount >= items.length) return "FULL"
  return "PARTIAL"
}

function toQuoteLines(items: ErxRfqItem[], pulled: PosPharmacyPull["lines"]): ErxQuoteLine[] {
  return items.map((it, ix) => {
    const code = erxLineCode(it.name, ix)
    const line =
      pulled.find((l) => l.itemCode === code) ||
      pulled.find((l) => l.itemName.trim().toLowerCase() === it.name.trim().toLowerCase())
    const qty = line ? Math.round(line.confirmedQty) : 0
    const unit = line ? Math.round(line.unitPrice) : 0
    return { name: it.name, need: it.qty, qty, unit, price: unit * qty }
  })
}

function previewAnswer(outcome: PosPharmacyPull["outcome"], lines: ErxQuoteLine[]): string {
  if (outcome === "CALLING") return "POS…"
  const priced = lines.filter((l) => l.qty > 0 && l.unit > 0)
  const total = priced.reduce((s, l) => s + l.price, 0)
  return `${priced.length}/${lines.length} · ${total.toLocaleString("en-US")} RWF`
}

/** Load POS line updates for every pharmacy RFQ row ({orderId}-{pharmacyId}). */
export async function pullPosQuotesFromMysql(input: {
  orderId: string
  erxCode: string
  items: ErxRfqItem[]
  pharmacyIds: string[]
  pharmacyNames: Record<string, string>
}): Promise<PosPharmacyPull[]> {
  const pool = getErxMysqlPool()
  if (!pool || !input.pharmacyIds.length) return []

  const pattern = `${input.orderId}-%`
  const [rows] = await pool.query<PosLineRow[]>(
    `SELECT t.order_number,
            t.seller_ishyiga_account,
            t.order_status,
            t.SERVED_AMOUNT AS served_amount,
            l.item_code,
            l.item_name,
            l.quantity,
            COALESCE(l.CONFIRMED_RECEIVED_QTY, 0) AS confirmed_qty,
            COALESCE(l.REQUEST_PRICE, 0) AS request_price,
            COALESCE(l.UNITY_PRICE, 0) AS unity_price
     FROM order_transaction t
     INNER JOIN order_transaction_list l ON l.id_order = t.id_order
     WHERE t.buyer_ishyiga_account = 'IHUTE'
       AND t.order_number LIKE ?
     ORDER BY t.id_order, l.id`,
    [pattern],
  )

  const byPharmacy = new Map<string, PosLineRow[]>()
  for (const row of rows) {
    const acc = String(row.seller_ishyiga_account || "").trim()
    if (!acc) continue
    const list = byPharmacy.get(acc) || []
    list.push(row)
    byPharmacy.set(acc, list)
  }

  const out: PosPharmacyPull[] = []
  for (const pharmacyId of input.pharmacyIds) {
    const group = byPharmacy.get(pharmacyId) || []
    const head = group[0]
    const orderNumber = head ? String(head.order_number) : `${input.orderId}-${pharmacyId}`
    const orderStatus = head ? String(head.order_status || "OPEN") : "OPEN"
    const servedAmount = head ? num(head.served_amount) : 0

    const lines = group.map((r) => {
      const unit = num(r.unity_price) > 0 ? num(r.unity_price) : num(r.request_price)
      return {
        itemCode: String(r.item_code || ""),
        itemName: String(r.item_name || ""),
        needQty: num(r.quantity),
        confirmedQty: num(r.confirmed_qty),
        unitPrice: unit,
      }
    })

    const outcome = deriveOutcome(input.items, lines, orderStatus)
    const quoteLines = toQuoteLines(input.items, lines)
    const goods = quoteLines.reduce((s, l) => s + l.price, 0)
    const pharmacyName = input.pharmacyNames[pharmacyId] || pharmacyId

    out.push({
      pharmacyId,
      orderNumber,
      orderStatus,
      servedAmount,
      lines,
      outcome,
      goods,
      syncAnswer: {
        pharmacyId,
        pharmacyName,
        status: outcome,
        preview: previewAnswer(outcome, quoteLines),
        lines: quoteLines.map((l) => ({
          code: erxLineCode(l.name, input.items.findIndex((i) => i.name === l.name)),
          name: l.name,
          confirmedQty: l.qty,
          unitPrice: l.unit,
        })),
      },
    })
  }

  return out
}
