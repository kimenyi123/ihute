-- Optional: full JSON payloads from Umuriro (/api/onboarding/umuriro) and crazy-shopping submit.
-- This is NOT account_seller — query payload_json for kind = "umuriro" or seller fields.
-- Run once on the same database as ONBOARDING_MYSQL_DATABASE in .env.local
-- See: app/api/onboarding/umuriro/route.ts, app/api/onboarding/crazy-shopping/route.ts

CREATE TABLE IF NOT EXISTS shop_onboarding_draft (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  payload_json JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
