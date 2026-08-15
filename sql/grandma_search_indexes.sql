-- Grandma search — Option A: indexes only on existing columns (no new tables).
-- Safe to run multiple times: statements that already exist will error; skip those.
-- Target: same MySQL DB as Kaos (e.g. chaos_theta / chaos_beta).
--
-- DO NOT run against production without explicit authorization.
-- Empirical bottleneck (chaos_dev, remote MySQL, 2026-08-14):
--   EXISTS+LIKE correlated: ~5–8s warm text search
--   MATCH+JOIN DISTINCT: ~10–15s (examined matching stock rows against account_signup)
--   MATCH no-JOIN GROUP BY, parallel shop LIKE, samples from MATCH:
--     shop LIKE ~0.9–2.3s; MATCH '+milk*' ~4.2–5s; seller list ~0.4s
--     warm milk ~4.5–6.7s; shop-name ~0.9–1.3s; Near Me/browse ~0.4s
-- FULLTEXT is compatible with exact/prefix product search (milk, MILK).
-- Fuzzy milkk uses a separate '+milk*' stem query (token length >= 5).
-- FULLTEXT does not replace LIKE fallback if MATCH throws.
-- Proposed indexes remain NOT applied (no production DDL).

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
