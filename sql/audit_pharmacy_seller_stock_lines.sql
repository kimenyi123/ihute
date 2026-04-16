-- 2) Pharmacy sector: one row per stock line — seller, item name, stock, code
--    nikicode uses ITEM_CODE (same as servlet getSellerProducts). If you have NIKI_CODE on seller_add_stock, use:
--    COALESCE(NULLIF(TRIM(s.NIKI_CODE),''), s.ITEM_CODE) AS nikicode
--    Run against the same schema Tomcat uses (e.g. USE chaos_theta;).

SELECT
  COALESCE(NULLIF(TRIM(a.OWNER), ''), s.SELLER_ISHYIGA_ACCOUNT) AS seller_name,
  s.ITEM_NAME AS item_name,
  s.QUANTITY AS stock_qty,
  s.ITEM_CODE AS nikicode
FROM seller_add_stock s
JOIN account_signup a ON a.ISHYIGA_ACCOUNT = s.SELLER_ISHYIGA_ACCOUNT
WHERE s.QUANTITY > 0
  AND s.SALE_PRICE_INCLUSIVE > 1
  AND a.TYPE = 'SELLER'
  AND a.STATUS = 'LIVE'
  AND UPPER(COALESCE(a.PREFEREDCATEGORIES, '')) LIKE '%PHARMACY%'
ORDER BY seller_name, s.ITEM_NAME;
