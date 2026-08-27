/**
 * Run: npx tsx --test lib/onboarding-db-error.test.ts
 */
import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { classifyOnboardingDbError, friendlyOnboardingDbError } from "./onboarding-db-error"
import { pickUmuriroSaveDbError } from "./seller-register-i18n"

test("persist uses connectTimeout via toMysqlConnectionOptions", () => {
  const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "onboarding-draft-persist.ts"), "utf8")
  assert.match(src, /toMysqlConnectionOptions/)
  assert.doesNotMatch(src, /createConnection\(cfg\)/)
})

test("classifies missing table", () => {
  assert.equal(classifyOnboardingDbError(new Error("ER_NO_SUCH_TABLE: shop_onboarding_draft")), "db_table_missing")
  assert.equal(classifyOnboardingDbError("Table 'chaos_dev.shop_onboarding_draft' doesn't exist"), "db_table_missing")
})

test("classifies unreachable MySQL from code and message", () => {
  assert.equal(classifyOnboardingDbError({ code: "ETIMEDOUT", message: "connect ETIMEDOUT" }), "db_unreachable")
  assert.equal(classifyOnboardingDbError({ code: "ECONNREFUSED", message: "connect ECONNREFUSED" }), "db_unreachable")
  assert.equal(classifyOnboardingDbError(new Error("connect ETIMEDOUT 203.0.113.10:3306")), "db_unreachable")
})

test("classifies missing env and generic errors", () => {
  assert.equal(classifyOnboardingDbError(new Error("ONBOARDING_MYSQL_* is not configured")), "db_not_configured")
  assert.equal(classifyOnboardingDbError(new Error("ER_ACCESS_DENIED_FOR_USER")), "db_error")
  assert.equal(classifyOnboardingDbError(new Error("Invalid JSON text")), "db_invalid")
})

test("friendly English strings stay stable for the UI mapper", () => {
  assert.match(friendlyOnboardingDbError({ code: "ETIMEDOUT", message: "connect ETIMEDOUT" }, "king-paris"), /database unreachable/)
  assert.match(friendlyOnboardingDbError(new Error("doesn't exist"), "king-paris"), /table missing/)
})

test("pickUmuriroSaveDbError maps codes to localized copy", () => {
  assert.equal(
    pickUmuriroSaveDbError("en", "db_unreachable", "Quick Shop: could not save \"king-paris\" — database unreachable."),
    "Could not reach the order database from this computer. Check that MySQL port 3306 is open, or use a host this PC can reach.",
  )
  assert.match(pickUmuriroSaveDbError("rw", "db_unreachable", ""), /database y/)
  assert.match(pickUmuriroSaveDbError("rw", "db_table_missing", ""), /shop_onboarding_draft/)
  assert.match(pickUmuriroSaveDbError("en", undefined, "Quick Shop: could not save \"x\". Try again"), /try again/i)
})
