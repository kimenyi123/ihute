/**
 * Build XML for Java post_orders (EETransaction / insertTransaction).
 * Shared by /api/post-orders and eRx POS insert (lib/erx/erx-pos-channel.ts).
 */

export type PostOrdersHeader = {
  ID_INITIATOR: string
  USER_INITIATOR: string
  ID_RECEIVER: string
  USER_RECEIVER: string
  TIME?: string
  TRANSACTION_ID: string
  TRANSACTION_TYPE?: string
  PAYMENT_STATUS?: string
  PAYMENT_TYPE?: string
  PAYMENT_CARD_ID?: string
  TRANSACTION_TAXES?: string | number
  TRANSACTION_AMOUNT: string | number
  INFO_1?: string
  INFO_2?: string
  MSG_UBITANZE?: string
  TRANSACTION_ID_UBITANZE?: string
  CLIENT_GROUP?: string
  /** MoH eRx code — persisted on order_transaction.REFERENCE when POS inserts. */
  REFERENCE?: string
  /** Patient phone from MoH FHIR (telecom) — maps to BUYER_PHONE on insert. */
  PATIENT_PHONE_NUMBER?: string
  /** Tell POS to match ITEM_NAME against this seller's stock (not a fixed NIKI code). */
  SEARCH_IN_COMPANY?: string
  /** Rekizisiyo channel tag — eRx uses ERX/{eRxCode} e.g. ERX/EP-0317-170 */
  REKISIYO_STATUS?: string
}

export type PostOrdersLine = {
  ITEM_NAME: string
  CODE_ISHYIGA: string
  NIKI_CODE?: string
  QUANTITY: string | number
  PRICE?: string | number
  BATCH?: string
  EXPIRE_DATE?: string
  BON_LIVRAISON?: string
  PRIX_REVIENS?: string | number
  CONFIRMED_RECEIVED_QUANTITY?: string | number
  INFO?: string
}

export type PostOrdersBody = {
  header: PostOrdersHeader
  ITEMSLINE: PostOrdersLine[]
}

function escapeXml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

export function buildPostOrdersXml(body: PostOrdersBody): string {
  const h = body.header
  const time = h.TIME ?? new Date().toISOString().replace("T", " ").slice(0, 23)
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<request>\n  <header>\n'
  xml += `    <ID_INITIATOR>${escapeXml(h.ID_INITIATOR)}</ID_INITIATOR>\n`
  xml += `    <USER_INITIATOR>${escapeXml(h.USER_INITIATOR)}</USER_INITIATOR>\n`
  xml += `    <ID_RECEIVER>${escapeXml(h.ID_RECEIVER)}</ID_RECEIVER>\n`
  xml += `    <USER_RECEIVER>${escapeXml(h.USER_RECEIVER)}</USER_RECEIVER>\n`
  xml += `    <TIME>${escapeXml(time)}</TIME>\n`
  xml += `    <TRANSACTION_ID>${escapeXml(String(h.TRANSACTION_ID))}</TRANSACTION_ID>\n`
  xml += `    <TRANSACTION_TYPE>${escapeXml(h.TRANSACTION_TYPE ?? "OPEN")}</TRANSACTION_TYPE>\n`
  xml += `    <PAYMENT_STATUS>${escapeXml(h.PAYMENT_STATUS ?? "NA")}</PAYMENT_STATUS>\n`
  xml += `    <PAYMENT_TYPE>${escapeXml(h.PAYMENT_TYPE ?? "NA")}</PAYMENT_TYPE>\n`
  xml += `    <PAYMENT_CARD_ID>${escapeXml(h.PAYMENT_CARD_ID ?? "")}</PAYMENT_CARD_ID>\n`
  xml += `    <TRANSACTION_TAXES>${escapeXml(String(h.TRANSACTION_TAXES ?? "0"))}</TRANSACTION_TAXES>\n`
  xml += `    <TRANSACTION_AMOUNT>${escapeXml(String(h.TRANSACTION_AMOUNT))}</TRANSACTION_AMOUNT>\n`
  xml += `    <INFO_1>${escapeXml(h.INFO_1 ?? "")}</INFO_1>\n`
  xml += `    <INFO_2>${escapeXml(h.INFO_2 ?? "")}</INFO_2>\n`
  xml += `    <MSG_UBITANZE>${escapeXml(h.MSG_UBITANZE ?? "")}</MSG_UBITANZE>\n`
  xml += `    <TRANSACTION_ID_UBITANZE>${escapeXml(h.TRANSACTION_ID_UBITANZE ?? "")}</TRANSACTION_ID_UBITANZE>\n`
  xml += `    <CLIENT_GROUP>${escapeXml(h.CLIENT_GROUP ?? "")}</CLIENT_GROUP>\n`
  if (h.REFERENCE) {
    xml += `    <REFERENCE>${escapeXml(h.REFERENCE)}</REFERENCE>\n`
  }
  if (h.PATIENT_PHONE_NUMBER) {
    xml += `    <PATIENT_PHONE_NUMBER>${escapeXml(h.PATIENT_PHONE_NUMBER)}</PATIENT_PHONE_NUMBER>\n`
  }
  if (h.SEARCH_IN_COMPANY) {
    xml += `    <SEARCH_IN_COMPANY>${escapeXml(h.SEARCH_IN_COMPANY)}</SEARCH_IN_COMPANY>\n`
  }
  if (h.REKISIYO_STATUS) {
    xml += `    <REKISIYO_STATUS>${escapeXml(h.REKISIYO_STATUS)}</REKISIYO_STATUS>\n`
  }
  xml += "  </header>\n  <ITEMSLINE>\n"

  for (const lin of body.ITEMSLINE) {
    xml += "    <LIN>\n"
    xml += `      <ITEM_NAME>${escapeXml(lin.ITEM_NAME)}</ITEM_NAME>\n`
    xml += `      <CODE_ISHYIGA>${escapeXml(lin.CODE_ISHYIGA)}</CODE_ISHYIGA>\n`
    xml += `      <NIKI_CODE>${escapeXml(lin.NIKI_CODE ?? lin.CODE_ISHYIGA)}</NIKI_CODE>\n`
    xml += `      <QUANTITY>${escapeXml(String(lin.QUANTITY))}</QUANTITY>\n`
    xml += `      <PRICE>${escapeXml(String(lin.PRICE ?? "0.0"))}</PRICE>\n`
    xml += `      <BATCH>${escapeXml(lin.BATCH ?? "NA")}</BATCH>\n`
    xml += `      <EXPIRE_DATE>${escapeXml(lin.EXPIRE_DATE ?? "010160")}</EXPIRE_DATE>\n`
    xml += `      <BON_LIVRAISON>${escapeXml(lin.BON_LIVRAISON ?? "")}</BON_LIVRAISON>\n`
    xml += `      <PRIX_REVIENS>${escapeXml(String(lin.PRIX_REVIENS ?? "0.0"))}</PRIX_REVIENS>\n`
    xml += `      <CONFIRMED_RECEIVED_QUANTITY>${escapeXml(String(lin.CONFIRMED_RECEIVED_QUANTITY ?? "0.0"))}</CONFIRMED_RECEIVED_QUANTITY>\n`
    xml += `      <INFO>${escapeXml(lin.INFO ?? "")}</INFO>\n`
    xml += "    </LIN>\n"
  }
  xml += "  </ITEMSLINE>\n</request>"
  return xml
}
