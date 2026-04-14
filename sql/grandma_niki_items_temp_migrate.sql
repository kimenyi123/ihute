-- Grandma S7: align an *existing* `grandma_niki_items_temp` with `grandma_niki_items_temp.sql`.
--
-- Do NOT run this against legacy `niki_items_temp` if that table has a different shape
-- (e.g. `item_id`, `company_id`). Those are unrelated; create `grandma_niki_items_temp`
-- with the CREATE script instead.
--
-- If you already have the Grandma-shaped table under the old name `niki_items_temp` only:
--   RENAME TABLE `niki_items_temp` TO `grandma_niki_items_temp`;
--
-- Quoting: use `schema`.`table`, not `schema.table` (one identifier).
-- Example: ALTER TABLE `chaos_theta`.`grandma_niki_items_temp` ...
--
-- `ADD COLUMN IF NOT EXISTS` requires MySQL 8.0.29+. Older servers: run one ADD at a time
-- and skip statements that error with "Duplicate column name".

ALTER TABLE `grandma_niki_items_temp`
  ADD COLUMN IF NOT EXISTS `seller_ishyiga_account` varchar(100) NOT NULL DEFAULT '' AFTER `id`,
  ADD COLUMN IF NOT EXISTS `item_commercial_name` varchar(200) NOT NULL DEFAULT '' AFTER `seller_ishyiga_account`,
  ADD COLUMN IF NOT EXISTS `sector_slug` varchar(64) DEFAULT NULL AFTER `item_commercial_name`,
  ADD COLUMN IF NOT EXISTS `cost_price` double DEFAULT '0' AFTER `sector_slug`,
  ADD COLUMN IF NOT EXISTS `sale_price` double DEFAULT '0' AFTER `cost_price`,
  ADD COLUMN IF NOT EXISTS `quantity` double DEFAULT '0' AFTER `sale_price`,
  ADD COLUMN IF NOT EXISTS `status` varchar(20) DEFAULT 'PENDING' AFTER `quantity`,
  ADD COLUMN IF NOT EXISTS `proposed_niki_code` varchar(64) DEFAULT NULL AFTER `status`,
  ADD COLUMN IF NOT EXISTS `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP AFTER `proposed_niki_code`;
