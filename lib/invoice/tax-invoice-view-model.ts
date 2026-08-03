import { getTaxInvoiceAppName, getTaxInvoiceVatRateB } from "@/lib/invoice/tax-invoice-config"
import type {
  TaxInvoiceBuildInput,
  TaxInvoiceLineItem,
  TaxInvoiceTotals,
  TaxInvoiceViewModel,
} from "@/lib/invoice/tax-invoice-types"

function str(v: unknown): string {
  if (v == null) return ""
  return String(v).trim()
}

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function formatInvoiceDate(iso?: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return str(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function pickEbmRequestField(raw: unknown, ...keys: string[]): string {
  if (!raw || typeof raw !== "object") return ""
  const obj = raw as Record<string, unknown>
  for (const key of keys) {
    const v = obj[key]
    if (v != null && String(v).trim()) return String(v).trim()
  }
  return ""
}

function mapEbmRequestItems(raw: unknown): TaxInvoiceLineItem[] {
  if (!raw || typeof raw !== "object") return []
  const items = (raw as { items?: unknown }).items
  if (!Array.isArray(items)) return []

  const defaultRate = getTaxInvoiceVatRateB()
  return items.map((row) => {
    const r = row as Record<string, unknown>
    const qty = num(r.quantity ?? r.qty) || 1
    const unitPrice = num(r.unitPrice ?? r.unit_price)
    const discount = num(r.discount ?? r.discountAmount)
    const taxCode = str(r.taxCode ?? r.tax_code) || "A"
    const taxRate = num(r.taxRate ?? r.tax_rate) || (taxCode.toUpperCase() === "B" ? defaultRate : 0)
    const totalPrice = Math.round(qty * unitPrice - discount)
    return {
      name: str(r.description ?? r.itemName ?? r.name) || "Item",
      code: str(r.itemCode ?? r.item_code ?? r.code) || "—",
      qty,
      taxCode: taxCode.toUpperCase(),
      taxRate,
      unitPrice: Math.round(unitPrice),
      totalPrice,
    }
  })
}

function firstLineOnly(value: string): string {
  return value.split(/\r?\n/)[0]?.trim() || value.trim()
}

/** Internal order routing refs must not appear on the printed tax invoice. */
function isInternalOrderRef(value: string): boolean {
  return /IHUTE:PI:|FEE:|SUB:|LOG:|PAY:|CH=/i.test(value)
}

function resolveDisplayInvoiceNumber(input: TaxInvoiceBuildInput): string {
  const { order, fiscal } = input
  const raw = fiscal?.rawRequest

  const fromEbm = pickEbmRequestField(raw, "invoiceNumber", "invoice_number")
  if (fromEbm) return fromEbm

  const stored = str(fiscal?.invoiceNumber)
  if (stored && !isInternalOrderRef(stored)) {
    return firstLineOnly(stored)
  }

  return `ORD-${order.orderId}`
}

function mapOrderLineItemsFromBackend(input: TaxInvoiceBuildInput): TaxInvoiceLineItem[] {
  const defaultRate = getTaxInvoiceVatRateB()
  return input.order.items.map((item, idx) => {
    const qty = num(item.qty) || 1
    const unitPrice = Math.round(num(item.unitPrice))
    const taxCode = str(item.taxCode) || "A"
    const taxRate = num(item.taxRate) || (taxCode.toUpperCase() === "B" ? defaultRate : 0)
    return {
      name: str(item.name) || `Item ${idx + 1}`,
      code: str(item.itemCode ?? item.ITEM_CODE) || "—",
      qty,
      taxCode: taxCode.toUpperCase(),
      taxRate,
      unitPrice,
      totalPrice: qty * unitPrice,
    }
  })
}

function mapOrderItems(input: TaxInvoiceBuildInput): TaxInvoiceLineItem[] {
  const fromOrder = mapOrderLineItemsFromBackend(input)
  if (fromOrder.length > 0) {
    const ebmLines = mapEbmRequestItems(input.fiscal?.rawRequest)
    if (ebmLines.length === fromOrder.length) {
      return fromOrder.map((line, i) => ({
        ...line,
        taxCode: ebmLines[i]?.taxCode || line.taxCode,
        taxRate: ebmLines[i]?.taxRate ?? line.taxRate,
      }))
    }
    return fromOrder
  }
  return mapEbmRequestItems(input.fiscal?.rawRequest)
}

/** Compute RRA-style totals for inclusive VAT (tax code B). */
export function computeTaxInvoiceTotals(items: TaxInvoiceLineItem[]): TaxInvoiceTotals {
  let totalAEx = 0
  let totalB14 = 0
  let totalTaxB = 0
  let totalC0 = 0

  for (const item of items) {
    const line = item.totalPrice
    const code = item.taxCode.toUpperCase()
    if (code === "B") {
      const rate = item.taxRate > 0 ? item.taxRate / 100 : getTaxInvoiceVatRateB() / 100
      const tax = rate > 0 ? line * rate / (1 + rate) : 0
      totalTaxB += tax
      totalB14 += line
    } else if (code === "C") {
      totalC0 += line
    } else {
      totalAEx += line
    }
  }

  const total = totalAEx + totalB14 + totalC0
  return {
    total: Math.round(total),
    totalAEx: Math.round(totalAEx),
    totalB14: Math.round(totalB14),
    totalTaxB: Math.round(totalTaxB * 100) / 100,
    totalC0: Math.round(totalC0),
    totalTax: Math.round(totalTaxB * 100) / 100,
  }
}

function buildQrContent(input: TaxInvoiceBuildInput, meta: { invoiceNumber: string; invoiceDate: string }): string | null {
  const fiscal = input.fiscal
  if (!fiscal) return null

  const fromEbm = str(fiscal.qrCode)
  if (fromEbm) return fromEbm

  const raw = fiscal.rawRequest
  const sellerTin = pickEbmRequestField(raw, "companyTin", "company_tin") || str(input.order.SELLER_TIN)
  const parts = [
    meta.invoiceNumber,
    str(fiscal.receiptNumber),
    str(fiscal.fiscalSignature),
    str(fiscal.sdcId),
    str(fiscal.internalData),
    sellerTin,
    meta.invoiceDate,
  ].filter(Boolean)

  return parts.length > 0 ? parts.join("|") : null
}

export function buildTaxInvoiceViewModel(input: TaxInvoiceBuildInput): TaxInvoiceViewModel {
  const { order, fiscal } = input
  const raw = fiscal?.rawRequest
  const isFiscalized = Boolean(fiscal)

  const sellerTin =
    pickEbmRequestField(raw, "companyTin", "company_tin") || str(order.SELLER_TIN)
  const buyerTin =
    pickEbmRequestField(raw, "clientTin", "client_tin") || str(order.BUYER_TIN)
  const sellerName = str(order.sellerName) || pickEbmRequestField(raw, "userName") || "—"
  const buyerName =
    pickEbmRequestField(raw, "businessPartnerName", "business_partner_name") ||
    str(order.buyerName) ||
    "—"

  const invoiceNumber = resolveDisplayInvoiceNumber(input)
  const invoiceDate =
    formatInvoiceDate(fiscal?.invoiceDate) ||
    pickEbmRequestField(raw, "invoiceDate", "invoice_date") ||
    formatInvoiceDate(order.createdAt)

  const items = mapOrderItems(input)
  const totals = computeTaxInvoiceTotals(items)
  const qrContent = buildQrContent(input, { invoiceNumber, invoiceDate })

  const sdcFieldsPresent = Boolean(
    fiscal &&
      (fiscal.timeSdc ||
        fiscal.sdcId ||
        fiscal.receiptNumber ||
        fiscal.internalData ||
        fiscal.fiscalSignature ||
        fiscal.mrc),
  )

  return {
    seller: {
      tin: sellerTin || "—",
      companyName: sellerName,
      address: str(order.SELLER_ADDRESS) || "—",
      phone: str(order.sellerPhone) || "—",
      email: str(order.SELLER_EMAIL) || str(order.buyerEmail) || "—",
    },
    buyer: {
      tin: buyerTin || "—",
      name: buyerName,
    },
    meta: {
      invoiceNumber,
      invoiceDate,
    },
    items,
    totals,
    sdc: {
      timeSdc: str(fiscal?.timeSdc) || "—",
      sdcId: str(fiscal?.sdcId) || "—",
      receiptNumber: str(fiscal?.receiptNumber) || "—",
      internalData: str(fiscal?.internalData) || "—",
      receiptSignature: str(fiscal?.fiscalSignature) || "—",
      mrc: str(fiscal?.mrc) || "—",
      qrContent,
      showSdc: isFiscalized && sdcFieldsPresent,
      showQr: isFiscalized && Boolean(qrContent),
    },
    currency: str(order.CURRENCY) || "RWF",
    appName: getTaxInvoiceAppName(),
    isFiscalized,
  }
}

export function formatTaxMoney(amount: number, currency: string): string {
  return `${Number(amount || 0).toLocaleString()} ${currency}`
}
