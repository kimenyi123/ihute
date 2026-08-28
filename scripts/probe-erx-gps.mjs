import mysql from "mysql2/promise"

const cfg = {
  host: process.env.ONBOARDING_MYSQL_HOST || "64.225.66.239",
  port: Number(process.env.ONBOARDING_MYSQL_PORT || 3306),
  user: process.env.ONBOARDING_MYSQL_USER || "algodev",
  password: process.env.ONBOARDING_MYSQL_PASSWORD || "",
  database: process.env.ONBOARDING_MYSQL_DATABASE || "chaos_beta",
}

const conn = await mysql.createConnection(cfg)

const [cols] = await conn.query(
  `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
   FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'account_signup'
   ORDER BY ORDINAL_POSITION`,
)
console.log("account_signup columns", cols.length)

const [sample] = await conn.query(
  `SELECT * FROM account_signup
   WHERE TYPE='SELLER' AND STATUS='LIVE' AND PREFEREDCATEGORIES LIKE '%pharm%'
   LIMIT 1`,
)
console.log("sample pharmacy signup keys", sample[0] ? Object.keys(sample[0]) : [])

const [seller] = await conn.query(`SELECT * FROM account_seller WHERE ishyiga_account='ALG0000472001'`)
console.log("vista seller row", seller[0])

await conn.end()
