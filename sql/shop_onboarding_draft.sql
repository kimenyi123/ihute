-- Optional: stores full JSON payload from seller onboarding (crazy-shopping) submit.
-- Run once on the same database as ONBOARDING_MYSQL_DATABASE in .env.local
-- See: app/api/onboarding/crazy-shopping/route.ts

CREATE TABLE IF NOT EXISTS shop_onboarding_draft (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  payload_json JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
