const base = "http://algorithm.bi:8080"
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
  "post_receipt_vsdc_register_Json",
  "get_parameter_vsdc_Json",
  "select_parameter_vsdc_Json",
  "post_item_vsdc_Json",
  "register_vsdc_Json",
].map((p) => `/vsdc/${p}`)

for (const path of paths) {
  try {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", security_key: key },
      body: JSON.stringify({ companyTin: tin, tin, TIN: tin, userName: "IHUTE" }),
    })
    const text = await res.text()
    if (res.status !== 404) {
      console.log(`${path} -> ${res.status}: ${text.slice(0, 200)}`)
    }
  } catch (e) {
    console.log(`${path} -> ${e.message}`)
  }
}
