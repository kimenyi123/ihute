-- 1) Pharmacy sector: one row per seller — account id, display name, in-stock line count
--    Matches servlet filters: seller_add_stock + LIVE SELLER + PREFEREDCATEGORIES LIKE %PHARMACY%
--    Run against the same schema Tomcat uses (e.g. USE chaos_theta;).

SELECT
  s.SELLER_ISHYIGA_ACCOUNT AS seller_id,
  COALESCE(NULLIF(TRIM(a.OWNER), ''), s.SELLER_ISHYIGA_ACCOUNT) AS seller_name,
  COUNT(*) AS items_count
FROM seller_add_stock s
JOIN account_signup a ON a.ISHYIGA_ACCOUNT = s.SELLER_ISHYIGA_ACCOUNT
WHERE s.QUANTITY > 0
  AND s.SALE_PRICE_INCLUSIVE > 1
  AND a.TYPE = 'SELLER'
  AND a.STATUS = 'LIVE'
  AND UPPER(COALESCE(a.PREFEREDCATEGORIES, '')) LIKE '%PHARMACY%'
GROUP BY s.SELLER_ISHYIGA_ACCOUNT, a.OWNER
ORDER BY seller_name;
