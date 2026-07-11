/** Company / parameter registration payload for VSDC (Algorithm API v8.2). */
export type EbmCompanyRegistrationRequest = {
  companyTin: string
  userName: string
  requestDate: string
  bhfId: string
  dvcSrlNo: string
  taxprNm: string
  bsnsActv: string
  bhfSttsCd: string
  prvncNm: string
  dstrtNm: string
  sctrNm: string
  locDesc: string
  hqYn: string
  mgrNm: string
  mgrTelNo: string
  mgrEmail: string
}

export type EbmRegistrationStatus = "registered" | "failed" | "unknown"

export type EbmRegistrationRecord = {
  companyTin: string
  status: EbmRegistrationStatus
  vsdcId: string | null
  distributorTin: string | null
  registeredAt: Date | null
  errorMessage: string | null
}

export type EbmRegistrationResult = {
  ok: boolean
  status: EbmRegistrationStatus
  vsdcId?: string | null
  distributorTin?: string | null
  rawText?: string
  error?: string
  alreadyRegistered?: boolean
}
