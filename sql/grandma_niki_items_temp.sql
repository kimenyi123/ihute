-- Grandma S7: pending custom catalog rows before admin validation.
-- Run against the same MySQL schema Kaos uses (MySQLConnector.dbName), e.g. chaos_theta,
-- alongside account_seller / seller_add_stock.
--
-- Name is `grandma_niki_items_temp` so it does not collide with legacy `niki_items_temp`
-- tables (different columns, e.g. item_id / company_id) that exist in some deployments.

CREATE TABLE IF NOT EXISTS `grandma_niki_items_temp` (
  `id` int NOT NULL AUTO_INCREMENT,
  `seller_ishyiga_account` varchar(100) NOT NULL,
  `item_commercial_name` varchar(200) NOT NULL,
  `sector_slug` varchar(64) DEFAULT NULL,
  `cost_price` double DEFAULT '0',
  `sale_price` double DEFAULT '0',
  `quantity` double DEFAULT '0',
  `status` varchar(20) DEFAULT 'PENDING',
  `proposed_niki_code` varchar(64) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_seller` (`seller_ishyiga_account`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
