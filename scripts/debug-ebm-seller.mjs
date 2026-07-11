import mysql from "mysql2/promise"

const seller = process.argv[2] || "ALS834893728"
const conn = await mysql.createConnection({
  host: process.env.ONBOARDING_MYSQL_HOST || "64.225.66.239",
  port: Number(process.env.ONBOARDING_MYSQL_PORT || 3306),
  user: process.env.ONBOARDING_MYSQL_USER || "algodev",
  password: process.env.ONBOARDING_MYSQL_PASSWORD || "AlgoCloud2050##@@!!2009",
  database: process.env.ONBOARDING_MYSQL_DATABASE || "chaos_test",
  connectTimeout: 10000,
})

const [ebm] = await conn.query(
  `SELECT order_id, seller_account, ebm_status, invoice_number, updated_at
   FROM ebm_invoices ORDER BY order_id DESC LIMIT 30`,
)
console.log("ebm_invoices:", JSON.stringify(ebm, null, 2))

const [notif] = await conn.query(
  `SELECT noti_id, order_number, seller, buyer, action, icyabaye
   FROM notification WHERE action='REQUEST_EBM' ORDER BY order_number DESC LIMIT 30`,
)
console.log("notifications:", JSON.stringify(notif, null, 2))

const [pending] = await conn.query(
  `SELECT DISTINCT e.order_id, e.seller_account, e.ebm_status
   FROM ebm_invoices e
   WHERE e.ebm_status IN ('pending','success')
   ORDER BY e.order_id DESC LIMIT 30`,
)
console.log("pending/success rows:", JSON.stringify(pending, null, 2))

const [forSeller] = await conn.query(
  `SELECT e.order_id, e.seller_account, e.ebm_status, n.seller AS notif_seller, n.icyabaye
   FROM ebm_invoices e
   LEFT JOIN notification n ON n.order_number = e.order_id AND n.action = 'REQUEST_EBM'
   WHERE UPPER(TRIM(COALESCE(e.seller_account,''))) = UPPER(TRIM(?))
      OR UPPER(TRIM(n.seller)) = UPPER(TRIM(?))
   ORDER BY e.order_id DESC`,
  [seller, seller],
)
console.log(`for seller ${seller}:`, JSON.stringify(forSeller, null, 2))

const sellerMatch = `UPPER(TRIM(COALESCE(e.seller_account, ''))) = UPPER(TRIM(?))`
const unread = `(n.icyabaye IS NULL OR n.icyabaye != 'READ' OR n.icyabaye = 'UNREAD')`
const [repoSuccess] = await conn.query(
  `SELECT e.order_id
   FROM ebm_invoices e
   WHERE e.ebm_status = 'success'
     AND (
       ${sellerMatch}
       OR EXISTS (
         SELECT 1 FROM notification n
         WHERE n.order_number = e.order_id
           AND n.action = 'REQUEST_EBM'
           AND UPPER(TRIM(n.seller)) = UPPER(TRIM(?))
       )
     )
   ORDER BY e.order_id DESC LIMIT 500`,
  [seller, seller],
)
const [stateRows] = await conn.query(
  `SELECT e.order_id, e.ebm_status
   FROM ebm_invoices e
   WHERE e.ebm_status IN ('pending', 'retry', 'success')
     AND (
       ${sellerMatch}
       OR EXISTS (
         SELECT 1 FROM notification n
         WHERE n.order_number = e.order_id
           AND n.action = 'REQUEST_EBM'
           AND UPPER(TRIM(n.seller)) = UPPER(TRIM(?))
       )
     )
   ORDER BY e.order_id DESC LIMIT 500`,
  [seller, seller],
)
console.log("combined state:", stateRows)
console.log("repo listSuccess:", repoSuccess)

await conn.end()
