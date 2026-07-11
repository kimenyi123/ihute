import { createHash } from "node:crypto"
import {
  createOnboardingMysqlConnection,
  onboardingMysqlConfigHint,
} from "@/lib/onboarding-mysql"
import type {
  EbmRegistrationRecord,
  EbmRegistrationStatus,
} from "@/lib/ebm/ebm-registration-types"

const ENSURE_TABLE = `
CREATE TABLE IF NOT EXISTS ebm_company_registrations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_tin VARCHAR(32) NOT NULL,
  security_key_fp VARCHAR(32) NOT NULL,
  registration_status ENUM('registered','failed') NOT NULL DEFAULT 'failed',
  vsdc_id VARCHAR(64) DEFAULT NULL,
  distributor_tin VARCHAR(32) DEFAULT NULL,
  raw_request JSON DEFAULT NULL,
  raw_response JSON DEFAULT NULL,
  error_message TEXT DEFAULT NULL,
  registered_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_ebm_reg_tin_key (company_tin, security_key_fp),
  KEY idx_ebm_reg_status (registration_status, company_tin)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`

let tableReady = false

export function securityKeyFingerprint(securityKey: string): string {
  return createHash("sha256").update(securityKey.trim()).digest("hex").slice(0, 16)
}

export class EbmRegistrationRepository {
  private async conn() {
    try {
      return await createOnboardingMysqlConnection()
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes("ONBOARDING_MYSQL")) throw e
      throw new Error(onboardingMysqlConfigHint())
    }
  }

  async ensureTable(): Promise<void> {
    if (tableReady) return
    const conn = await this.conn()
    try {
      await conn.query(ENSURE_TABLE)
      tableReady = true
    } finally {
      await conn.end()
    }
  }

  async findRegistered(args: {
    companyTin: string
    securityKey: string
  }): Promise<EbmRegistrationRecord | null> {
    await this.ensureTable()
    const conn = await this.conn()
    const fp = securityKeyFingerprint(args.securityKey)
    try {
      const [rows] = await conn.query(
        `SELECT company_tin, registration_status, vsdc_id, distributor_tin,
                registered_at, error_message
         FROM ebm_company_registrations
         WHERE company_tin = ? AND security_key_fp = ? AND registration_status = 'registered'
         ORDER BY id DESC LIMIT 1`,
        [args.companyTin.trim(), fp],
      )
      const list = Array.isArray(rows) ? rows : []
      if (!list.length) return null
      const r = list[0] as Record<string, unknown>
      return {
        companyTin: String(r.company_tin),
        status: "registered",
        vsdcId: r.vsdc_id != null ? String(r.vsdc_id) : null,
        distributorTin: r.distributor_tin != null ? String(r.distributor_tin) : null,
        registeredAt: r.registered_at ? new Date(String(r.registered_at)) : null,
        errorMessage: null,
      }
    } finally {
      await conn.end()
    }
  }

  async saveRegistration(args: {
    companyTin: string
    securityKey: string
    status: EbmRegistrationStatus
    vsdcId?: string | null
    distributorTin?: string | null
    rawRequest?: unknown
    rawResponse?: unknown
    errorMessage?: string | null
  }): Promise<void> {
    await this.ensureTable()
    const conn = await this.conn()
    const fp = securityKeyFingerprint(args.securityKey)
    const dbStatus = args.status === "registered" ? "registered" : "failed"
    try {
      await conn.query(
        `INSERT INTO ebm_company_registrations (
          company_tin, security_key_fp, registration_status, vsdc_id, distributor_tin,
          raw_request, raw_response, error_message, registered_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          registration_status = VALUES(registration_status),
          vsdc_id = VALUES(vsdc_id),
          distributor_tin = VALUES(distributor_tin),
          raw_request = VALUES(raw_request),
          raw_response = VALUES(raw_response),
          error_message = VALUES(error_message),
          registered_at = VALUES(registered_at),
          updated_at = CURRENT_TIMESTAMP`,
        [
          args.companyTin.trim(),
          fp,
          dbStatus,
          args.vsdcId ?? null,
          args.distributorTin ?? null,
          args.rawRequest ? JSON.stringify(args.rawRequest) : null,
          args.rawResponse ? JSON.stringify(args.rawResponse) : null,
          args.errorMessage?.slice(0, 2000) ?? null,
          dbStatus === "registered" ? new Date() : null,
        ],
      )
    } finally {
      await conn.end()
    }
  }
}
