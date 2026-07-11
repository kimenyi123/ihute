const base = process.env.EBM_BASE || "http://algorithm.bi:8080"
const key = process.env.EBM_SECURITY_KEY || "Z60gftKe9sei3xOZhvvDa0StkVILKR3j5MBM9ygi1zg="
const tin = process.env.EBM_COMPANY_TIN || "999000025"

const paths = [
  "post_parameter_vsdc_Json",
  "post_parameters_vsdc_Json",
  "register_parameter_vsdc_Json",
  "post_company_parameter_Json",
  "post_company_vsdc_Json",
  "save_parameter_vsdc_Json",
  "init_vsdc_parameter_Json",
  "Get_Vsdc_parameter_Json",
  "Get_Vsdc_Company_Json",
  "get_parameter_vsdc_Json",
  "select_parameter_vsdc_Json",
  "register_vsdc_Json",
  "post_receipt_vsdc_register_Json",
  "Send_Vsdc_Company_lite_json",
  "Send_Vsdc_Company_lite",
  "Send_Vsdc_parameter_lite_json",
  "Send_Vsdc_parameter_lite",
  "Register_Vsdc_Company_lite_json",
  "Register_Vsdc_Company_lite",
]

const payloads = [
  { companyTin: tin, tin, TIN: tin, userName: "IHUTE" },
  {
    companyTin: tin,
    userName: "IHUTE",
    bhfId: "00",
    dvcSrlNo: "IHUTE001",
    taxprNm: "IHUTE Shop",
    bsnsActv: "Retail",
    bhfSttsCd: "01",
    prvncNm: "Kigali",
    dstrtNm: "Gasabo",
    sctrNm: "Remera",
    locDesc: "Kigali",
    hqYn: "Y",
    mgrNm: "Manager",
    mgrTelNo: "0780000000",
    mgrEmail: "shop@ihute.rw",
  },
]

for (const p of paths) {
  const url = `${base}/vsdc/${p}`
  for (const body of payloads) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", security_key: key },
        body: JSON.stringify(body),
      })
      if (res.status !== 404) {
        const text = await res.text()
        console.log(`POST ${p} [${Object.keys(body).length} fields] -> ${res.status}: ${text.slice(0, 300)}`)
      }
    } catch (e) {
      console.log(`POST ${p} -> ${e.message}`)
    }
  }
  try {
    const res = await fetch(`${url}?companyTin=${tin}`, {
      method: "GET",
      headers: { security_key: key },
    })
    if (res.status !== 404) {
      const text = await res.text()
      console.log(`GET ${p} -> ${res.status}: ${text.slice(0, 300)}`)
    }
  } catch {
    /* ignore */
  }
}
