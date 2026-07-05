// xlsx@0.18 ships broken .d.ts — cast to `any` for build.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX: any = require("xlsx")

export function downloadExcel(
  rows: Record<string, string | number>[],
  sheetName: string,
  filePrefix: string,
): boolean {
  if (rows.length === 0) return false
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31))
  const stamp = new Date().toISOString().slice(0, 10)
  const safePrefix = filePrefix.replace(/[^\w.-]+/g, "_").slice(0, 48) || "grandma_export"
  XLSX.writeFile(wb, `${safePrefix}_${stamp}.xlsx`)
  return true
}

export type GrandmaStockExportLine = {
  itemName: string
  nikiCode: string
  quantity: number
  salePrice: number
  costPrice: number
}

export function grandmaStockToExcelRows(lines: GrandmaStockExportLine[]): Record<string, string | number>[] {
  return lines.map((r, i) => ({
    "#": i + 1,
    "Item name": r.itemName,
    "NIKI code": r.nikiCode,
    Quantity: r.quantity,
    "Sale price (RWF)": r.salePrice,
    "Cost price (RWF)": r.costPrice,
    "Stock value (RWF)": r.quantity * r.salePrice,
  }))
}

export type GrandmaOrderExportInput = {
  id: string
  ref: string
  status: string
  buyerName: string
  buyerPhone: string
  area: string
  amountRwf: number
  deliveryFeeRwf?: number
  paymentLabel?: string
  paymentStatus?: string
  paymentCode?: string
  transactionId?: string
  placedAt?: string
  logisticsIcon?: string
  lines: { name: string; qty: number; totalRwf?: number }[]
}

export function grandmaOrdersToExcelRows(orders: GrandmaOrderExportInput[]): Record<string, string | number>[] {
  const rows: Record<string, string | number>[] = []
  for (const o of orders) {
    const base: Record<string, string | number> = {
      "Order ID": o.id,
      "Order ref": o.ref,
      Status: o.status,
      "Placed at": o.placedAt ?? "",
      "Buyer name": o.buyerName,
      "Buyer phone": o.buyerPhone,
      "Delivery address": o.area,
      "Order total (RWF)": o.amountRwf,
      "Delivery fee (RWF)": o.deliveryFeeRwf ?? 0,
      Payment: o.paymentLabel ?? "",
      "Payment status": o.paymentStatus ?? "",
      "MoMo code": o.paymentCode ?? "",
      "Transaction ID": o.transactionId ?? "",
      Logistics: o.logisticsIcon ?? "",
    }
    if (o.lines.length === 0) {
      rows.push({ ...base, Product: "", Qty: 0, "Line total (RWF)": 0 })
      continue
    }
    for (const line of o.lines) {
      rows.push({
        ...base,
        Product: line.name,
        Qty: line.qty,
        "Line total (RWF)": line.totalRwf ?? 0,
      })
    }
  }
  return rows
}
