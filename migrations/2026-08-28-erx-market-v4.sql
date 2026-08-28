-- eRx Market v4 — data model extensions (extend existing models, no parallel system).
-- Target: the ihute MySQL schema behind the Kaos/Ishyiga pending-orders channel.
-- Apply with: mysql <db> < migrations/2026-08-28-erx-market-v4.sql
--
-- Phase 1 note: the Next.js layer currently keeps eRx orders in memory
-- (lib/erx/erx-order-store.ts). These tables are the agreed landing shape for
-- the Kaos write-back; the column names mirror ErxOrderSnapshot fields.

-- 1. orders: eRx orders ride the existing orders table with a type marker.
ALTER TABLE orders
  ADD COLUMN type VARCHAR(16) NULL COMMENT 'ERX_RFQ | ERX_ORDER (NULL = normal shop order)',
  ADD COLUMN erx_code VARCHAR(32) NULL COMMENT 'MoH eRx code, e.g. EP-0317-170',
  ADD COLUMN delivery_mode VARCHAR(16) NULL COMMENT 'pharmacy | pickup | rider',
  ADD COLUMN delivery_fee INT NULL,
  ADD COLUMN delivery_rider_id VARCHAR(64) NULL,
  ADD COLUMN momo_ref VARCHAR(32) NULL,
  ADD COLUMN erx_hold_expires_at DATETIME NULL COMMENT 'eRx HOLD auto-release (paid + 4h)';

CREATE INDEX idx_orders_type_erx ON orders (type, erx_code);

-- 2. order_quotes: one row per pharmacy response to an ERX_RFQ.
CREATE TABLE IF NOT EXISTS order_quotes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id VARCHAR(32) NOT NULL,
  pharmacy_id VARCHAR(64) NOT NULL,
  status VARCHAR(16) NOT NULL COMMENT 'CALLING | FULL | PARTIAL | DECLINED | STOPPED',
  lines JSON NULL COMMENT '[{name, need, qty, unit, price}]',
  delivery_fee INT NULL,
  eta_min INT NULL,
  discount_pct TINYINT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  answered_at DATETIME NULL,
  UNIQUE KEY uq_order_pharmacy (order_id, pharmacy_id),
  KEY idx_quotes_order (order_id)
);

-- 3. rider_offers: Seller Central rider offers per order.
CREATE TABLE IF NOT EXISTS rider_offers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id VARCHAR(32) NOT NULL,
  rider VARCHAR(128) NOT NULL,
  vehicle ENUM('moto','bike') NOT NULL,
  fee INT NOT NULL,
  eta_min INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_rider_offers_order (order_id)
);

-- 4. ratings: mandatory patient rating after delivery (pharmacy + optional rider).
CREATE TABLE IF NOT EXISTS ratings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id VARCHAR(32) NOT NULL,
  pharmacy_id VARCHAR(64) NOT NULL,
  pharmacy_stars TINYINT NOT NULL,
  rider_stars TINYINT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_ratings_order (order_id),
  KEY idx_ratings_pharmacy (pharmacy_id, created_at)
);

-- 5. pharmacy_metrics: computed nightly + refreshed on rating/quote events.
--    stars     = AVG(pharmacy_stars) rolling 90d
--    stock_acc = confirmed_lines / shown_available_lines rolling 30d, bucketed 1..5
--    last_sync = minutes since last POS stock heartbeat (heartbeat already received by ihute)
CREATE TABLE IF NOT EXISTS pharmacy_metrics (
  pharmacy_id VARCHAR(64) NOT NULL PRIMARY KEY,
  stars DECIMAL(3,2) NULL,
  stock_acc TINYINT NULL,
  last_sync_at DATETIME NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- TODO(nightly job): populate pharmacy_metrics; event triggers on ratings insert
-- and order_quotes status change. Consumed by GET /api/pharmacies/nearby.
