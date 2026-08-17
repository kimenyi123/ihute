import type { AdminOrderHeader, AdminOrderLine, EbmInvoiceLineItem, EbmInvoiceRequest } from "@/lib/ebm/types"

function str(v: unknown): string {
  if (v == null) return ""
  return String(v).trim()
}

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function formatInvoiceDate(ts: string | undefined): string {
  if (!ts) return new Date().toISOString().slice(0, 19).replace("T", " ")
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 19).replace("T", " ")
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function mapLine(line: AdminOrderLine): EbmInvoiceLineItem {
  const qty = num(line.quantity) || 1
  const unit = num(line.unitPrice)
  const vatRate = num(line.vatRate)
  return {
    itemCode: str(line.itemCode) || "ITEM",
    description: str(line.itemName) || "Product",
    quantity: String(qty),
    unitPrice: String(Math.round(unit)),
    discount: String(Math.round(num(line.discountAmount))),
    taxCode: vatRate > 0 ? "B" : "A",
    taxRate: String(vatRate > 0 ? vatRate : 0),
    batch: "",
    expire: "",
  }
}

export type EbmInvoiceMapperInput = {
  order: AdminOrderHeader
  items: AdminOrderLine[]
  companyTin: string
  userName?: string
  callbackUrl?: string
}

/** Maps Kaos order header + lines → RRA EBM invoice JSON. */
export function mapOrderToEbmInvoice(input: EbmInvoiceMapperInput): EbmInvoiceRequest {
  const { order, items, companyTin, userName, callbackUrl } = input
  const lines = items.length > 0 ? items.map(mapLine) : [
    mapLine({
      itemName: "Order",
      quantity: 1,
      unitPrice: num(order.amount),
    }),
  ]

  const totalAmount = Math.round(num(order.amount))
  const totalVat = Math.round(num(order.taxes))
  /** VSDC expects a short unique invoice id — long delivery refs break validation. */
  const invoiceNumber = `EBM-${order.id}`

  return {
    companyTin: companyTin,
    ComputationType: "INCLUSIVE",
    fileName: `${invoiceNumber}.json`,
    flag: "INVOICE",
    saleType: "NORMAL",
    voucherAmount: "",
    discountAmount: "",
    businessPartnerName: str(order.buyerName) || "Customer",
    invoiceDate: formatInvoiceDate(order.timestamp),
    userName: userName || str(order.sellerName) || process.env.EBM_DEFAULT_USERNAME?.trim() || "",
    itemsCount: String(lines.length),
    clientTin: str(order.buyerTin),
    totalAmount: String(totalAmount),
    totalVat: String(totalVat),
    clientTinPin: "",
    exchangeRate: "1",
    invoiceNumber,
    callback: callbackUrl || "",
    currency: str(order.currency) || "RWF",
    discountType: "",
    items: lines,
  }
}