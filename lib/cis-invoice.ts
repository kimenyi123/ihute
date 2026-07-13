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

/** RRA footer tax boxes — values from CIS `taxTotals` on sync. */
export type CisTaxTotals = {
  aEx?: number
  b18?: number
  c0?: number
  taxB?: number
  tax?: number
  total?: number
  currency?: string
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
  sellerOwner?: string
  servedBy?: string | null
  documentState?: string
  orderStatus?: string
  paymentName?: string
  paymentStatus?: string
  invoiceTitle?: string
  invoiceNumber?: string
  invoiceDate?: string
  date?: string
  invoicedAt?: string | null
  invoiceUrl?: string
  items?: CisInvoiceItem[]
  totals?: { subtotal?: number; total?: number; currency?: string }
  taxTotals?: CisTaxTotals
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

/** Fiscal timestamp from CIS only — do not use order CREATED_AT. */
export function cisInvoiceDateLabel(data: CisInvoiceData): string {
  return String(data.invoiceDate || data.timeSdc || data.timeMrc || data.invoicedAt || "").trim()
}

/** Shop / company title for invoice header. */
export function cisSellerDisplayName(data: CisInvoiceData): string {
  const name = String(data.sellerName || "").trim()
  const owner = String(data.sellerOwner || "").trim()
  const parts = name.split(/\s+/).filter(Boolean)
  const weak = !name || (parts.length === 2 && parts[0].toLowerCase() === parts[1].toLowerCase())
  if (weak && owner) return owner
  return name || owner
}

/** REFERENCE : CASH : 17,500.00 SERVED BY … — omit empty pieces (no leading lone colon). */
export function cisReferenceLine(data: CisInvoiceData): string {
  const total = data.totals?.total ?? data.taxTotals?.total ?? 0
  const amount = formatInvoiceNumber(total)
  const payment = String(data.paymentName || "").trim()
  const served = String(data.servedBy || "").trim()
  const chunks: string[] = []
  if (payment) {
    chunks.push(`REFERENCE : ${payment} : ${amount}`)
  } else {
    chunks.push(amount)
  }
  if (served) chunks.push(`SERVED BY ${served}`)
  return chunks.join(" ")
}

/** Six RRA total boxes under the items table — amounts from CIS. */
export function cisTaxTotalBoxes(data: CisInvoiceData): [string, string][] {
  const t = data.taxTotals || {}
  const cur = String(t.currency || data.totals?.currency || "RWF").trim() || "RWF"
  const totalSuffix = cur.toUpperCase() === "RWF" ? "RW" : cur
  const fmt = (n: number | undefined) => formatInvoiceNumber(n ?? 0)
  const grand = t.total ?? data.totals?.total ?? 0
  return [
    [`TOTAL A-EX ${cur}`, fmt(t.aEx)],
    [`TOTAL B-18.00% ${cur}`, fmt(t.b18)],
    [`TOTAL C-0% ${cur}`, fmt(t.c0)],
    [`TOTAL TAX B ${cur}`, fmt(t.taxB)],
    [`TOTAL TAX ${cur}`, fmt(t.tax)],
    [`TOTAL ${totalSuffix}`, fmt(grand)],
  ]
}

/** Reject empty / placeholder CIS values (e.g. blank, `NS/`, `N/A`). */
function isMeaningfulCisValue(raw?: string | null): boolean {
  const s = String(raw ?? "").trim()
  if (!s) return false
  const norm = s.toUpperCase().replace(/\s+/g, "")
  if (
    norm === "N/A" ||
    norm === "NA" ||
    norm === "NULL" ||
    norm === "UNDEFINED" ||
    norm === "-" ||
    norm === "--" ||
    norm === "/" ||
    norm === "NS" ||
    norm === "NS/"
  ) {
    return false
  }
  // Bare receipt stubs like "NS/" or "/"
  if (/^NS\/?$/i.test(s) || /^\/+$/.test(s)) return false
  return true
}

/**
 * True only when CIS sent real SDC payload.
 * RRA logos + SDC INFORMATION block are shown only then — not for empty labels or `NS/`.
 */
export function hasCisSdcInfo(data: CisInvoiceData): boolean {
  return (
    isMeaningfulCisValue(data.sdcId) ||
    isMeaningfulCisValue(data.timeSdc) ||
    isMeaningfulCisValue(data.sdcInternalData) ||
    isMeaningfulCisValue(data.receiptSignature) ||
    isMeaningfulCisValue(data.receiptNumber)
  )
}

export function hasCisMrcInfo(data: CisInvoiceData): boolean {
  // Real MRC block only — do not treat invoiceNumber / items count alone as MRC
  return Boolean(
    String(data.mrc || "").trim() ||
      String(data.timeMrc || "").trim() ||
      String(data.ishyigaVersion || "").trim(),
  )
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
  // Node (API routes): read from /public
  if (typeof window === "undefined") {
    try {
      const { readFile } = await import("fs/promises")
      const { join } = await import("path")
      const file = join(process.cwd(), "public", path.replace(/^\//, ""))
      const buf = await readFile(file)
      return `data:image/png;base64,${buf.toString("base64")}`
    } catch {
      /* fall through to fetch */
    }
  }
  try {
    const url = absolutePublicUrl(path, origin)
    const res = await fetch(url, { cache: "force-cache" })
    if (!res.ok) return null
    const blob = await res.blob()
    return await blobToDataUrl(blob)
  } catch {
    return null
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ""))
    reader.onerror = () => reject(new Error("read failed"))
    reader.readAsDataURL(blob)
  })
}

