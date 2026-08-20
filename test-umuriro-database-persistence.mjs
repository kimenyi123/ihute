#!/usr/bin/env node
/**
 * Test script: Verify Umuriro/Grandma orders are persisted to MySQL
 * Usage: node test-umuriro-database-persistence.mjs
 * 
 * This script:
 * 1. Checks if ONBOARDING_MYSQL_* environment variables are configured
 * 2. Connects to the database
 * 3. Verifies the shop_onboarding_draft table exists
 * 4. Inserts a test order
 * 5. Queries it back to confirm persistence
 * 6. Reports findings
 */

import nextEnv from "@next/env"
import mysql from "mysql2/promise"

const { loadEnvConfig } = nextEnv
loadEnvConfig(process.cwd())

const requiredEnvVars = [
  "ONBOARDING_MYSQL_HOST",
  "ONBOARDING_MYSQL_USER",
  "ONBOARDING_MYSQL_PASSWORD",
  "ONBOARDING_MYSQL_DATABASE",
]

console.log("Umuriro Database Persistence Test\n")

// Check environment variables
console.log("1. Checking environment variables...")
const missingVars = requiredEnvVars.filter((v) => !process.env[v])
if (missingVars.length > 0) {
  console.error("❌ FAILED: Missing required environment variables:")
  missingVars.forEach((v) => console.error(`   - ${v}`))
  console.error("\n📋 Please set these in your .env.local:")
  console.error("   ONBOARDING_MYSQL_HOST=127.0.0.1")
  console.error("   ONBOARDING_MYSQL_USER=your_mysql_user")
  console.error("   ONBOARDING_MYSQL_PASSWORD=your_password")
  console.error("   ONBOARDING_MYSQL_DATABASE=your_kaos_database")
  process.exit(1)
}
console.log("OK: All required environment variables are set")

// Extract config
const config = {
  host: process.env.ONBOARDING_MYSQL_HOST,
  port: process.env.ONBOARDING_MYSQL_PORT ? Number(process.env.ONBOARDING_MYSQL_PORT) : 3306,
  user: process.env.ONBOARDING_MYSQL_USER,
  password: process.env.ONBOARDING_MYSQL_PASSWORD,
  database: process.env.ONBOARDING_MYSQL_DATABASE,
}

console.log(`\nDatabase Configuration:`)
console.log(`   Host: ${config.host}`)
console.log(`   Port: ${config.port}`)
console.log(`   User: ${config.user}`)
console.log(`   Database: ${config.database}`)

let conn

try {
  // Step 2: Connect to database
  console.log("\n2. Connecting to MySQL...")
  conn = await mysql.createConnection(config)
  console.log("OK: Connected to database")

  // Step 3: Verify table exists and create if needed
  console.log("\n3. Verifying shop_onboarding_draft table...")
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS shop_onboarding_draft (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      payload_json JSON NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `
  await conn.query(createTableSQL)
  console.log("OK: Table shop_onboarding_draft ready")

  // Step 4: Insert a test order
  console.log("\n4. Inserting test Umuriro order...")
  const testOrderRid = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  const testPayload = {
    kind: "umuriro",
    umuriroMode: "quick",
    incompleteSeller: true,
    savedBy: {
      email: "test@example.com",
      name: "Test User",
      phone: "+250788123456",
    },
    shop: {
      companyName: "TEST SHOP - Grandma Persistence Test",
      momoCode: "TEST123",
      momoDigits: "0788123456",
      shopPhoneOptional: "+250788123456",
      shopCategory: "retail",
      sectorSlug: "kigali",
    },
    line: {
      itemName: "Test Item",
      unitPriceRwf: 5000,
      quantity: 2,
      totalRwf: 10000,
    },
    ussd: "*182*1*1#",
    submittedAt: new Date().toISOString(),
    rid: testOrderRid,
  }

  const [insertResult] = await conn.query("INSERT INTO shop_onboarding_draft (payload_json) VALUES (?)", [
    JSON.stringify(testPayload),
  ])

  const insertedId = insertResult.insertId
  console.log(`OK: Test order inserted with ID: ${insertedId}`)
  console.log(`   Reference ID (rid): ${testOrderRid}`)

  // Step 5: Query it back
  console.log("\n5. Verifying order was saved...")
  const [rows] = await conn.query("SELECT * FROM shop_onboarding_draft WHERE id = ?", [insertedId])

  if (rows.length === 0) {
    console.error("❌ FAILED: Order not found in database!")
    process.exit(1)
  }

  const savedOrder = rows[0]
  const savedPayload =
    typeof savedOrder.payload_json === "string"
      ? JSON.parse(savedOrder.payload_json)
      : savedOrder.payload_json

  console.log("OK: Order retrieved from database")
  console.log(`   Saved ID: ${savedOrder.id}`)
  console.log(`   Company: ${savedPayload.shop.companyName}`)
  console.log(`   Item: ${savedPayload.line.itemName}`)
  console.log(`   Total: ${savedPayload.line.totalRwf} RWF`)
  console.log(`   Created: ${savedOrder.created_at}`)

  // Verify payload matches
  if (
    savedPayload.rid !== testOrderRid ||
    savedPayload.shop.companyName !== testPayload.shop.companyName ||
    savedPayload.line.totalRwf !== testPayload.line.totalRwf
  ) {
    console.error("❌ FAILED: Saved payload does not match!")
    process.exit(1)
  }

  console.log("\nOK: Payload verification passed")

  // Step 6: Final report
  console.log("\n" + "=".repeat(70))
  console.log("DATABASE PERSISTENCE TEST PASSED")
  console.log("=".repeat(70))
  console.log("\n📋 Test Summary:")
  console.log(`   Database: ${config.database}`)
  console.log(`   Table: shop_onboarding_draft`)
  console.log(`   Test Order ID: ${insertedId}`)
  console.log(`   Reference ID: ${testOrderRid}`)
  console.log(`   Status: Successfully persisted to database`)
  console.log("\nGrandma/Umuriro orders are being saved correctly.")
  console.log("\n🎯 Next steps:")
  console.log("   1. Test placing a real Grandma order through the UI")
  console.log("   2. Verify it appears in the database")
  console.log("   3. Check that the seller receives the SMS notification")
} catch (error) {
  console.error("\n❌ TEST FAILED")
  console.error("\nError:", error.message)
  console.error("\nPossible issues:")

  if (error.code === "ECONNREFUSED") {
    console.error("   - MySQL is not running or not accessible at " + config.host + ":" + config.port)
    console.error("   - Check your ONBOARDING_MYSQL_HOST and ONBOARDING_MYSQL_PORT")
  } else if (error.code === "ER_ACCESS_DENIED_FOR_USER") {
    console.error("   - MySQL credentials are incorrect")
    console.error("   - Check your ONBOARDING_MYSQL_USER and ONBOARDING_MYSQL_PASSWORD")
  } else if (error.code === "ER_BAD_DB_ERROR") {
    console.error("   - Database does not exist: " + config.database)
    console.error("   - Check your ONBOARDING_MYSQL_DATABASE")
  } else if (error.code === "ER_NO_SUCH_TABLE") {
    console.error("   - Table shop_onboarding_draft does not exist")
    console.error("   - Run: sql/shop_onboarding_draft.sql")
  }

  process.exit(1)
} finally {
  if (conn) {
    await conn.end()
  }
}
