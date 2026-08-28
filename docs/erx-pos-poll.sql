-- MoH eRx POS poll — chaos_beta
-- After patient RFQ, post_orders inserts one row per selected pharmacy.
-- UI order_number example: IH-182196-ALS213389822
--   = {rfqOrderId}-{seller_ishyiga_account}

-- 1) Pending orders for ONE pharmacy (main POS poll)
SELECT
  t.id_order,
  t.order_number,
  t.seller_ishyiga_account,
  t.seller_names,
  t.buyer_ishyiga_account,
  t.buyer_names,
  t.order_status,
  t.amount,
  t.heure,
  t.conditions,
  t.PAYMENT_NAME
FROM chaos_beta.order_transaction t
WHERE t.seller_ishyiga_account = 'ALS213389822'   -- ← pharmacy Ishyiga account
  AND t.buyer_ishyiga_account = 'IHUTE'
  AND t.order_status = 'OPEN'
ORDER BY t.id_order DESC
LIMIT 50;

-- 2) Line items for one pending order
SELECT
  l.id_order,
  l.item_code,
  l.item_name,
  l.niki_code,
  l.quantity,
  l.REQUEST_PRICE,
  l.conditions
FROM chaos_beta.order_transaction_list l
WHERE l.id_order = 12345;   -- ← id_order from query (1)

-- 3) Fetch by exact order_number from eRx UI / insert response
SELECT
  t.*,
  l.item_name,
  l.quantity,
  l.REQUEST_PRICE
FROM chaos_beta.order_transaction t
LEFT JOIN chaos_beta.order_transaction_list l ON l.id_order = t.id_order
WHERE t.order_number = 'IH-182196-ALS213389822';

-- 4) All eRx RFQ batch for one patient order (both pharmacies)
SELECT *
FROM chaos_beta.order_transaction
WHERE order_number LIKE 'IH-182196-%'
ORDER BY id_order DESC;

-- POS poll filter: buyer_ishyiga_account='IHUTE', order_status='OPEN', REFERENCE=eRx code.
-- Patient: BUYER_NAMES + BUYER_PHONE from MoH (USER_INITIATOR + PATIENT_PHONE_NUMBER in XML).
-- eRx POS: CONDITIONS='ERX|SEARCH_IN_COMPANY' — match ITEM_NAME in seller stock, not fixed NIKI.
-- Line conditions='SEARCH' when item_code starts with ERX_.
