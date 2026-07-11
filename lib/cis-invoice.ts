/** CIS / RRA-style invoice view model (from by-liv / delivery-note APIs). */

export type CisInvoiceItem = {
  name?: string
  code?: string
  itemCode?: string
  qty?: number
  unitPrice?: number
  amount?: number
  tax?: string
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
  return `${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`
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
  const margin = 12
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

  // Header left — seller contact
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  const sellerLines = [
    data.sellerAddress || "",
    data.sellerTel ? `Tel : ${data.sellerTel}` : "",
    data.sellerFax ? `fax: ${data.sellerFax}` : data.sellerFax === "" ? "fax:" : "",
    data.sellerEmail ? `E-mail : ${data.sellerEmail}` : "",
    data.sellerTin ? `TIN : ${data.sellerTin}` : "",
  ].filter((line) => line.length > 0)
  for (const line of sellerLines) {
    doc.text(line, margin, y)
    y += 4
  }

  // Logos top-right
  if (logo1) {
    try {
      doc.addImage(logo1, "PNG", pageW - margin - 55, margin, 32, 14)
    } catch {
      /* ignore */
    }
  }
  if (logo2) {
    try {
      doc.addImage(logo2, "PNG", pageW - margin - 20, margin, 16, 16)
    } catch {
      /* ignore */
    }
  }

  y = Math.max(y, margin + 20)
  doc.setFontSize(9)
  doc.text(`Kigali, le ${data.invoiceDate || data.date || ""}`, pageW - margin, y, { align: "right" })
  y += 6

  // Buyer box
  const buyerName = data.cisBuyerName || data.buyerName || ""
  if (buyerName || data.buyerTin || data.buyerLocation) {
    doc.setDrawColor(0)
    doc.rect(pageW - margin - 70, y, 70, 22)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(9)
    let by = y + 5
    if (buyerName) {
      doc.text(buyerName, pageW - margin - 68, by)
      by += 5
    }
    doc.setFont("helvetica", "normal")
    if (data.buyerLocation) {
      doc.text(String(data.buyerLocation), pageW - margin - 68, by)
      by += 5
    }
    if (data.buyerTin) {
      doc.text(`TIN : ${data.buyerTin}`, pageW - margin - 68, by)
    }
    y += 26
  }

  doc.setFont("helvetica", "bold")
  doc.setFontSize(14)
  doc.text(invoiceLabel, margin, y)
  y += 6
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  const refBits = [
    data.paymentName ? `REFERENCE : ${data.paymentName}` : null,
    total ? `: ${money(total, currency)}` : null,
    data.servedBy ? `SERVED BY ${data.servedBy}` : null,
  ].filter(Boolean)
  doc.text(refBits.join(" "), margin, y)
  y += 8

  // Items table
  const cols = [
    { h: "CODE", w: 22 },
    { h: "DESIGNATION", w: 55 },
    { h: "QTE", w: 14 },
    { h: "P.U. TTC", w: 28 },
    { h: "TAX", w: 12 },
    { h: "TOTAL", w: 28 },
  ]
  const tableW = cols.reduce((s, c) => s + c.w, 0)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(7)
  doc.setFillColor(240, 240, 240)
  doc.rect(margin, y, tableW, 6, "FD")
  let x = margin
  for (const c of cols) {
    doc.text(c.h, x + 1, y + 4)
    x += c.w
  }
  y += 6
  doc.setFont("helvetica", "normal")
  const items = data.items || []
  for (const it of items) {
    if (y > 200) {
      doc.addPage()
      y = margin
    }
    x = margin
    const row = [
      String(it.itemCode || it.code || ""),
      String(it.name || ""),
      String(it.qty ?? ""),
      money(it.unitPrice, "").replace(` ${currency}`, "").trim() || String(it.unitPrice ?? ""),
      String(it.tax || "B"),
      money(it.amount ?? (it.qty || 0) * (it.unitPrice || 0), "").replace(` ${currency}`, "").trim(),
    ]
    doc.rect(margin, y, tableW, 6)
    for (let i = 0; i < cols.length; i++) {
      doc.text(row[i].slice(0, 40), x + 1, y + 4)
      x += cols[i].w
    }
    y += 6
  }
  // empty rows for look
  for (let i = items.length; i < Math.max(8, items.length); i++) {
    if (y > 200) break
    doc.rect(margin, y, tableW, 5)
    y += 5
  }

  y += 4
  doc.setFont("helvetica", "bold")
  doc.setFontSize(8)
  doc.text(`TOTAL RWF: ${money(total, currency)}`, pageW - margin, y, { align: "right" })
  y += 10

  // SDC / MRC block (most important)
  const colW = (pageW - margin * 2) / 3
  doc.setFont("helvetica", "bold")
  doc.setFontSize(8)
  doc.text("SDC INFORMATION", margin + colW, y)
  doc.text("MRC INFORMATION", margin + colW * 2, y)
  y += 5
  doc.setFont("helvetica", "normal")
  doc.setFontSize(7)
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
  const leftLines = ["BK :", "BK :", "BK :", "CODE MoMo:"]
  let yS = y
  for (const line of leftLines) {
    doc.text(line, margin, yS)
    yS += 4
  }
  yS = y
  for (const line of sdcLines) {
    doc.text(line, margin + colW, yS, { maxWidth: colW - 2 })
    yS += 4
  }
  yS = y
  for (const line of mrcLines) {
    doc.text(line, margin + colW * 2, yS, { maxWidth: colW - 2 })
    yS += 4
  }
  y = Math.max(y + leftLines.length * 4, y + sdcLines.length * 4, y + mrcLines.length * 4) + 6

  // Conditions from CIS only (no hardcoded location/company text)
  if (data.conditionsFr) {
    doc.setDrawColor(0)
    doc.rect(margin, y, pageW - margin * 2, 28)
    doc.setFontSize(6.5)
    doc.text(data.conditionsFr, margin + 2, y + 4, { maxWidth: pageW - margin * 2 - 28 })
  }

  const file = `invoice-${livId || data.orderId || "copy"}.pdf`
  doc.save(file)
}
