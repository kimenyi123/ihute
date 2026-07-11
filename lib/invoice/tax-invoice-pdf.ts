import { jsPDF } from "jspdf"
import { formatTaxMoney } from "@/lib/invoice/tax-invoice-view-model"
import type { TaxInvoiceViewModel } from "@/lib/invoice/tax-invoice-types"

async function svgElementToDataUrl(svg: SVGElement, size = 120): Promise<string | null> {
  try {
    const svgData = new XMLSerializer().serializeToString(svg)
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" })
    const url = URL.createObjectURL(svgBlob)
    return await new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement("canvas")
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext("2d")
        if (!ctx) {
          URL.revokeObjectURL(url)
          resolve(null)
          return
        }
        ctx.fillStyle = "#ffffff"
        ctx.fillRect(0, 0, size, size)
        ctx.drawImage(img, 0, 0, size, size)
        URL.revokeObjectURL(url)
        resolve(canvas.toDataURL("image/png"))
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        resolve(null)
      }
      img.src = url
    })
  } catch {
    return null
  }
}

function addWrappedText(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight = 4.5,
): number {
  const lines = doc.splitTextToSize(text, maxWidth) as string[]
  for (const line of lines) {
    doc.text(line, x, y)
    y += lineHeight
  }
  return y
}

/** Export tax invoice view model to A4 PDF (matches on-screen layout). */
export async function downloadTaxInvoicePdf(
  invoice: TaxInvoiceViewModel,
  fileName?: string,
): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4" })
  const margin = 14
  const pageWidth = doc.internal.pageSize.getWidth()
  const contentWidth = pageWidth - margin * 2
  let y = margin

  doc.setFont("helvetica", "bold")
  doc.setFontSize(16)
  doc.text("TAX INVOICE", pageWidth / 2, y, { align: "center" })
  y += 10

  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  doc.setFont("helvetica", "bold")
  doc.setFontSize(8)
  doc.text("INVOICE NUMBER", margin, y)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  doc.text(invoice.meta.invoiceNumber, margin, y + 4)
  y += 12

  doc.setDrawColor(0)
  doc.line(margin, y, pageWidth - margin, y)
  y += 6

  const colW = contentWidth / 2 - 4
  doc.setFont("helvetica", "bold")
  doc.text("Seller Information", margin, y)
  doc.text("Buyer Information", margin + colW + 8, y)
  y += 5
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)

  const sellerLines = [
    `Company: ${invoice.seller.companyName}`,
    `Address: ${invoice.seller.address}`,
    `Phone: ${invoice.seller.phone}`,
    `Email: ${invoice.seller.email}`,
  ]
  const buyerLines = [`Buyer Name: ${invoice.buyer.name}`]

  let yLeft = y
  for (const line of sellerLines) {
    yLeft = addWrappedText(doc, line, margin, yLeft, colW)
  }
  let yRight = y
  for (const line of buyerLines) {
    yRight = addWrappedText(doc, line, margin + colW + 8, yRight, colW)
  }
  yRight += 4
  doc.setFont("helvetica", "bold")
  doc.setFontSize(8)
  doc.text("INVOICE DATE", pageWidth - margin, yRight, { align: "right" })
  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  doc.text(invoice.meta.invoiceDate, pageWidth - margin, yRight + 4, { align: "right" })
  y = Math.max(yLeft, yRight + 10) + 6

  doc.setFont("helvetica", "bold")
  doc.setFontSize(10)
  doc.text("Items", margin, y)
  y += 5

  doc.setFontSize(8)
  const headers = ["Name", "Code", "Qty", "Tax", "Unit", "Total"]
  const colWidths = [42, 22, 12, 14, 28, 28]
  let x = margin
  doc.setFont("helvetica", "bold")
  for (let i = 0; i < headers.length; i++) {
    doc.text(headers[i], x + 1, y)
    x += colWidths[i]
  }
  y += 4
  doc.setFont("helvetica", "normal")

  for (const item of invoice.items) {
    if (y > 250) {
      doc.addPage()
      y = margin
    }
    x = margin
    const row = [
      item.name.slice(0, 28),
      item.code.slice(0, 14),
      String(item.qty),
      item.taxCode,
      formatTaxMoney(item.unitPrice, invoice.currency),
      formatTaxMoney(item.totalPrice, invoice.currency),
    ]
    for (let i = 0; i < row.length; i++) {
      const align = i >= 2 ? ("right" as const) : ("left" as const)
      doc.text(row[i], x + (align === "right" ? colWidths[i] - 1 : 1), y, { align })
      x += colWidths[i]
    }
    y += 4.5
  }

  y += 4
  doc.setFont("helvetica", "normal")
  const totalRows = [
    ["TOTAL", invoice.totals.total],
    ["TOTAL A-EX", invoice.totals.totalAEx],
    ["TOTAL B-14%", invoice.totals.totalB14],
    ["TOTAL TAX B", invoice.totals.totalTaxB],
    ["TOTAL C-0%", invoice.totals.totalC0],
    ["TOTAL TAX", invoice.totals.totalTax],
  ] as const
  for (const [label, value] of totalRows) {
    doc.text(label, pageWidth - margin - 60, y)
    doc.text(formatTaxMoney(value, invoice.currency), pageWidth - margin, y, { align: "right" })
    y += 4.5
  }

  if (invoice.sdc.showSdc) {
    y += 6
    if (y > 220) {
      doc.addPage()
      y = margin
    }
    doc.setFont("helvetica", "bold")
    doc.text("SDC Information", margin, y)
    y += 5
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    const sdcLines = [
      `TIME SDC: ${invoice.sdc.timeSdc}`,
      `SDC ID: ${invoice.sdc.sdcId}`,
      `RECEIPT NUMBER: ${invoice.sdc.receiptNumber}`,
      `Internal Data: ${invoice.sdc.internalData}`,
      `Receipt Signature: ${invoice.sdc.receiptSignature}`,
      `MRC: ${invoice.sdc.mrc}`,
    ]
    for (const line of sdcLines) {
      y = addWrappedText(doc, line, margin, y, contentWidth - 45)
    }

    if (invoice.sdc.showQr) {
      const svg = document.querySelector("#tax-invoice-qr svg")
      if (svg instanceof SVGElement) {
        const dataUrl = await svgElementToDataUrl(svg, 120)
        if (dataUrl) {
          doc.addImage(dataUrl, "PNG", pageWidth - margin - 32, y - 35, 32, 32)
        }
      }
    }
  }

  y = doc.internal.pageSize.getHeight() - 12
  doc.setFontSize(8)
  doc.setTextColor(100)
  doc.text(`Powered by ${invoice.appName}`, pageWidth / 2, y, { align: "center" })

  doc.save(fileName || `tax-invoice-${invoice.meta.invoiceNumber}.pdf`)
}

export function printTaxInvoice(): void {
  window.print()
}
