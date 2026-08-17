-- EBM / RRA fiscal invoice audit (Next.js EbmService)
-- Run on same DB as ONBOARDING_MYSQL_DATABASE (e.g. chaos_theta)

CREATE TABLE IF NOT EXISTS ebm_invoices (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id INT NOT NULL,
  invoice_number VARCHAR(100) NOT NULL,
  ebm_status ENUM('pending','success','failed','retry') NOT NULL DEFAULT 'pending',
  receipt_number VARCHAR(64) DEFAULT NULL,
  qr_code TEXT DEFAULT NULL,
  fiscal_signature TEXT DEFAULT NULL,
  vsdc_id VARCHAR(64) DEFAULT NULL,
  ysdcintdata TEXT DEFAULT NULL,
  ysdcmrc VARCHAR(128) DEFAULT NULL,
  ysdcmrctim VARCHAR(64) DEFAULT NULL,
  ysdctime VARCHAR(64) DEFAULT NULL,
  api_status VARCHAR(64) DEFAULT NULL,
  raw_request JSON DEFAULT NULL,
  raw_response JSON DEFAULT NULL,
  error_message TEXT DEFAULT NULL,
  retry_count INT NOT NULL DEFAULT 0,
  sent_at DATETIME DEFAULT NULL,
  response_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_ebm_order_invoice (order_id, invoice_number),
  KEY idx_ebm_status_retry (ebm_status, retry_count),
  KEY idx_ebm_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
