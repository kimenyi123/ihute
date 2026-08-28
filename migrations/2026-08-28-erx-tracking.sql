-- eRx service delivery tracking — every MoH pull, unlock, RFQ, and outcome.
-- Target DB: chaos_beta (same as Kaos / ONBOARDING_MYSQL_* / GQ_MYSQL_*).
-- Apply: mysql chaos_beta < migrations/2026-08-28-erx-tracking.sql

CREATE TABLE IF NOT EXISTS erx_tracking (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,

  event_type VARCHAR(32) NOT NULL COMMENT 'LOOKUP | RFQ | CHOOSE | PAY | DELIVER | RATE',
  erx_code VARCHAR(64) NOT NULL,
  status VARCHAR(16) NOT NULL COMMENT 'SUCCESS | FAIL | PENDING',

  fail_code VARCHAR(64) NULL,
  fail_message VARCHAR(512) NULL,

  unlock_key_type VARCHAR(16) NULL COMMENT 'phone | names | nationalId | mixed',
  unlock_key_hint VARCHAR(128) NULL COMMENT 'masked key used (no full PII)',

  requested_at DATETIME(3) NOT NULL,
  responded_at DATETIME(3) NULL,
  duration_ms INT UNSIGNED NULL,

  patient_display_name VARCHAR(255) NULL,
  drug_count INT UNSIGNED NULL,
  drugs_json JSON NULL COMMENT 'prescribed lines snapshot',

  order_id VARCHAR(64) NULL,
  pharmacies_requested JSON NULL COMMENT '[{id,name}]',
  pharmacies_inserted INT UNSIGNED NULL,
  pos_summary VARCHAR(255) NULL,

  picked_pharmacy_id VARCHAR(64) NULL,
  picked_pharmacy_name VARCHAR(255) NULL,

  service_stage VARCHAR(32) NULL COMMENT 'UNLOCK | CANDIDATES | RFQ | QUOTES | PAID | DELIVERED',
  pos_transaction_id VARCHAR(128) NULL,

  client_ip VARCHAR(64) NULL,
  user_agent VARCHAR(512) NULL,
  meta JSON NULL,

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  KEY idx_erx_tracking_code (erx_code),
  KEY idx_erx_tracking_status (status, event_type),
  KEY idx_erx_tracking_requested (requested_at),
  KEY idx_erx_tracking_order (order_id),
  KEY idx_erx_tracking_stage (service_stage)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='MoH eRx pull / unlock / RFQ audit trail for service delivery dashboard';
