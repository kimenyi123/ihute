-- Grandma search — Option A: indexes only on existing columns (no new tables).
-- Safe to run multiple times: statements that already exist will error; skip those.
-- Target: same MySQL DB as Kaos (e.g. chaos_theta / chaos_beta).

-- Geo indexes already present on many dumps:
--   KEY idx_supplier_gps (supplier_latitude, supplier_longitude, TYPE, STATUS)
--   KEY idx_supplier_location (TYPE, STATUS, supplier_latitude, supplier_longitude)
-- Product FULLTEXT already present:
--   FULLTEXT KEY idx_fulltext_product (ITEM_NAME, DESCRIPTION_KEYWORD)

-- Optional: shop-name / description FULLTEXT for Grandma text ranking
-- (OWNER, nickname, DESCRIPTION, PREFEREDCATEGORIES, DEPARTMENT, HQ_LOCATION)
ALTER TABLE `account_signup`
  ADD FULLTEXT INDEX `ft_grandma_shop_search`
  (`OWNER`, `nickname`, `DESCRIPTION`, `PREFEREDCATEGORIES`, `DEPARTMENT`, `HQ_LOCATION`);

-- Optional: broaden product FULLTEXT with category/keywords columns used by Grandma search
ALTER TABLE `seller_add_stock`
  ADD FULLTEXT INDEX `ft_grandma_product_search`
  (`ITEM_NAME`, `DESCRIPTION_KEYWORD`, `FAMILLE`, `item_keywords`, `DESCRIPTION`);
