/** CIS / RRA-style invoice view model (from by-liv / delivery-note APIs). */

export type CisInvoiceItem = {
  name?: string
  code?: string
  itemCode?: string
  qty?: number
  unitPrice?: number
  amount?: number
  tax?: string
  lot?: string
  per?: string
  tva?: string
}

export type CisInvoiceData = {
  ok?: boolean
  livId?: string
  livid?: string
  orderId?: number
  sellerName?: string
  sellerTin?: string
  sellerAddress?: string
  sellerTel?: string
  sellerEmail?: string
  sellerFax?: string
  servedBy?: string | null
  documentState?: string
  orderStatus?: string
  paymentName?: string
  paymentStatus?: string
  invoiceTitle?: string
  invoiceNumber?: string
  invoiceDate?: string
  date?: string
  invoiceUrl?: string
  items?: CisInvoiceItem[]
  totals?: { subtotal?: number; total?: number; currency?: string }
  sdcId?: string | null
  timeSdc?: string | null
  sdcInternalData?: string | null
  receiptSignature?: string | null
  receiptNumber?: string | null
  mrc?: string
  timeMrc?: string
  itemsNumber?: number
  ishyigaVersion?: string
  cisBuyerName?: string
  buyerName?: string
  buyerTin?: string
  buyerLocation?: string
  conditionsFr?: string
  tableName?: string | null
  error?: string
}

export const RRA_LOGO_PATH = "/RRA_LOGO.png"
export const RRA_LOGO2_PATH = "/rraLogo2.png"

export function money(n: number | undefined | null, currency = "RWF") {
  if (n == null || Number.isNaN(Number(n))) return `0.00 ${currency}`
  return `${formatInvoiceNumber(n)} ${currency}`
}

