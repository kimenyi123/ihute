const base = "http://algorithm.bi:8080/vsdc/post_receipt_vsdc_rite_convert_Json"
const key = process.env.EBM_SECURITY_KEY || "Z60gftKe9sei3xOZhvvDa0StkVILKR3j5MBM9ygi1zg="
const tin = process.env.EBM_COMPANY_TIN || "999000025"

const flags = ["REGISTER", "PARAMETER", "INIT", "COMPANY", "INVOICE", "ITEM"]

for (const flag of flags) {
  const body = {
    companyTin: tin,
    ComputationType: "INCLUSIVE",
    fileName: "reg.json",
    flag,
    saleType: "NORMAL",
    businessPartnerName: "IHUTE",
    invoiceDate: "2026-07-10 12:00:00",
    userName: "IHUTE",
    itemsCount: "0",
    clientTin: "",
    totalAmount: "0",
    totalVat: "0",
    exchangeRate: "1",
    invoiceNumber: `REG-${flag}`,
    callback: "",
    currency: "RWF",
    items: [],
  }
  const res = await fetch(base, {
    method: "POST",
    headers: { "Content-Type": "application/json", security_key: key },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  console.log(`flag=${flag} -> ${res.status}: ${text.slice(0, 250)}`)
}
