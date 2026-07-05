import mysql from "mysql2/promise"
import { getOnboardingMysqlConfig } from "@/lib/onboarding-mysql"

const ENSURE_SHOP_ONBOARDING_DRAFT = `
CREATE TABLE IF NOT EXISTS shop_onboarding_draft (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  payload_json JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_shop_onboarding_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`

const ENSURE_UMURIRO_SMS_OUTBOUND = `
CREATE TABLE IF NOT EXISTS umuriro_sms_outbound (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  request_id CHAR(36) NOT NULL,
  to_e164 VARCHAR(24) DEFAULT NULL,
  sent_ok TINYINT(1) NOT NULL DEFAULT 0,
  provider VARCHAR(32) DEFAULT NULL,
  error_message VARCHAR(512) DEFAULT NULL,
  sms_body MEDIUMTEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_umuriro_sms_request (request_id),
  KEY idx_umuriro_sms_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`

/** Stable JSON for MySQL `payload_json` (drops undefined keys). */
export function serializeOnboardingPayload(body: unknown): string {
  const json = JSON.stringify(body, (_, value) => (value === undefined ? null : value))
  JSON.parse(json)
  return json
}

export function isOnboardingMysqlConfigured(): boolean {
  return Boolean(getOnboardingMysqlConfig())
}

/**
 * Insert full onboarding / Umuriro payload into `shop_onboarding_draft`.
 * Creates the table if missing (same schema as sql/10thDBUpdate.sql).
 */
export async function persistShopOnboardingDraft(body: unknown): Promise<void> {
  const cfg = getOnboardingMysqlConfig()
  if (!cfg) {
    throw new Error("ONBOARDING_MYSQL_* is not configured")
  }

  const json = serializeOnboardingPayload(body)
  const conn = await mysql.createConnection(cfg)
  try {
    await conn.query(ENSURE_SHOP_ONBOARDING_DRAFT)
    await conn.query("INSERT INTO shop_onboarding_draft (payload_json) VALUES (?)", [json])
  } finally {
    await conn.end()
  }
}

export type UmuriroSmsAuditRow = {
  requestId: string
  toE164: string | null
  sentOk: boolean
  provider?: string
  errorMessage?: string
  smsBody?: string
}

/** Best-effort SMS audit — never throws (missing table is auto-created). */
export async function logUmuriroSmsOutbound(row: UmuriroSmsAuditRow): Promise<void> {
  const cfg = getOnboardingMysqlConfig()
  if (!cfg) return

  const conn = await mysql.createConnection(cfg)
  try {
    await conn.query(ENSURE_UMURIRO_SMS_OUTBOUND)
    await conn.query(
      `INSERT INTO umuriro_sms_outbound
         (request_id, to_e164, sent_ok, provider, error_message, sms_body)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        row.requestId,
        row.toE164,
        row.sentOk ? 1 : 0,
        row.provider ?? null,
        row.errorMessage?.slice(0, 512) ?? null,
        row.smsBody ?? null,
      ],
    )
  } catch (e: unknown) {
    console.warn(
      `[umuriro ${row.requestId}] sms audit skipped:`,
      e instanceof Error ? e.message : String(e),
    )
  } finally {
    await conn.end()
  }
}
