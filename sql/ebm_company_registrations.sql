-- VSDC company registration cache (auto-register before invoice approval).
-- Database: same as ONBOARDING_MYSQL_DATABASE (chaos_test).

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