export function formatInvoiceNumber(n: number | undefined | null) {
  if (n == null || Number.isNaN(Number(n))) return "0.00"
  return Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Normalize CIS tax codes like taxRtB → B */
export function taxLetter(raw?: string | null) {
  const s = String(raw || "").trim()
  if (!s) return ""
  const m = s.match(/([A-D])\s*$/i) || s.match(/taxRt([A-D])/i)
  if (m) return m[1].toUpperCase()
  if (/^[A-D]$/i.test(s)) return s.toUpperCase()
  return s
}

export function absolutePublicUrl(path: string, origin?: string) {
  if (path.startsWith("http://") || path.startsWith("https://")) return path
  const base = (origin || (typeof window !== "undefined" ? window.location.origin : "") || "https://ihute.rw").replace(
    /\/+$/,
    "",
  )
  return `${base}${path.startsWith("/") ? path : `/${path}`}`
}

async function loadImageDataUrl(path: string, origin?: string): Promise<string | null> {
  try {
    const url = absolutePublicUrl(path, origin)
    const res = await fetch(url, { cache: "force-cache" })
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ""))
      reader.onerror = () => reject(new Error("read failed"))
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

/** Build RRA-style invoice PDF (logos from /public). */
export async function downloadCisInvoicePdf(data: CisInvoiceData, origin?: string) {
  const { jsPDF } = await import("jspdf")
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 10
  let y = margin

  const [logo1, logo2] = await Promise.all([
    loadImageDataUrl(RRA_LOGO_PATH, origin),
    loadImageDataUrl(RRA_LOGO2_PATH, origin),
  ])

  const currency = data.totals?.currency || "RWF"
  const total = data.totals?.total ?? 0
  const livId = data.livId || data.livid || ""
  const invoiceLabel =
    data.invoiceTitle ||
    (data.invoiceNumber ? `INVOICE ${data.invoiceNumber}` : livId ? `INVOICE ${livId}` : `INVOICE #${data.orderId || ""}`)
  const items = data.items || []

  // Header left — seller
  doc.setFont("helvetica", "bold")
  doc.setFontSize(10)
  let yL = y
  if (data.sellerName) {
    doc.text(String(data.sellerName).toUpperCase(), margin, yL)
    yL += 4.5
  }
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  for (const line of [
    data.sellerAddress || "",
    data.sellerEmail ? `E-mail: ${data.sellerEmail}` : "",
    data.sellerTin ? `TIN: ${data.sellerTin}` : "",
    data.sellerTel ? `Phone: ${data.sellerTel}` : "",
  ].filter(Boolean)) {
    doc.text(line, margin, yL)
    yL += 3.8
  }

  // Right: date, logos
  doc.setFontSize(8)
  const dateLabel = data.invoiceDate || data.date || ""
  if (dateLabel) {
    doc.text(`Kigali, On ${dateLabel}`, pageW - margin, y, { align: "right" })
  }
  if (logo1) {
    try {
      doc.addImage(logo1, "PNG", pageW - margin - 58, y + 4, 28, 12)
    } catch {
      /* ignore */
    }
  }
  if (logo2) {
    try {
      doc.addImage(logo2, "PNG", pageW - margin - 28, y + 3, 14, 14)
    } catch {
      /* ignore */
    }
  }

  y = Math.max(yL, y + 22)

  // Buyer box
  const buyerName = data.cisBuyerName || data.buyerName || ""
  if (buyerName || data.buyerTin || data.buyerLocation) {
    const boxW = 72
    const boxX = pageW - margin - boxW
    doc.setDrawColor(0)
    doc.rect(boxX, y, boxW, 18)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(8)
    let by = y + 5
    if (buyerName) {
      doc.text(String(buyerName).toUpperCase(), boxX + 2, by)
      by += 4
    }
    doc.setFont("helvetica", "normal")
    if (data.buyerLocation) {
      doc.text(String(data.buyerLocation), boxX + 2, by)
      by += 4
    }
    if (data.buyerTin) {
      doc.text(`TIN: ${data.buyerTin}`, boxX + 2, by)
    }
    y += 22
  }

  doc.setFont("helvetica", "bold")
  doc.setFontSize(16)
  doc.text(invoiceLabel, margin, y)
  y += 6
  doc.setDrawColor(0)
  doc.setLineWidth(0.3)
  doc.line(margin, y, pageW - margin, y)
  y += 4
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.text(
    [
      data.paymentName ? `REFERENCE : ${data.paymentName}` : null,
      `: ${formatInvoiceNumber(total)}`,
      data.servedBy ? `SERVED BY ${data.servedBy}` : null,
    ]
      .filter(Boolean)
      .join(" "),
    margin,
    y,
  )
  y += 6

  // Items table — tall body (~A4 mid section); vertical lines through empty space
  const cols = [
    { h: "CODE", w: 16 },
    { h: "DESIGNATION", w: 52 },
    { h: "QTE", w: 12 },
    { h: "LOT.", w: 14 },
    { h: "PER.", w: 14 },
    { h: "TVA", w: 12 },
    { h: "TAX", w: 10 },
    { h: "SALE P.", w: 22 },
    { h: "TOTAL", w: 22 },
  ]
  const tableW = cols.reduce((s, c) => s + c.w, 0)
  const tableX = margin
  const rowH = 5.2
  const headH = 6
  // Fixed tall body so few lines still look like the paper form (~170mm usable mid-page)
  const bodyH = 145

  // header
  doc.setFont("helvetica", "bold")
  doc.setFontSize(7)
  doc.rect(tableX, y, tableW, headH)
  let x = tableX
  for (let i = 0; i < cols.length; i++) {
    if (i > 0) doc.line(x, y, x, y + headH)
    doc.text(cols[i].h, x + 1, y + 4)
    x += cols[i].w
  }
  doc.setLineWidth(0.6)
  doc.line(tableX, y + headH, tableX + tableW, y + headH)
  doc.setLineWidth(0.2)
  y += headH

  doc.setFont("helvetica", "normal")
  doc.setFontSize(7.5)
  const bodyTop = y
  doc.rect(tableX, bodyTop, tableW, bodyH)
  x = tableX
  for (let i = 0; i < cols.length; i++) {
    if (i > 0) doc.line(x, bodyTop, x, bodyTop + bodyH)
    x += cols[i].w
  }

  for (let r = 0; r < items.length; r++) {
    const it = items[r]
    const qty = it.qty ?? 0
    const unit = Number(it.unitPrice || 0)
    const amt = Number(it.amount ?? qty * unit)
    const cells = [
      String(it.itemCode || it.code || ""),
      String(it.name || "").slice(0, 42),
      String(qty),
      String(it.lot || ""),
      String(it.per || ""),
      String(it.tva || ""),
      taxLetter(it.tax),
      formatInvoiceNumber(unit),
      formatInvoiceNumber(amt),
    ]
    x = tableX
    const ty = bodyTop + r * rowH + 3.8
    if (ty > bodyTop + bodyH - 2) break
    for (let i = 0; i < cols.length; i++) {
      const alignRight = i >= 7
      const alignCenter = i >= 2 && i <= 6
      if (alignRight) {
        doc.text(cells[i], x + cols[i].w - 1, ty, { align: "right" })
      } else if (alignCenter) {
        doc.text(cells[i], x + cols[i].w / 2, ty, { align: "center" })
      } else {
        doc.text(cells[i], x + 1, ty)
      }
      x += cols[i].w
    }
  }
  y = bodyTop + bodyH

  // Totals boxes
  const boxW = tableW / 6
  const boxH = 12
  doc.rect(tableX, y, tableW, boxH)
  const boxes: [string, string][] = [
    ["TOTAL A-EX RWF", "0.00"],
    ["TOTAL B-18.00% RWF", "0.00"],
    ["TOTAL C-0% RWF", "0.00"],
    ["TOTAL TAX B RWF", "0.00"],
    ["TOTAL TAX RWF", "0.00"],
    [`TOTAL ${currency}`, formatInvoiceNumber(total)],
  ]
  doc.setFontSize(5.5)
  for (let i = 0; i < 6; i++) {
    const bx = tableX + i * boxW
    if (i > 0) doc.line(bx, y, bx, y + boxH)
    doc.setFont("helvetica", "bold")
    doc.text(boxes[i][0], bx + boxW / 2, y + 4, { align: "center", maxWidth: boxW - 2 })
    doc.setFont(i === 5 ? "helvetica" : "helvetica", i === 5 ? "bold" : "normal")
    doc.setFontSize(7)
    doc.text(boxes[i][1], bx + boxW / 2, y + 9.5, { align: "center" })
    doc.setFontSize(5.5)
  }
  y += boxH + 8

  // SDC / MRC
  const colW = (pageW - margin * 2) / 3
  doc.setFont("helvetica", "bold")
  doc.setFontSize(8)
  doc.text("SDC INFORMATION", margin + colW, y)
  doc.text("MRC INFORMATION", margin + colW * 2, y)
  y += 4
  doc.setFont("helvetica", "normal")
  doc.setFontSize(6.5)
  const leftLines = ["BK :", "BK :", "BK :", "CODE MoMo:"]
  const sdcLines = [
    `TIME SDC : ${data.timeSdc || ""}`,
    `SDC ID: ${data.sdcId || ""}`,
    `Internal Data: ${data.sdcInternalData || ""}`,
    `Receipt Signature: ${data.receiptSignature || ""}`,
    `RECEIPT NUMBER: ${data.receiptNumber || ""}`,
  ]
  const mrcLines = [
    `ITEMS NUMBER: ${data.itemsNumber ?? items.length}`,
    `TIME MRC: ${data.timeMrc || data.timeSdc || ""}`,
    `MRC: ${data.mrc || ""}`,
    `INVOICE NUMBER: ${data.invoiceNumber || ""}`,
    data.ishyigaVersion || "",
  ].filter((line) => line.length > 0)

  let yS = y
  for (const line of leftLines) {
    doc.text(line, margin, yS)
    yS += 3.5
  }
  yS = y
  for (const line of sdcLines) {
    doc.text(line, margin + colW, yS, { maxWidth: colW - 2 })
    yS += 3.5
  }
  yS = y
  for (const line of mrcLines) {
    doc.text(line, margin + colW * 2, yS, { maxWidth: colW - 2 })
    yS += 3.5
  }
  y = Math.max(y + leftLines.length * 3.5, y + sdcLines.length * 3.5, y + mrcLines.length * 3.5) + 6

  doc.setFont("helvetica", "italic")
  doc.setFontSize(6)
  const disclaimer =
    data.conditionsFr ||
    "*Kindly verify the expiry dates, quantities, items and prices on delivery notes before payment and order confirmation. Returns and complaints will not be acceptable once invoices have been made."
  doc.text(disclaimer, margin, y, { maxWidth: pageW - margin * 2 - 30 })

  const file = `invoice-${livId || data.orderId || "copy"}.pdf`
  doc.save(file)
}
