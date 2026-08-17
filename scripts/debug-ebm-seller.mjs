/**
 * Local debug helper: print EBM invoice / notification rows for one seller.
 * Requires ONBOARDING_MYSQL_* in the environment (or .env.local via your shell).
 * Do not hardcode credentials in this file.
 *
 *   npx tsx scripts/debug-ebm-seller.mjs ALS834893728
 */
import mysql from "mysql2/promise"

const seller = process.argv[2] || "ALS834893728"
const host = process.env.ONBOARDING_MYSQL_HOST?.trim()
const user = process.env.ONBOARDING_MYSQL_USER?.trim()
const database = process.env.ONBOARDING_MYSQL_DATABASE?.trim()
const password = process.env.ONBOARDING_MYSQL_PASSWORD ?? ""
const portRaw = process.env.ONBOARDING_MYSQL_PORT?.trim()
const port = portRaw ? Number(portRaw) : 3306

if (!host || !user || !database) {
  console.error(
    "Set ONBOARDING_MYSQL_HOST, ONBOARDING_MYSQL_USER, and ONBOARDING_MYSQL_DATABASE (and PASSWORD) before running this script.",
  )
  process.exit(1)
}

const conn = await mysql.createConnection({
  host,
  port: Number.isFinite(port) && port > 0 ? port : 3306,
  user,
  password,
  database,
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
