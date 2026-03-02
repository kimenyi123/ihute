/**
 * Umusada Excel Upload API
 * Uses Next.js Umusada login (same flow as request-loan), then parses Excel and sends to Umusada.
 * Set UMUSADA_EXCEL_USE_JAVA_BACKEND=true only if you want to proxy to kaos instead.
 */
import { NextRequest, NextResponse } from "next/server"
import { getUmusadaExcelUrl } from "@/lib/backend-config"
import ExcelJS from "exceljs"

const UMUSADA_BASE = process.env.UMUSADA_AUTH_BASE || "https://umusada-master.umusada.com/umusada-master-service"
// Hardcoded credentials for Umusada login (same as Java UmusadaLoginService)
const UMUSADA_EMAIL = "umusada.dev@gmail.com"
const UMUSADA_PASSWORD = "Admin@123"

type DataType = "sales" | "purchase" | "financial" | "supplier"

function getCellValue(row: ExcelJS.Row, colIndex: number): string | number | Date | null {
  const col = colIndex + 1
  const cell = row.getCell(col)
  if (!cell) return null
  const v = (cell as { value?: unknown }).value
  if (v == null) return null
  if (typeof v === "object" && v !== null && "result" in v) return (v as { result: number }).result as number
  if (typeof v === "object" && v !== null && "date" in v) return (v as { date: Date }).date
  if (typeof v === "object" && v !== null && "richText" in v)
    return ((v as { richText: { text: string }[] }).richText || []).map((t) => t.text).join("")
  return v as string | number | Date
}

function getNumeric(row: ExcelJS.Row, colIndex: number): number {
  const v = getCellValue(row, colIndex)
  if (v == null) return 0
  if (typeof v === "number" && !isNaN(v)) return v
  const n = parseFloat(String(v).replace(/,/g, ""))
  return isNaN(n) ? 0 : n
}

function getString(row: ExcelJS.Row, colIndex: number): string {
  const v = getCellValue(row, colIndex)
  if (v == null) return ""
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v).trim()
}

function parseDateToMonthYear(dateCell: string | number | Date | null): { month: number; year: number } | null {
  if (dateCell == null) return null
  let date: Date
  if (dateCell instanceof Date) {
    date = dateCell
  } else if (typeof dateCell === "string") {
    // Try dd/MM/yyyy or yyyy-MM-dd
    const d1 = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(dateCell)
    const d2 = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateCell)
    if (d1) date = new Date(parseInt(d1[3]), parseInt(d1[2]) - 1, parseInt(d1[1]))
    else if (d2) date = new Date(parseInt(d2[1]), parseInt(d2[2]) - 1, parseInt(d2[3]))
    else return null
  } else if (typeof dateCell === "number") {
    // Excel serial date
    date = new Date((dateCell - 25569) * 86400 * 1000)
  } else {
    return null
  }
  if (isNaN(date.getTime())) return null
  return { month: date.getMonth() + 1, year: date.getFullYear() }
}

async function getUmusadaToken(): Promise<string> {
  const loginUrl = `${UMUSADA_BASE}/auth/login`
  console.log("[umusada/send-excel] getUmusadaToken loginUrl=" + loginUrl)
  const basicAuth = Buffer.from(`${UMUSADA_EMAIL}:${UMUSADA_PASSWORD}`).toString("base64")
  const login1 = await fetch(loginUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Basic ${basicAuth}` },
  })
  const login1Text = await login1.text()
  if (!login1.ok) {
    console.log("[umusada/send-excel] Login step 1 FAILED status=" + login1.status + " body=" + login1Text?.slice(0, 300))
    const detail = login1Text ? ` ${login1.status}: ${login1Text.slice(0, 200)}` : ` (HTTP ${login1.status})`
    throw new Error(`Umusada login step 1 failed${detail}`)
  }
  const otpData = JSON.parse(login1Text) as { otp?: string; otpToken?: string }
  if (!otpData.otp || !otpData.otpToken) {
    console.log("[umusada/send-excel] Login step 1 ok but no otp/otpToken in response")
    throw new Error("Umusada OTP required – set UMUSADA_EXCEL_TOKEN if you have a pre-auth token")
  }
  console.log("[umusada/send-excel] Login step 1 ok, got OTP, proceeding to step 2")
  const login2 = await fetch(`${UMUSADA_BASE}/auth/login-auth2`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${otpData.otpToken}` },
    body: JSON.stringify({ code: otpData.otp }),
  })
  if (!login2.ok) throw new Error("Umusada OTP validation failed")
  const tokenData = await login2.json()
  if (!tokenData.token) throw new Error("Failed to get Umusada token")
  console.log("[umusada/send-excel] Umusada auth success, token received")
  return tokenData.token
}

