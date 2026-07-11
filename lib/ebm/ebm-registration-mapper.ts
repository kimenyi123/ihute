import type { EbmCompanyRegistrationRequest } from "@/lib/ebm/ebm-registration-types"

function str(v: unknown): string {
  if (v == null) return ""
  return String(v).trim()
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function readEnv(key: string): string {
  return process.env[key]?.trim() || ""
}

export type EbmRegistrationMapperInput = {
  companyTin: string
  userName?: string
  sellerName?: string
}

export type EbmRegistrationValidation = {
  valid: boolean
  missingFields: string[]
}

/** Validate required registration fields before calling VSDC. */
export function validateRegistrationConfig(): EbmRegistrationValidation {
  const required = [
    "EBM_BRANCH_ID",
    "EBM_DEVICE_SERIAL",
    "EBM_TAXPAYER_NAME",
    "EBM_BUSINESS_ACTIVITY",
    "EBM_PROVINCE",
    "EBM_DISTRICT",
    "EBM_SECTOR",
    "EBM_LOCATION",
    "EBM_MANAGER_PHONE",
    "EBM_MANAGER_EMAIL",
  ] as const

  const missingFields = required.filter((key) => !readEnv(key))
  return { valid: missingFields.length === 0, missingFields: [...missingFields] }
}

/** Build VSDC company parameter registration body from env + seller context. */
export function mapCompanyRegistration(
  input: EbmRegistrationMapperInput,
): EbmCompanyRegistrationRequest {
  const tin = str(input.companyTin)
  const userName = str(input.userName) || readEnv("EBM_DEFAULT_USERNAME")
  const taxprNm = readEnv("EBM_TAXPAYER_NAME") || str(input.sellerName)

  return {
    companyTin: tin,
    userName,
    requestDate: todayIsoDate(),
    bhfId: readEnv("EBM_BRANCH_ID"),
    dvcSrlNo: readEnv("EBM_DEVICE_SERIAL"),
    taxprNm,
    bsnsActv: readEnv("EBM_BUSINESS_ACTIVITY"),
    bhfSttsCd: readEnv("EBM_BRANCH_STATUS") || readEnv("EBM_BRANCH_STATUS_CODE"),
    prvncNm: readEnv("EBM_PROVINCE"),
    dstrtNm: readEnv("EBM_DISTRICT"),
    sctrNm: readEnv("EBM_SECTOR"),
    locDesc: readEnv("EBM_LOCATION"),
    hqYn: readEnv("EBM_HQ_YN"),
    mgrNm: readEnv("EBM_MANAGER_NAME") || taxprNm,
    mgrTelNo: readEnv("EBM_MANAGER_PHONE"),
    mgrEmail: readEnv("EBM_MANAGER_EMAIL"),
  }
}
