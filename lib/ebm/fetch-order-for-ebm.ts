import {

  getBackendBaseForProxy,

  getOrdersUrl,

  warmJavaBackendBase,

} from "@/lib/backend-config"

import type { AdminOrderHeader, AdminOrderLine } from "@/lib/ebm/types"



export type PublicOrderForEbm = {

  orderId: number

  orderNumber: string

  sellerAccount: string

  sellerName: string

  sellerTin?: string

  buyerName: string

  buyerPhone: string

  buyerTin?: string

  amount: number

  taxes: number

  orderStatus: string

  paymentStatus: string

  timestamp?: string

  currency: string

}



function orderDetailUrls(orderId: number): string[] {

  const base = getBackendBaseForProxy()

  const candidates = [

    getOrdersUrl(),

    `${base}/Kaos/OrdersServlet`,

    `${base}/OrdersServlet`,

  ]

  return [...new Set(candidates)].map(

    (root) => `${root}?action=getOrderDetails&orderId=${orderId}`,

  )

}



async function fetchOrderDetailsJson(orderId: number): Promise<Record<string, unknown> | null> {

  await warmJavaBackendBase()

  for (const url of orderDetailUrls(orderId)) {

    try {

      const res = await fetch(url, {

        method: "GET",

        headers: { Accept: "application/json" },

        cache: "no-store",

        signal: AbortSignal.timeout(12_000),

      })

      if (!res.ok) continue

      const data = (await res.json().catch(() => null)) as Record<string, unknown> | null

      if (data?.ok) return data

    } catch {

      /* try next servlet path */

    }

  }

  return null

}



/** Load order header from OrdersServlet (no admin auth — same as track-order). */

export async function fetchPublicOrderForEbm(orderId: number): Promise<PublicOrderForEbm | null> {

  const full = await fetchFullOrderForEbm(orderId)

  return full?.header ?? null

}



/** Order header + line items via OrdersServlet getOrderDetails (works without admin session). */

export async function fetchFullOrderForEbm(

  orderId: number,

): Promise<{ header: PublicOrderForEbm; items: AdminOrderLine[] } | null> {

  const data = await fetchOrderDetailsJson(orderId)

  if (!data) return null



  const o = (data.order ?? data) as Record<string, unknown>

  const id = Number(o.ID_ORDER ?? o.id ?? orderId)

  const sellerAccount = String(

    o.SELLER_ISHYIGA_ACCOUNT ?? o.sellerAccount ?? o.SELLER_ACCOUNT ?? "",

  ).trim()

  if (!sellerAccount) return null



  const itemsRaw = Array.isArray(data.items) ? data.items : []

  const items: AdminOrderLine[] = itemsRaw.map((row) => {

    const r = row as Record<string, unknown>

    return {

      itemCode: String(r.ITEM_CODE ?? r.itemCode ?? ""),

      itemName: String(r.ITEM_NAME ?? r.itemName ?? r.name ?? ""),

      quantity: Number(r.QUANTITY ?? r.qty ?? r.quantity) || 0,

      unitPrice: Number(r.UNIT_PRICE ?? r.UNITY_PRICE ?? r.unitPrice) || 0,

      discountAmount: Number(r.DISCOUNT_AMOUNT ?? r.discountAmount) || 0,

      vatRate: Number(r.VAT_RATE ?? r.vatRate) || 0,

    }

  })



  const header: PublicOrderForEbm = {

    orderId: id,

    orderNumber: String(o.REFERENCE ?? o.orderNumber ?? o.ORDER_NUMBER ?? `ORD-${id}`),

    sellerAccount,

    sellerName: String(o.SELLER_NAMES ?? o.sellerName ?? "Shop"),

    sellerTin: String(o.SELLER_TIN ?? o.seller_tin ?? o.sellerTin ?? ""),

    buyerName: String(o.BUYER_NAMES ?? o.BUYER_OWNER ?? o.buyerName ?? "Customer"),

    buyerPhone: String(o.BUYER_PHONE ?? o.buyerPhone ?? ""),

    buyerTin: String(o.BUYER_TIN ?? o.buyerTin ?? ""),

    amount: Number(o.AMOUNT ?? o.amount) || 0,

    taxes: Number(o.TAXES ?? o.taxes) || 0,

    orderStatus: String(o.ORDER_STATUS ?? o.orderStatus ?? ""),

    paymentStatus: String(o.PAYMENT_STATUS ?? o.paymentStatus ?? ""),

    timestamp: String(o.CREATED_AT ?? o.heure ?? o.timestamp ?? ""),

    currency: String(o.CURRENCY ?? o.currency ?? "RWF"),

  }



  return { header, items }

}



export function toAdminOrderHeader(o: PublicOrderForEbm): AdminOrderHeader {

  return {

    id: o.orderId,

    orderNumber: o.orderNumber,

    sellerName: o.sellerName,

    sellerAccount: o.sellerAccount,

    sellerTin: o.sellerTin,

    buyerName: o.buyerName,

    buyerTin: o.buyerTin,

    amount: o.amount,

    taxes: o.taxes,

    paymentStatus: o.paymentStatus,

    orderStatus: o.orderStatus,

    timestamp: o.timestamp,

    currency: o.currency,

  }

}