/** Convert an on-page QR SVG (react-qr-code) into a PNG data URL for jsPDF. */
export async function svgElementToPngDataUrl(svg: SVGElement, size = 256): Promise<string | null> {
  try {
    const clone = svg.cloneNode(true) as SVGElement
    if (!clone.getAttribute("xmlns")) {
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg")
    }
    clone.setAttribute("width", String(size))
    clone.setAttribute("height", String(size))
    const xml = new XMLSerializer().serializeToString(clone)
    const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`
    const img = await loadHtmlImage(svgUrl)
    const canvas = document.createElement("canvas")
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext("2d")
    if (!ctx) return null
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, size, size)
    ctx.drawImage(img, 0, 0, size, size)
    return canvas.toDataURL("image/png")
  } catch {
    return null
  }
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("image load failed"))
    img.src = src
  })
}

async function qrCodeDataUrl(text: string): Promise<string | null> {
  if (!text) return null
  // 1) Preferred: qrcode package (browser)
  try {
    const mod = (await import("qrcode")) as unknown as {
      toDataURL?: (t: string, o?: object) => Promise<string>
      default?: { toDataURL?: (t: string, o?: object) => Promise<string> }
    }
    const toDataURL = mod.toDataURL || mod.default?.toDataURL
    if (typeof toDataURL === "function") {
      return await toDataURL(text, {
        width: 256,
        margin: 1,
        errorCorrectionLevel: "M",
        color: { dark: "#000000", light: "#ffffff" },
      })
    }
  } catch {
    /* fall through */
  }
  // 2) Fallback: public QR image API (browser download only)
  try {
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&margin=8&data=${encodeURIComponent(text)}`
    const res = await fetch(url)
    if (!res.ok) return null
    return await blobToDataUrl(await res.blob())
  } catch {
    return null
  }
}

