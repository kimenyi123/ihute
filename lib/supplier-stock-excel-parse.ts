// xlsx@0.18 ships broken .d.ts — cast to `any` for build.
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports
const XLSX: any = require("xlsx")
import { roundRwfPrice } from "@/lib/parse-rwf-price"

export type ParsedStockRow = {
  itemName: string
  itemCode: string
  quantity: number
  price: number
  cost: number
  category: string
  subcategory: string
  french: string
  kinyarwanda: string
  imageUrl: string
  keywords: string
}

export type ParseStockExcelResult = {
  rows: ParsedStockRow[]
  rowsParsed: number
  rowsSkipped: number
  rowsSkippedNote?: string
  errors: string[]
}

function normHeader(h: string): string {
  return String(h ?? "")
    .replace(/^\uFEFF/, "")
    .trim()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .replace(/[()]/g, "")
}

function parseNum(raw: unknown): number {
  return roundRwfPrice(raw)
}

function stableProductCodeFromName(name: string): string {
  const norm = name.trim().toLowerCase().normalize("NFC")
  if (!norm) return "ITEM-00000000"
  let h = 0
  for (let i = 0; i < norm.length; i++) {
    h = (Math.imul(31, h) + norm.charCodeAt(i)) | 0
  }
  const uh = (h >>> 0).toString(16).toUpperCase().padStart(8, "0")
  const slug = norm.replace(/[^a-z0-9]/g, "").slice(0, 12).toUpperCase() || "ITEM"
  return `${slug}-${uh}`
}

/** Column keys + optional flag when QTE column is missing (default quantity 1 per row). */
type ColumnMap = Record<string, string> & { __defaultQte?: true }

function rowToParsed(
  cells: Record<string, unknown>,
  col: ColumnMap,
  rowIndex: number,
): ParsedStockRow | null {
  const itemName = String(cells[col.item] ?? "").trim()
  const price = parseNum(cells[col.price])
  const qte = col.__defaultQte ? 1 : parseNum(cells[col.qte])
  if (!itemName) return null
  if (qte < 0 || price < 1) return null

  const keywords = col.keywords ? String(cells[col.keywords] ?? "").trim() : ""
  const codeCol = col.code ? String(cells[col.code] ?? "").trim() : ""
  const itemCode = (codeCol || stableProductCodeFromName(itemName)).slice(0, 64)

  return {
    itemName,
    itemCode,
    quantity: Math.max(0, Math.round(qte)),
    price: Math.round(price),
    cost: col.cost ? Math.max(0, Math.round(parseNum(cells[col.cost]))) : 0,
    category: col.category ? String(cells[col.category] ?? "").trim() : "",
    subcategory: col.subcategory ? String(cells[col.subcategory] ?? "").trim() : "",
    french: col.french ? String(cells[col.french] ?? "").trim() : "",
    kinyarwanda: col.kinyarwanda ? String(cells[col.kinyarwanda] ?? "").trim() : "",
    imageUrl: col.image ? String(cells[col.image] ?? "").trim() : "",
    keywords,
  }
}

function detectColumns(headers: string[]): ColumnMap | null {
  const map: ColumnMap = {}
  for (const h of headers) {
    const n = normHeader(h)
    if (!n) continue

    const isItem =
      n === "ITEM" ||
      n === "NAME" ||
      n === "PRODUCT" ||
      n === "ITEM NAME" ||
      n === "MENU ITEM" ||
      n === "DISH" ||
      n === "PLAT" ||
      n === "ARTICLE" ||
      n === "LIBELLE" ||
      n === "DESIGNATION" ||
      n === "DESCRIPTION" ||
      n === "FOOD" ||
      n === "SERVICE" ||
      (n.includes("ITEM") && !n.includes("SUB") && !n.includes("CODE")) ||
      (n.includes("PRODUCT") && !n.includes("CODE"))

    const isQte =
      n === "QTE" ||
      n === "QTY" ||
      n === "QUANTITY" ||
      n === "QUANTITE" ||
      n === "STOCK" ||
      n.startsWith("QTY") ||
      n.includes("QUANTITY") ||
      n.includes("QUANTITE") ||
      n === "PORTION"

    const isPrice =
      n === "PRICE RWF" ||
      n === "PRICE" ||
      n === "SALES" ||
      n === "SELLING PRICE" ||
      n === "UNIT PRICE" ||
      n === "AMOUNT" ||
      n === "AMOUNT RWF" ||
      n === "PRIX" ||
      n === "PRIX RWF" ||
      n === "PRIX UNITAIRE" ||
      n === "TARIF" ||
      n === "MONTANT" ||
      n === "PU" ||
      n === "P U" ||
      (n.includes("PRICE") && !n.includes("COST")) ||
      (n.includes("PRIX") && !n.includes("COUT") && !n.includes("COST")) ||
      (n.includes("SELLING") && !n.includes("COST"))

    const isCost =
      n === "COST PRICE" ||
      n === "COST" ||
      n === "COUT" ||
      n === "PRIX COUT" ||
      (n.includes("COST") && n.includes("PRICE"))

    if (isItem) map.item = h
    else if (isQte) map.qte = h
    else if (isPrice) map.price = h
    else if (isCost) map.cost = h
    else if (n === "KEYWORDS" || n === "CODE" || n === "ITEM CODE" || n === "SKU") {
      if (!map.code) map.code = h
      if (n.includes("KEYWORD") || n === "CODE" || n === "SKU") map.keywords = h
    } else if (n === "CATEGORY") map.category = h
    else if (n === "SUBCATEGORY" || n === "SUB CATEGORY") map.subcategory = h
    else if (n === "FRENCH") map.french = h
    else if (n === "KINYARWANDA" || n === "KIN") map.kinyarwanda = h
    else if (n === "IMAGE LINK" || n === "IMAGE" || n === "IMAGE URL") map.image = h
  }

  if (!map.item || !map.price) return null
  if (!map.qte) {
    map.__defaultQte = true
    map.qte = map.item
  }
  return map
}

