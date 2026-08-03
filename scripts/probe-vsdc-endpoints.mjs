const base = "http://algorithm.bi:8080"
const key = process.env.EBM_SECURITY_KEY || "Z60gftKe9sei3xOZhvvDa0StkVILKR3j5MBM9ygi1zg="
const tin = process.env.EBM_COMPANY_TIN || "999000025"

const paths = [
  "/vsdc/post_receipt_vsdc_rite_convert_Json",
  "/vsdc/register_parameter",
  "/vsdc/register_parameters",
  "/vsdc/post_parameter",
  "/vsdc/post_parameters",
  "/vsdc/register_company",
  "/vsdc/init_parameter",
  "/vsdc/get_parameter",
  "/vsdc/parameters",
]

const sampleInvoice = {
  companyTin: tin,
  ComputationType: "INCLUSIVE",
  fileName: "TEST-001.json",
  flag: "INVOICE",
  saleType: "NORMAL",
  voucherAmount: "",
  discountAmount: "",
  businessPartnerName: "Test Customer",
  invoiceDate: "2026-07-10 12:00:00",
  userName: "IHUTE",
  itemsCount: "1",
  clientTin: "",
  totalAmount: "1000",
  totalVat: "0",
  clientTinPin: "",
  exchangeRate: "1",
  invoiceNumber: `TEST-${Date.now()}`,
  callback: "",
  currency: "RWF",
  discountType: "",
  items: [
    {
      itemCode: "A001",
      description: "Test item",
      quantity: "1",
      unitPrice: "1000",
      discount: "0",
      taxCode: "A",
      taxRate: "0",
      batch: "",
      expire: "",
    },
  ],
}

for (const path of paths) {
  try {
    const body = path.includes("receipt") ? sampleInvoice : { companyTin: tin, tin, TIN: tin }
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        security_key: key,
      },
      body: JSON.stringify(body),
    })
    const text = await res.text()
    console.log(`\n${path} -> ${res.status}`)
    console.log(text.slice(0, 400))
  } catch (e) {
    console.log(`\n${path} -> ERROR`, e.message)
  }
}
