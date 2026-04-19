-- Diagnostics for sector card stats (matches Kaos fetchSuggestions.listSuppliersWithProducts for slug "pharmacy")
-- Tables: seller_add_stock s, account_signup a (see IHUTE_BCND/kaos/src/java/Kaos/fetchSuggestions.java)
-- Sector "pharmacy" -> token PHARMACY -> UPPER(a.PREFEREDCATEGORIES) LIKE '%PHARMACY%'
-- Note: servlet uses DEFAULT_SELLER_LIMIT = 5 for the main query LIMIT (frontend ?limit= is ignored for this action).

-- 1) Same shape as buildSellerSearchQuery / findSellersByCategory (list suppliers, cap 5 like default servlet)
SELECT DISTINCT
  s.SELLER_ISHYIGA_ACCOUNT AS ACC,
  COALESCE(NULLIF(TRIM(a.OWNER), ''), s.SELLER_ISHYIGA_ACCOUNT) AS OWNER,
  a.loc_cell AS LOCATION,
  a.momo AS MOMO
FROM seller_add_stock s
JOIN account_signup a ON a.ISHYIGA_ACCOUNT = s.SELLER_ISHYIGA_ACCOUNT
WHERE s.QUANTITY > 0
  AND s.SALE_PRICE_INCLUSIVE > 1
  AND a.TYPE = 'SELLER'
  AND a.STATUS = 'LIVE'
  AND UPPER(a.PREFEREDCATEGORIES) LIKE '%PHARMACY%'
ORDER BY RAND()
LIMIT 5;

-- 2) Count distinct sellers matching filters (should match "shops" if API returns rows)
SELECT COUNT(DISTINCT s.SELLER_ISHYIGA_ACCOUNT) AS shop_count
FROM seller_add_stock s
JOIN account_signup a ON a.ISHYIGA_ACCOUNT = s.SELLER_ISHYIGA_ACCOUNT
WHERE s.QUANTITY > 0
  AND s.SALE_PRICE_INCLUSIVE > 1
  AND a.TYPE = 'SELLER'
  AND a.STATUS = 'LIVE'
  AND UPPER(a.PREFEREDCATEGORIES) LIKE '%PHARMACY%';

-- 3) Total in-stock lines for those sellers (rough "items" sum line count; UI sums product array lengths / product_count fields)
SELECT COUNT(*) AS stock_lines
FROM seller_add_stock s
JOIN account_signup a ON a.ISHYIGA_ACCOUNT = s.SELLER_ISHYIGA_ACCOUNT
WHERE s.QUANTITY > 0
  AND s.SALE_PRICE_INCLUSIVE > 1
  AND a.TYPE = 'SELLER'
  AND a.STATUS = 'LIVE'
  AND UPPER(a.PREFEREDCATEGORIES) LIKE '%PHARMACY%';

-- 4) If (2) is 0: check signups without LIVE or wrong category spelling
SELECT a.ISHYIGA_ACCOUNT, a.STATUS, a.PREFEREDCATEGORIES, a.TYPE
FROM account_signup a
WHERE a.TYPE = 'SELLER'
  AND UPPER(IFNULL(a.PREFEREDCATEGORIES, '')) LIKE '%PHAR%' 
LIMIT 20;
