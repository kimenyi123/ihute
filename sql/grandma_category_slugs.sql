-- Grandma category slugs (documentation only — additive, no DML).
-- Categories are stored as strings on:
--   chaos_dev.account_signup.PREFEREDCATEGORIES
--   chaos_dev.account_seller.preferedcategories
-- There is no separate category ID table. Application id == slug.
--
-- Existing (do not rename):
--   boutique, supermarket, pharmacy, restaurant, liquor-store, coffee-shop, veterinary, others
-- New (store these kebab-case values on new seller rows):
--   electronics, home-supplies, building-materials, auto-parts
--
-- Java fetchSuggestions.getCategoryTokensFromSlug default-uppercases unknown slugs,
-- so LIKE '%ELECTRONICS%' / '%HOME-SUPPLIES%' works without a Java WAR change.
-- Grandma MySQL search uses LOWER(PREFEREDCATEGORIES) LIKE '%slug%'.

SELECT 'grandma category slugs are application-defined; no schema change required' AS note;
