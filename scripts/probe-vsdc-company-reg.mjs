const base = process.env.EBM_BASE || "http://algorithm.bi:8080"
const key = process.env.EBM_SECURITY_KEY || "Z60gftKe9sei3xOZhvvDa0StkVILKR3j5MBM9ygi1zg="
const tin = process.env.EBM_COMPANY_TIN || "999000025"

const names = [
  "post_parameter_vsdc_Json",
  "post_parameter_vsdc_lite_Json",
  "Save_Vsdc_parameter_lite_json",
  "Send_Vsdc_parameter_lite_json",
  "Send_Vsdc_Company_lite_json",
  "Register_Vsdc_Company_lite_json",
  "Get_Vsdc_parameter_lite_json",
  "get_parameter_vsdc_Json",
  "post_company_parameter_vsdc_Json",
  "init_vsdc_company_Json",
  "Save_Vsdc_company_lite_json",
  "post_receipt_vsdc_register_Json",
  "register_vsdc_parameter_Json",
]

const payload = {
  companyTin: tin,
  userName: "IHUTE",
  requestDate: new Date().toISOString().slice(0, 10),
  bhfId: "00",
  dvcSrlNo: "IHUTE-DEV001",
  taxprNm: "Feels Feels",
  bsnsActv: "Retail trade",
  bhfSttsCd: "01",
  prvncNm: "Kigali City",
  dstrtNm: "Gasabo",
  sctrNm: "Remera",
  locDesc: "Kigali",
  hqYn: "Y",
  mgrNm: "Manager",
  mgrTelNo: "0786486719",
  mgrEmail: "shop@ihute.rw",
}

console.log("Probing", base, "tin=", tin)

for (const name of names) {
  const url = `${base}/vsdc/${name}`
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", security_key: key },
      body: JSON.stringify(payload),
    })
    if (res.status !== 404) {
      const text = await res.text()
      console.log(`\n>>> ${name}`)
      console.log(`HTTP ${res.status}: ${text.slice(0, 400)}`)
    }
  } catch (e) {
    console.log(`${name} ERR`, e.message)
  }
}

// Also try item registration (sometimes required before invoice)
const itemUrl = `${base}/vsdc/Send_Vsdc_item_lite_json`
try {
  const res = await fetch(itemUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", security_key: key },
    body: JSON.stringify({
      companyTin: tin,
      reference: `REG-${Date.now()}`,
      userName: "IHUTE",
      requestDate: new Date().toISOString().slice(0, 10),
      items: [{ description: "Product", itemClsCd: "41278976", itemCd: "ITEM001", taxCode: "B" }],
    }),
  })
  console.log(`\n>>> Send_Vsdc_item_lite_json`)
  console.log(`HTTP ${res.status}: ${(await res.text()).slice(0, 400)}`)
} catch (e) {
  console.log("items ERR", e.message)
}
