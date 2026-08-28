import mysql from "mysql2/promise"

const c = await mysql.createConnection({
  host: process.env.ONBOARDING_MYSQL_HOST || "64.225.66.239",
  user: process.env.ONBOARDING_MYSQL_USER || "algodev",
  password: process.env.ONBOARDING_MYSQL_PASSWORD || "",
  database: process.env.ONBOARDING_MYSQL_DATABASE || "chaos_beta",
})

const [seller] = await c.query(
  `SELECT id, ishyiga_account, OWNER, nickname, status, preferedcategories, certificate, rating_star,
          supplier_latitude, supplier_longitude
   FROM account_seller
   WHERE ishyiga_account = 'ALG000004103' OR nickname LIKE '%mediasol%' OR OWNER LIKE '%MEDIASOL%'`,
)
console.log("account_seller", seller)

const [signup] = await c.query(
  `SELECT ISHYIGA_ACCOUNT, OWNER, nickname, STATUS, TYPE, PREFEREDCATEGORIES, certificate, rating_star
   FROM account_signup
   WHERE ISHYIGA_ACCOUNT = 'ALG000004103' OR nickname LIKE '%mediasol%' OR OWNER LIKE '%MEDIASOL%'`,
)
console.log("account_signup", signup)

const acc = seller[0]?.ishyiga_account || "ALG000004103"
const [stock] = await c.query(
  `SELECT COUNT(*) AS cnt, SUM(CASE WHEN QUANTITY>0 AND SALE_PRICE_INCLUSIVE>1 THEN 1 ELSE 0 END) AS qualifying
   FROM seller_add_stock WHERE SELLER_ISHYIGA_ACCOUNT = ?`,
  [acc],
)
console.log("stock", stock[0])

const [sector] = await c.query(
  `SELECT DISTINCT s.SELLER_ISHYIGA_ACCOUNT AS acc, a.OWNER, a.STATUS, a.TYPE
   FROM seller_add_stock s
   JOIN account_signup a ON a.ISHYIGA_ACCOUNT = s.SELLER_ISHYIGA_ACCOUNT
   WHERE s.SELLER_ISHYIGA_ACCOUNT = ?
     AND s.QUANTITY > 0 AND s.SALE_PRICE_INCLUSIVE > 1
     AND a.TYPE = 'SELLER' AND a.STATUS = 'LIVE'`,
  [acc],
)
console.log("sectorListSuppliers would include?", sector)

await c.end()