/** Build RRA-style invoice PDF (same layout as `/invoice/[livId]`). */
export async function createCisInvoicePdf(
  data: CisInvoiceData,
  origin?: string,
  qrDataUrlOverride?: string | null,
) {
  const { jsPDF } = await import("jspdf")
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 10
  let y = margin

  const shareUrl =
    data.invoiceUrl ||
    absolutePublicUrl(
      `/invoice/${encodeURIComponent(data.livId || data.livid || String(data.orderId || ""))}`,
      origin,
    )

  const showLogos = hasCisSdcInfo(data)
  // Always print SDC INFORMATION labels (empty / NS/ is fine) — logos only when real SDC exists
  const showSdc = true
  const showMrc = hasCisMrcInfo(data)

  const [logo1, logo2, qrGenerated] = await Promise.all([
    showLogos ? loadImageDataUrl(RRA_LOGO_PATH, origin) : Promise.resolve(null),
    showLogos ? loadImageDataUrl(RRA_LOGO2_PATH, origin) : Promise.resolve(null),
    qrDataUrlOverride ? Promise.resolve(null) : qrCodeDataUrl(shareUrl),
  ])
  const qrImg = qrDataUrlOverride || qrGenerated

  const total = data.totals?.total ?? data.taxTotals?.total ?? 0
  const livId = data.livId || data.livid || ""
  const invoiceLabel =
    data.invoiceTitle ||
    (data.invoiceNumber
      ? `INVOICE ${data.invoiceNumber}`
      : livId
        ? `INVOICE ${livId}`
        : `INVOICE #${data.orderId || ""}`)
  const items = data.items || []
  const sellerTitle = cisSellerDisplayName(data)

  doc.setFont("helvetica", "bold")
  doc.setFontSize(10)
  let yL = y
  if (sellerTitle) {
    doc.text(String(sellerTitle).toUpperCase(), margin, yL)
    yL += 4.5
  }
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  for (const line of [
    data.sellerAddress || "",
    data.sellerEmail || "",
    data.sellerTin || "",
    data.sellerTel || "",
  ].filter(Boolean)) {
    doc.text(line, margin, yL)
    yL += 3.8
  }

  doc.setFontSize(8)
  const dateLabel = cisInvoiceDateLabel(data)
  if (dateLabel) {
    doc.text(dateLabel, pageW - margin, y, { align: "right" })
  }
  const qrSize = 20
  const qrX = pageW - margin - qrSize
  let headerRightBottom = y + 4
  if (showLogos && (logo1 || logo2)) {
    const logo2Size = 14
    const logo2X = qrX - 5 - logo2Size
    const logo1W = 28
    const logo1X = logo2X - 4 - logo1W
    if (logo1) {
      try {
        doc.addImage(logo1, "PNG", logo1X, y + 4, logo1W, 12)
      } catch {
        /* ignore */
      }
    }
    if (logo2) {
      try {
        doc.addImage(logo2, "PNG", logo2X, y + 3, logo2Size, logo2Size)
      } catch {
        /* ignore */
      }
    }
    headerRightBottom = y + 18
  }
  if (qrImg) {
    try {
      const fmt = qrImg.includes("image/jpeg") ? "JPEG" : "PNG"
      doc.setDrawColor(0)
      doc.setFillColor(255, 255, 255)
      doc.rect(qrX - 0.5, y + 2.5, qrSize + 1, qrSize + 1, "FD")
      doc.addImage(qrImg, fmt, qrX, y + 3, qrSize, qrSize)
      headerRightBottom = Math.max(headerRightBottom, y + qrSize + 5)
    } catch (e) {
      console.warn("[cis-invoice] addImage QR failed", e)
    }
  }

  y = Math.max(yL, headerRightBottom)

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
      doc.text(String(data.buyerTin), boxX + 2, by)
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
  doc.text(cisReferenceLine(data), margin, y)
  y += 6

  const cols = [
    { h: "CODE", w: 24 },
    { h: "DESIGNATION", w: 44 },
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
  const bodyH = 145

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
  doc.setFontSize(7)
  const bodyTop = y
  doc.rect(tableX, bodyTop, tableW, bodyH)
  x = tableX
  for (let i = 0; i < cols.length; i++) {
    if (i > 0) doc.line(x, bodyTop, x, bodyTop + bodyH)
    x += cols[i].w
  }

  let rowY = bodyTop + 1.5
  for (let r = 0; r < items.length; r++) {
    const it = items[r]
    const qty = it.qty ?? 0
    const unit = Number(it.unitPrice || 0)
    const amt = Number(it.amount ?? qty * unit)
    const code = String(it.itemCode || it.code || "")
    const name = String(it.name || "")
    const codeLines = doc.splitTextToSize(code, cols[0].w - 2) as string[]
    const nameLines = doc.splitTextToSize(name, cols[1].w - 2) as string[]
    const lineCount = Math.max(codeLines.length, nameLines.length, 1)
    const thisRowH = Math.max(rowH, lineCount * 3.4 + 1.2)
    if (rowY + thisRowH > bodyTop + bodyH - 1) break

    const cells: Array<string | string[]> = [
      codeLines,
      nameLines,
      String(qty),
      String(it.lot || ""),
      String(it.per || ""),
      String(it.tva || ""),
      taxLetter(it.tax),
      formatInvoiceNumber(unit),
      formatInvoiceNumber(amt),
    ]
    x = tableX
    for (let i = 0; i < cols.length; i++) {
      const cell = cells[i]
      const alignRight = i >= 7
      const alignCenter = i >= 2 && i <= 6
      if (Array.isArray(cell)) {
        let ly = rowY + 3.2
        for (const line of cell) {
          doc.text(line, x + 1, ly)
          ly += 3.4
        }
      } else if (alignRight) {
        doc.text(cell, x + cols[i].w - 1, rowY + 3.8, { align: "right" })
      } else if (alignCenter) {
        doc.text(cell, x + cols[i].w / 2, rowY + 3.8, { align: "center" })
      } else {
        doc.text(cell, x + 1, rowY + 3.8)
      }
      x += cols[i].w
    }
    rowY += thisRowH
  }
  y = bodyTop + bodyH

  const boxW = tableW / 6
  const boxH = 12
  doc.rect(tableX, y, tableW, boxH)
  const boxes = cisTaxTotalBoxes(data)
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

  if (showSdc || showMrc) {
    const colW = (pageW - margin * 2) / 3
    doc.setFont("helvetica", "bold")
    doc.setFontSize(8)
    if (showSdc) doc.text("SDC INFORMATION", margin + colW, y)
    if (showMrc) doc.text("MRC INFORMATION", margin + colW * 2, y)
    y += 4
    doc.setFont("helvetica", "normal")
    doc.setFontSize(6.5)
    const leftLines = ["BK :", "BK :", "BK :", "CODE MoMo:"]
    const sdcLines = showSdc
      ? [
          `TIME SDC : ${data.timeSdc || ""}`,
          `SDC ID: ${data.sdcId || ""}`,
          `Internal Data: ${data.sdcInternalData || ""}`,
          `Receipt Signature: ${data.receiptSignature || ""}`,
          `RECEIPT NUMBER: ${data.receiptNumber || ""}`,
        ]
      : []
    const mrcLines = showMrc
      ? [
          `ITEMS NUMBER: ${data.itemsNumber ?? items.length}`,
          `TIME MRC: ${data.timeMrc || data.timeSdc || ""}`,
          `MRC: ${data.mrc || ""}`,
          `INVOICE NUMBER: ${data.invoiceNumber || ""}`,
          data.ishyigaVersion || "",
        ].filter((line) => line.length > 0)
      : []

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
    y =
      Math.max(y + leftLines.length * 3.5, y + sdcLines.length * 3.5, y + mrcLines.length * 3.5) + 6
  }

  doc.setFont("helvetica", "italic")
  doc.setFontSize(6)
  const disclaimer =
    data.conditionsFr ||
    "*Kindly verify the expiry dates, quantities, items and prices on delivery notes before payment and order confirmation. Returns and complaints will not be acceptable once invoices have been made."
  doc.text(disclaimer, margin, y, { maxWidth: pageW - margin * 2 })

  return doc
}

/** Browser download — same PDF as `/api/orders/invoice-pdf`. */
export async function downloadCisInvoicePdf(
  data: CisInvoiceData,
  origin?: string,
  qrDataUrlOverride?: string | null,
) {
  const doc = await createCisInvoicePdf(data, origin, qrDataUrlOverride)
  const livId = data.livId || data.livid || ""
  doc.save(`invoice-${livId || data.orderId || "copy"}.pdf`)
}

/** Server/API bytes — same layout as guest invoice page download. */
export async function buildCisInvoicePdfBytes(
  data: CisInvoiceData,
  origin?: string,
  qrDataUrlOverride?: string | null,
): Promise<Uint8Array> {
  const doc = await createCisInvoicePdf(data, origin, qrDataUrlOverride)
  return new Uint8Array(doc.output("arraybuffer"))
}
