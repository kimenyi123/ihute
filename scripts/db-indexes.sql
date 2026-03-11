-- =============================================================================
-- IHUTE / Ishyiga – Recommended DB indexes for backend performance
-- =============================================================================
-- Run against your MySQL DB (seller_add_stock, account_signup, order_transaction, etc.).
-- Adapt table/column names if your schema differs. Use BTREE (MySQL default).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. seller_add_stock (supplier products – SupplierStock, search, personalization)
-- -----------------------------------------------------------------------------

-- Core: fetch/update by seller + item code
CREATE INDEX idx_seller_stock_account_code
  ON seller_add_stock (SELLER_ISHYIGA_ACCOUNT, ITEM_CODE);

-- Search by seller + name
CREATE INDEX idx_seller_stock_account_name
  ON seller_add_stock (SELLER_ISHYIGA_ACCOUNT, ITEM_NAME);

-- Lookup by item code (e.g. cross-seller search)
CREATE INDEX idx_seller_stock_code
  ON seller_add_stock (ITEM_CODE);

-- Category/family filters
CREATE INDEX idx_seller_stock_famille
  ON seller_add_stock (FAMILLE);

-- Full-text search on name, keywords, description (if supported)
-- CREATE FULLTEXT INDEX ft_seller_stock_keywords
--   ON seller_add_stock (ITEM_NAME, IMITERERE, item_french, item_keywords, DESCRIPTION);


-- -----------------------------------------------------------------------------
-- 2. account_signup (suppliers / buyers – InsertSuppliers, profile, GPS)
-- -----------------------------------------------------------------------------

CREATE INDEX idx_account_signup_account
  ON account_signup (ISHYIGA_ACCOUNT);

CREATE INDEX idx_account_signup_type_account
  ON account_signup (TYPE, ISHYIGA_ACCOUNT);

CREATE INDEX idx_account_signup_nickname
  ON account_signup (NICKNAME);

-- Optional: location-based queries
-- CREATE INDEX idx_account_signup_district_cell
--   ON account_signup (DISTRICT, SECTOR, CELL);


-- -----------------------------------------------------------------------------
-- 3. order_transaction (orders – buyer/seller lists, re_order servlet)
-- -----------------------------------------------------------------------------

-- Buyer’s orders, recent first
CREATE INDEX idx_orders_buyer_created
  ON order_transaction (BUYER_ISHYIGA_ACCOUNT, ID_ORDER DESC);

-- Seller’s orders (supplier dashboard)
CREATE INDEX idx_orders_seller_created
  ON order_transaction (SELLER_ISHYIGA_ACCOUNT, ID_ORDER DESC);

-- Status filters
CREATE INDEX idx_orders_status_buyer
  ON order_transaction (ORDER_STATUS, BUYER_ISHYIGA_ACCOUNT);

CREATE INDEX idx_orders_status_seller
  ON order_transaction (ORDER_STATUS, SELLER_ISHYIGA_ACCOUNT);

-- Lookup by order number
CREATE INDEX idx_orders_order_number
  ON order_transaction (order_number);


-- -----------------------------------------------------------------------------
-- 4. Order line items (adjust table name: order_items / order_product / order_detail)
-- -----------------------------------------------------------------------------

-- CREATE INDEX idx_order_items_order
--   ON order_items (ID_ORDER);
--
-- CREATE INDEX idx_order_items_seller_code
--   ON order_items (ITEM_CODE, SELLER_ISHYIGA_ACCOUNT);


-- -----------------------------------------------------------------------------
-- 5. Optional: interaction / recommendation / location cache tables
-- -----------------------------------------------------------------------------

-- Example: user interaction log
-- CREATE INDEX idx_interactions_user_time
--   ON interactions (user_id, created_at DESC);
--
-- CREATE INDEX idx_interactions_product_time
--   ON interactions (product_id, created_at DESC);

-- Example: supplier GPS
-- CREATE INDEX idx_supplier_gps_supplier
--   ON supplier_gps (supplier_id);
--
-- CREATE INDEX idx_supplier_gps_coords
--   ON supplier_gps (lat, lng);


-- =============================================================================
-- Notes:
-- - Drop duplicate indexes if they already exist: DROP INDEX index_name ON table_name;
-- - Verify with: EXPLAIN SELECT ... on your slow queries.
-- =============================================================================
