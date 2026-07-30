const url =
  process.env.EBM_URL ||
  "http://algorithm.bi:8080/vsdc/post_receipt_vsdc_rite_convert_Json"
const key = "Z60gftKe9sei3xOZhvvDa0StkVILKR3j5MBM9ygi1zg="

const payload = {
  companyTin: "999000025",
  ComputationType: "INCLUSIVE",
  fileName: "",
  flag: "INVOICE",
  saleType: "NORMAL",
  voucherAmount: "",
  discountAmount: "",
  businessPartnerName: "Client",
  invoiceDate: "2023-04-19",
  userName: "sapUser",
  itemsCount: "1",
  clientTin: "100000002",
  totalAmount: "118",
  totalVat: "18",
  clientTinPin: "",
  exchangeRate: "1",
  invoiceNumber: `SAP12320t01-${Date.now()}`,
  callback: "",
  currency: "RWF",
  discountType: "",
  items: [
    {
      unitPrice: "118",
      quantity: "1",
      itemCategory: "",
      itemCode: "000020",
      batch: "",
      description: "MANGODB",
      discount: "0",
      taxCode: "B",
      taxRate: "18",
      expire: "",
    },
  ],
}

console.log("POST", url)
console.log("companyTin:", payload.companyTin)
console.log("clientTin:", payload.clientTin)

const res = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json", security_key: key },
  body: JSON.stringify(payload),
})
const text = await res.text()
console.log("Status:", res.status)
console.log("Response:", text)