async function sendWithToken(url: string, payload: object, token: string): Promise<string> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Umusada API ${res.status}: ${text.slice(0, 300)}`)
  return text
}

function maskEmail(e: string): string {
  if (!e || e.length < 5) return "***"
  return e[0] + "***" + e[e.length - 1] + (e.includes("@") ? e.slice(e.indexOf("@")) : "")
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    const dataType = (formData.get("dataType") as string)?.toLowerCase() as DataType

    const useJava = process.env.UMUSADA_EXCEL_USE_JAVA_BACKEND === "true"
    console.log("[umusada/send-excel] dataType=" + dataType + " useJavaBackend=" + useJava)

    if (!file || !dataType) {
      return NextResponse.json(
        { ok: false, error: "Missing file or dataType (sales|purchase|financial|supplier)" },
        { status: 400 }
      )
    }

    const validTypes: DataType[] = ["sales", "purchase", "financial", "supplier"]
    if (!validTypes.includes(dataType)) {
      return NextResponse.json(
        { ok: false, error: "Invalid dataType. Use: sales, purchase, financial, supplier" },
        { status: 400 }
      )
    }

    // Proxy to kaos (Java backend) when UMUSADA_EXCEL_USE_JAVA_BACKEND is set
    if (useJava) {
      const javaUrl = getUmusadaExcelUrl()
      const email = process.env.UMUSADA_EXCEL_EMAIL || process.env.UMUSADA_USERNAME || "pm.serge@gmail.com"
      const pwd = process.env.UMUSADA_EXCEL_PASSWORD || process.env.UMUSADA_PASSWORD || "1234"
      console.log("[umusada/send-excel] Proxying to kaos url=" + javaUrl + " email=" + maskEmail(email) + " pwdSet=" + !!pwd)
      const proxyFormData = new FormData()
      proxyFormData.append("file", file)
      proxyFormData.append("dataType", dataType)
      proxyFormData.append("umusadaEmail", email)
      proxyFormData.append("umusadaPassword", pwd)
      const proxyRes = await fetch(javaUrl, {
        method: "POST",
        body: proxyFormData,
      })
      const proxyText = await proxyRes.text()
      let proxyData: unknown
      try {
        proxyData = proxyText ? JSON.parse(proxyText) : {}
      } catch {
        proxyData = {
          ok: false,
          error: (proxyText || "").slice(0, 800) || `Java backend error (HTTP ${proxyRes.status})`,
        }
      }
      const pd = proxyData as { ok?: boolean; error?: string; message?: string }
      console.log(
        "[umusada/send-excel] Kaos response status=" +
          proxyRes.status +
          " ok=" +
          (pd?.ok ?? false) +
          " error=" +
          ((pd?.error ?? pd?.message) || "none")
      )
      return NextResponse.json(proxyData, { status: proxyRes.ok ? 200 : proxyRes.status })
    }

    console.log("[umusada/send-excel] Using Next.js path. UMUSADA_BASE=" + UMUSADA_BASE + " email=" + maskEmail(UMUSADA_EMAIL))
    const buf = Buffer.from(await file.arrayBuffer())
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buf)
    const sheet = workbook.worksheets[0] ?? workbook.worksheets[1]
    if (!sheet) {
      return NextResponse.json({ ok: false, error: "No worksheet found in Excel file" }, { status: 400 })
    }

    const dataRows: ExcelJS.Row[] = []
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) dataRows.push(row)
    })

    let token: string
    try {
      const preAuth = process.env.UMUSADA_EXCEL_TOKEN
      if (preAuth) console.log("[umusada/send-excel] Using UMUSADA_EXCEL_TOKEN (pre-auth)")
      token = preAuth || (await getUmusadaToken())
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.log("[umusada/send-excel] Auth failed: " + msg)
      return NextResponse.json({
        ok: false,
        error: "Umusada authentication failed. " + msg,
        hint: "Set UMUSADA_EXCEL_TOKEN in .env if you have a pre-authenticated token, or ensure UMUSADA_EXCEL_EMAIL and UMUSADA_EXCEL_PASSWORD are correct.",
      }, { status: 401 })
    }

    const results: { sent: number; skipped: number; errors: string[] } = { sent: 0, skipped: 0, errors: [] }

    if (dataType === "sales") {
      const salesData: Array<{
        month: number
        year: number
        salesValue: number
        totalVat: number
        cost: number
        supplierId: number
        businessId: number
        invoiceCount: number
        branchName: string
      }> = []

      for (const row of dataRows) {
        const dateCell = getCellValue(row, 4)
        const my = parseDateToMonthYear(dateCell)
        if (!my) continue
        const salesValue = getNumeric(row, 9)
        const totalVat = getNumeric(row, 10)
        const supplierId = Math.round(getNumeric(row, 11))
        const businessId = Math.round(getNumeric(row, 12))
        const existing = salesData.find((s) => s.month === my.month && s.year === my.year && s.supplierId === supplierId)
        if (existing) {
          existing.salesValue += salesValue
          existing.totalVat += totalVat
          existing.cost += salesValue
          existing.invoiceCount += 1
        } else {
          salesData.push({
            month: my.month,
            year: my.year,
            salesValue,
            totalVat,
            cost: salesValue,
            supplierId,
            businessId,
            invoiceCount: 1,
            branchName: "DEJAVU",
          })
        }
      }

      for (const s of salesData) {
        try {
          const payload = {
            branchId: "000",
            salesValue: s.salesValue,
            cost: s.cost,
            supplierId: s.supplierId,
            year: s.year,
            consumerId: "",
            invoiceCount: s.invoiceCount,
            businessId: s.businessId,
            branchName: s.branchName,
            itemCount: 0,
            totalVat: s.totalVat,
            month: s.month,
            credit: 0,
            cash: 0,
          }
          await sendWithToken(`${UMUSADA_BASE}/sales/save`, payload, token)
          results.sent++
        } catch (e) {
          results.errors.push((e instanceof Error ? e.message : String(e)).slice(0, 100))
        }
      }
    } else if (dataType === "purchase") {
      for (const row of dataRows) {
        const supplierTIN = Math.round(getNumeric(row, 0))
        const supplierName = getString(row, 1)
        const amountWithoutVat = getNumeric(row, 5)
        const vat = getNumeric(row, 6)
        const totalAmount = amountWithoutVat + vat
        const businessOwnerId = Math.round(getNumeric(row, 7)) // purchaser business ID
        const supplierUmusadaId = Math.round(getNumeric(row, 8)) || supplierTIN // supplier's Umusada business ID (col 8 optional)

        const dateCell = getCellValue(row, 4)
        const my = parseDateToMonthYear(dateCell)
        if (!my) continue

        try {
          const payload = {
            month: my.month,
            year: my.year,
            invoiceCount: 1,
            poValue: totalAmount,
            poNumber: 1,
            businessId: businessOwnerId,
            supplierId: supplierUmusadaId,
          }
          await sendWithToken(`${UMUSADA_BASE}/purchases/save`, payload, token)
          results.sent++
        } catch (e) {
          results.errors.push((e instanceof Error ? e.message : String(e)).slice(0, 100))
        }
      }
    } else if (dataType === "financial") {
      for (const row of dataRows) {
        const dateCell = getCellValue(row, 0)
        const my = parseDateToMonthYear(dateCell)
        if (!my) continue
        let journalId = getString(row, 1)
        if (journalId.startsWith("FTCM")) journalId = "BK " + journalId
        const debit = getNumeric(row, 3)
        const credit = getNumeric(row, 4)
        const businessId = Math.round(getNumeric(row, 6))

        try {
          const payload = {
            periodMonth: my.month,
            periodYear: my.year,
            businessId,
            debit,
            credit,
            journal: 1,
            bilan: journalId,
          }
          await sendWithToken(`${UMUSADA_BASE}/financial-records`, payload, token)
          results.sent++
        } catch (e) {
          results.errors.push((e instanceof Error ? e.message : String(e)).slice(0, 100))
        }
      }
    } else if (dataType === "supplier") {
      for (const row of dataRows) {
        const phoneNbr = String(Math.round(getNumeric(row, 0)) || getString(row, 0))
        const supplierName = getString(row, 1)
        const location = getString(row, 2)
        const aggr = Math.round(getNumeric(row, 3))
        const tin = Math.round(getNumeric(row, 4))
        const email = getString(row, 5)

        try {
          const payload = {
            canPurchase: true,
            phoneNumber: phoneNbr || "250780532022",
            canSale: true,
            name: supplierName,
            registrationCode: (supplierName || "SUPPLIER").toUpperCase(),
            location: location || "Kigali",
            valueChain: "",
            aggregatorId: aggr || 23,
            category: "DISTRIBUTOR",
            businessTin: String(tin),
            email: email || "niki@umusada.com",
            status: true,
          }
          await sendWithToken(`${UMUSADA_BASE}/business/save`, payload, token)
          results.sent++
        } catch (e) {
          results.errors.push((e instanceof Error ? e.message : String(e)).slice(0, 100))
        }
      }
    }

    return NextResponse.json({
      ok: true,
      dataType,
      rowsProcessed: dataRows.length,
      sent: results.sent,
      errors: results.errors.slice(0, 10),
      message: `Sent ${results.sent} ${dataType} record(s) to Umusada.`,
    })
  } catch (e) {
    console.error("[umusada/send-excel]", e)
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    )
  }
}
