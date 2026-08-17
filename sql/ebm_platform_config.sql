-- Store RRA EBM credentials when .env is not used (e.g. production server).
-- Database: same as ONBOARDING_MYSQL_DATABASE (chaos_test).

CREATE TABLE IF NOT EXISTS ebm_platform_config (
  config_key VARCHAR(64) NOT NULL PRIMARY KEY,
  config_value TEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Supported config_key values:
--   security_key        (required)
--   base_url            (required if not in env)
--   company_tin
--   invoice_path        (required if not in env)
--   register_path       (required if not in env)
--   register_check_path (optional)
--   item_sync_path      (optional)

-- Example:
-- INSERT INTO ebm_platform_config (config_key, config_value) VALUES
--   ('security_key', 'YOUR_EBM_SECURITY_KEY'),
--   ('base_url', 'https://ishyiga.com'),
--   ('company_tin', 'YOUR_SHOP_TIN'),
--   ('invoice_path', '/vsdc/post_receipt_vsdc_rite_convert_Json'),
--   ('register_path', '/vsdc/post_parameter_vsdc_Json')
-- ON DUPLICATE KEY UPDATE config_value = VALUES(config_value), updated_at = CURRENT_TIMESTAMP;