/**
 * Parse supplier stock template (.xlsx, .xls, .csv) into rows ready for addProduct / Redis stock.
 */
const MAX_HEADER_SCAN_ROWS = 600

function parseOneSheet(
  matrix: (string | number | null)[][],
  sheetLabel: string,
): ParseStockExcelResult {
  const errors: string[] = []
  let headerRowIdx = -1
  let col: ColumnMap | null = null
  for (let i = 0; i < Math.min(matrix.length, MAX_HEADER_SCAN_ROWS); i++) {
    const headers = (matrix[i] ?? []).map((c) => String(c ?? ""))
    const detected = detectColumns(headers)
    if (detected) {
      headerRowIdx = i
      col = detected
      break
    }
  }

  if (!col || headerRowIdx < 0) {
    return {
      rows: [],
      rowsParsed: 0,
      rowsSkipped: 0,
      errors: [
        `Sheet "${sheetLabel}": could not find a header row with dish name + price (and optional QTE). Scanned first ${Math.min(matrix.length, MAX_HEADER_SCAN_ROWS)} rows.`,
      ],
    }
  }

  const headers = (matrix[headerRowIdx] ?? []).map((c) => String(c ?? ""))
  const rows: ParsedStockRow[] = []
  let skipped = 0

  for (let r = headerRowIdx + 1; r < matrix.length; r++) {
    const line = matrix[r] ?? []
    if (!line.some((c) => String(c ?? "").trim())) {
      skipped++
      continue
    }
    const cells: Record<string, unknown> = {}
    headers.forEach((h, i) => {
      if (h) cells[h] = line[i] ?? ""
    })
    const parsed = rowToParsed(cells, col, r)
    if (!parsed) {
      skipped++
      continue
    }
    rows.push(parsed)
  }

  if (rows.length === 0 && matrix.length > headerRowIdx + 1) {
    errors.push(
      `Sheet "${sheetLabel}": no valid rows (need item name, quantity ≥ 0, price ≥ 1 RWF).`,
    )
  }

  return {
    rows,
    rowsParsed: rows.length,
    rowsSkipped: skipped,
    rowsSkippedNote:
      skipped > 0
        ? "Skipped blank lines or rows missing item name, quantity, or price (min 1 RWF)."
        : undefined,
    errors,
  }
}

export function parseStockExcelBuffer(buffer: ArrayBuffer, fileName: string): ParseStockExcelResult {
  const errors: string[] = []
  const lower = fileName.toLowerCase()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wb = (XLSX as any).read(buffer, {
    type: "array",
    raw: false,
    ...(lower.endsWith(".csv") ? { FS: ",", RS: "\n" } : {}),
  })
  if (!wb.SheetNames?.length) {
    return { rows: [], rowsParsed: 0, rowsSkipped: 0, errors: ["No worksheet found in file"] }
  }

  let best: ParseStockExcelResult | null = null
  const sheetErrors: string[] = []

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName]
    if (!sheet) continue
    const matrix = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
      raw: false,
    }) as (string | number | null)[][]

    const one = parseOneSheet(matrix, sheetName)
    if (one.rows.length > 0) {
      if (!best || one.rows.length > best.rows.length) {
        best = one
      }
    } else {
      sheetErrors.push(...one.errors)
    }
  }

  if (best && best.rows.length > 0) {
    return best
  }

  return {
    rows: [],
    rowsParsed: 0,
    rowsSkipped: 0,
    errors: [
      "Could not find a data sheet with at least: dish / item name and price columns (QTE optional — defaults to 1). " +
        "Supported names include ITEM, NAME, PLAT, LIBELLÉ, PRIX, PRICE, etc. Or use the CSV template from this page.",
      ...sheetErrors.slice(0, 5),
    ],
  }
}
