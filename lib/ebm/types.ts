/** Payload sent to POST /vsdc/post_receipt_vsdc_rite_convert_Json */
export type EbmInvoiceRequest = {
  companyTin: string
  ComputationType: string
  fileName: string
  flag: string
  saleType: string
  voucherAmount: string
  discountAmount: string
  businessPartnerName: string
  invoiceDate: string
  userName: string
  itemsCount: string
  clientTin: string
  totalAmount: string
  totalVat: string
  clientTinPin: string
  exchangeRate: string
  invoiceNumber: string
  callback: string
  currency: string
  discountType: string
  items: EbmInvoiceLineItem[]
}

export type EbmInvoiceLineItem = {
  itemCode: string
  description: string
  quantity: string
  unitPrice: string
  discount: string
  taxCode: string
  taxRate: string
  batch: string
  expire: string
}

export type EbmFiscalStatus = "pending" | "success" | "failed" | "retry" | "rejected"

export type EbmParsedResponse = {
  status: string
  qrCode: string | null
  ysdcid: string | null
  ysdcrecnum: string | null
  ysdcintdata: string | null
  ysdcmrc: string | null
  ysdcmrctim: string | null
  ysdcregsig: string | null
  ysdctime: string | null
  fiscalSignature: string | null
  receiptNumber: string | null
  raw: Record<string, unknown>
  success: boolean
}

export type AdminOrderLine = {
  itemCode?: string
  itemName?: string
  quantity?: number
  unitPrice?: number
  discountAmount?: number
  vatRate?: number
}

export type AdminOrderHeader = {
  id: number
  orderNumber?: string
  sellerName?: string
  sellerAccount?: string
  sellerTin?: string
  buyerName?: string
  buyerAccount?: string
  buyerTin?: string
  amount?: number
  taxes?: number
  paymentStatus?: string
  orderStatus?: string
  timestamp?: string
  currency?: string
}
