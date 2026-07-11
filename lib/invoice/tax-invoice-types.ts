import type { BuyerEbmFiscalInfo } from "@/lib/ebm/ebm-buyer-request"

export type TaxInvoiceLineItem = {
  name: string
  code: string
  qty: number
  taxCode: string
  taxRate: number
  unitPrice: number
  totalPrice: number
}

export type TaxInvoiceTotals = {
  total: number
  totalAEx: number
  totalB14: number
  totalTaxB: number
  totalC0: number
  totalTax: number
}

export type TaxInvoiceSeller = {
  tin: string
  companyName: string
  address: string
  phone: string
  email: string
}

export type TaxInvoiceBuyer = {
  tin: string
  name: string
}

export type TaxInvoiceMeta = {
  invoiceNumber: string
  invoiceDate: string
}

export type TaxInvoiceSdc = {
  timeSdc: string
  sdcId: string
  receiptNumber: string
  internalData: string
  receiptSignature: string
  mrc: string
  qrContent: string | null
  showSdc: boolean
  showQr: boolean
}

export type TaxInvoiceViewModel = {
  seller: TaxInvoiceSeller
  buyer: TaxInvoiceBuyer
  meta: TaxInvoiceMeta
  items: TaxInvoiceLineItem[]
  totals: TaxInvoiceTotals
  sdc: TaxInvoiceSdc
  currency: string
  appName: string
  isFiscalized: boolean
}

export type TaxInvoiceOrderInput = {
  orderId: string
  sellerName?: string
  sellerPhone?: string
  sellerAccount?: string
  buyerName?: string
  buyerPhone?: string
  buyerLocation?: string
  buyerEmail?: string
  createdAt: string
  total?: number
  items: Array<{
    name: string
    qty: number
    unitPrice: number
    itemCode?: string
    ITEM_CODE?: string
    taxCode?: string
    taxRate?: number
  }>
  SELLER_TIN?: string
  BUYER_TIN?: string
  SELLER_EMAIL?: string
  BUYER_EMAIL?: string
  SELLER_ADDRESS?: string
  CURRENCY?: string
}

export type TaxInvoiceBuildInput = {
  order: TaxInvoiceOrderInput
  fiscal?: BuyerEbmFiscalInfo | null
}
