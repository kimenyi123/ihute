import mysql from "mysql2/promise"

const cfg = {
  host: process.env.ONBOARDING_MYSQL_HOST || "64.225.66.239",
  port: Number(process.env.ONBOARDING_MYSQL_PORT || 3306),
  user: process.env.ONBOARDING_MYSQL_USER || "algodev",
  password: process.env.ONBOARDING_MYSQL_PASSWORD || "",
  database: process.env.ONBOARDING_MYSQL_DATABASE || "chaos_beta",
}

const VISTA_ACCOUNT = "ALG0000472001"
const VISTA_LAT = -1.9450592407323903
const VISTA_LNG = 30.107185309445597

const conn = await mysql.createConnection(cfg)

const [existing] = await conn.query(
  `SELECT ISHYIGA_ACCOUNT FROM account_signup WHERE ISHYIGA_ACCOUNT = ?`,
  [VISTA_ACCOUNT],
)
console.log("signup exists?", existing.length > 0)

const [seller] = await conn.query(`SELECT * FROM account_seller WHERE ishyiga_account = ?`, [VISTA_ACCOUNT])
const s = seller[0]
if (!s) throw new Error("Vista seller row missing")

await conn.query(
  `UPDATE account_seller
   SET supplier_latitude = ?, supplier_longitude = ?, gps_last_updated = NOW(), location_source = 'MANUAL'
   WHERE ishyiga_account = ?`,
  [VISTA_LAT, VISTA_LNG, VISTA_ACCOUNT],
)
console.log("updated account_seller GPS")

if (!existing.length) {
  const [templateRows] = await conn.query(
    `SELECT * FROM account_signup
     WHERE TYPE='SELLER' AND STATUS='LIVE' AND PREFEREDCATEGORIES LIKE '%pharm%'
     LIMIT 1`,
  )
  const t = templateRows[0]
  if (!t) throw new Error("No pharmacy signup template")

  await conn.query(
    `INSERT INTO account_signup (
       FIRSTNAME, LASTNAME, EMAIL, PWD, TEL, HQ_LOCATION, TIN, OWNER, ISHYIGA_ACCOUNT,
       TYPE, LANGUAGE, PREFEREDCATEGORIES, STATUS, DEPARTMENT, currency, momo,
       nickname, prefered_seller_nickname, loc_cell, supplier_latitude, supplier_longitude,
       location_source, gps_last_updated, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'SELLER', ?, ?, 'LIVE', ?, ?, ?, ?, ?, ?, ?, ?, 'MANUAL', NOW(), NOW())`,
    [
      s.firstname || "VISTA",
      s.lastname || "PHARMACY LTD",
      s.email,
      s.pwd_hash,
      s.tel,
      s.hq_location,
      s.tin,
      s.owner,
      VISTA_ACCOUNT,
      s.language || "KIN",
      s.preferedcategories || "pharmacy",
      s.department || "pharmacy",
      s.currency || "RWF",
      s.momo,
      s.nickname || s.owner,
      s.nickname || s.owner,
      "Umujyi wa Kigali · Gasabo · Kimironko · Kibagabaga · Rindiro · KG AVENUE 11",
      VISTA_LAT,
      VISTA_LNG,
    ],
  )
  console.log("inserted account_signup for Vista")
} else {
  await conn.query(
    `UPDATE account_signup
     SET supplier_latitude = ?, supplier_longitude = ?, gps_last_updated = NOW(), location_source = 'MANUAL',
         STATUS = 'LIVE', TYPE = 'SELLER', PREFEREDCATEGORIES = COALESCE(PREFEREDCATEGORIES, 'pharmacy')
     WHERE ISHYIGA_ACCOUNT = ?`,
    [VISTA_LAT, VISTA_LNG, VISTA_ACCOUNT],
  )
  console.log("updated account_signup GPS")
}

const [check] = await conn.query(
  `SELECT DISTINCT s.SELLER_ISHYIGA_ACCOUNT AS ACC, a.OWNER
   FROM seller_add_stock s
   JOIN account_signup a ON a.ISHYIGA_ACCOUNT = s.SELLER_ISHYIGA_ACCOUNT
   WHERE s.SELLER_ISHYIGA_ACCOUNT = ? AND s.QUANTITY > 0 AND s.SALE_PRICE_INCLUSIVE > 1
     AND a.TYPE = 'SELLER' AND a.STATUS = 'LIVE'`,
  [VISTA_ACCOUNT],
)
console.log("Vista now in sector SQL?", check)

await conn.end()
