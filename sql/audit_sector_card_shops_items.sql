-- Audit "N shops · M items" on sector cards (CategoryGridAI → fetchSuggestions?listSuppliersWithProducts)
-- Java: Kaos.fetchSuggestions — DEFAULT_SELLER_LIMIT = 5, DEFAULT_PRODUCTS_PER_SELLER = 6
-- UI sums products.length (or product_count) per seller in that JSON array → same as LEAST(line_count, 6) per seller.
--
-- Usage: set @sector_token (UPPER substring match on PREFEREDCATEGORIES, same as servlet tokens).
-- Examples: PHARMACY, BOUTIQUE, SUPERMARKET, BAR (bar-resto uses multiple tokens in app; use the one that matches your row)

SET @sector_token = 'PHARMACY';

-- ---------------------------------------------------------------------------
-- A) Totals in DB (no random sample, no per-seller cap) — "how big is the sector really"
-- ---------------------------------------------------------------------------
SELECT COUNT(DISTINCT s.SELLER_ISHYIGA_ACCOUNT) AS total_shops_all,
       COUNT(*) AS total_in_stock_lines_all
FROM seller_add_stock s
JOIN account_signup a ON a.ISHYIGA_ACCOUNT = s.SELLER_ISHYIGA_ACCOUNT
WHERE s.QUANTITY > 0
  AND s.SALE_PRICE_INCLUSIVE > 0
  AND a.TYPE = 'SELLER'
  AND a.STATUS = 'LIVE'
  AND UPPER(COALESCE(a.PREFEREDCATEGORIES, '')) LIKE CONCAT('%', @sector_token, '%');

-- ---------------------------------------------------------------------------
-- B) Same as API/card: up to 5 random sellers, then sum min(line_count, 6) per seller
--    (Run twice: counts may differ slightly because of RAND(); same idea as servlet.)
-- ---------------------------------------------------------------------------
WITH picked AS (
  SELECT DISTINCT s.SELLER_ISHYIGA_ACCOUNT AS acc
  FROM seller_add_stock s
  JOIN account_signup a ON a.ISHYIGA_ACCOUNT = s.SELLER_ISHYIGA_ACCOUNT
  WHERE s.QUANTITY > 0
    AND s.SALE_PRICE_INCLUSIVE > 0
    AND a.TYPE = 'SELLER'
    AND a.STATUS = 'LIVE'
    AND UPPER(COALESCE(a.PREFEREDCATEGORIES, '')) LIKE CONCAT('%', @sector_token, '%')
  ORDER BY RAND()
  LIMIT 5
),
per_seller AS (
  SELECT s.SELLER_ISHYIGA_ACCOUNT AS acc,
         LEAST(COUNT(*), 6) AS items_like_api
  FROM seller_add_stock s
  INNER JOIN picked p ON p.acc = s.SELLER_ISHYIGA_ACCOUNT
  WHERE s.QUANTITY > 0
    AND s.SALE_PRICE_INCLUSIVE > 0
  GROUP BY s.SELLER_ISHYIGA_ACCOUNT
)
SELECT COUNT(*) AS shops_on_card,
       COALESCE(SUM(items_like_api), 0) AS items_on_card
FROM per_seller;

-- ---------------------------------------------------------------------------
-- C) Show the sampled accounts (optional debug)
-- ---------------------------------------------------------------------------
WITH picked AS (
  SELECT DISTINCT s.SELLER_ISHYIGA_ACCOUNT AS acc
  FROM seller_add_stock s
  JOIN account_signup a ON a.ISHYIGA_ACCOUNT = s.SELLER_ISHYIGA_ACCOUNT
  WHERE s.QUANTITY > 0
    AND s.SALE_PRICE_INCLUSIVE > 0
    AND a.TYPE = 'SELLER'
    AND a.STATUS = 'LIVE'
    AND UPPER(COALESCE(a.PREFEREDCATEGORIES, '')) LIKE CONCAT('%', @sector_token, '%')
  ORDER BY RAND()
  LIMIT 5
)
SELECT p.acc,
       COUNT(*) AS stock_lines,
       LEAST(COUNT(*), 6) AS items_counted_like_ui
FROM seller_add_stock s
JOIN picked p ON p.acc = s.SELLER_ISHYIGA_ACCOUNT
WHERE s.QUANTITY > 0
  AND s.SALE_PRICE_INCLUSIVE > 0
GROUP BY p.acc;
