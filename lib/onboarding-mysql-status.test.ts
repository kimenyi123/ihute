/**
 * Presence-only MySQL config status (no secrets).
 * Run: npx tsx --test lib/onboarding-mysql-status.test.ts
 */
import test from "node:test"
import assert from "node:assert/strict"
import {
  getOnboardingMysqlConfig,
  getOnboardingMysqlConfigStatus,
} from "./onboarding-mysql"

const KEYS = [
  "ONBOARDING_MYSQL_HOST",
  "ONBOARDING_MYSQL_PORT",
  "ONBOARDING_MYSQL_USER",
  "ONBOARDING_MYSQL_PASSWORD",
  "ONBOARDING_MYSQL_DATABASE",
  "EBM_MYSQL_HOST",
  "EBM_MYSQL_USER",
  "EBM_MYSQL_PASSWORD",
  "EBM_MYSQL_DATABASE",
  "FORGOT_PASSWORD_MYSQL_HOST",
  "FORGOT_PASSWORD_MYSQL_USER",
  "FORGOT_PASSWORD_MYSQL_PASSWORD",
  "FORGOT_PASSWORD_MYSQL_DATABASE",
  "SUPPLIER_STOCK_MYSQL_HOST",
  "SUPPLIER_STOCK_MYSQL_USER",
  "SUPPLIER_STOCK_MYSQL_PASSWORD",
  "SUPPLIER_STOCK_MYSQL_DATABASE",
  "GQ_MYSQL_HOST",
  "GQ_MYSQL_USER",
  "GQ_MYSQL_PASSWORD",
  "GQ_MYSQL_DATABASE",
  "MYSQL_HOST",
  "MYSQL_USER",
  "MYSQL_PASSWORD",
  "MYSQL_DATABASE",
  "DB_URL",
  "DB_USER",
  "DB_PASS",
] as const

function snapshotEnv(): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {}
  for (const k of KEYS) out[k] = process.env[k]
  return out
}

function restoreEnv(snap: Record<string, string | undefined>): void {
  for (const k of KEYS) {
    if (snap[k] === undefined) delete process.env[k]
    else process.env[k] = snap[k]
  }
}

function clearMysqlEnv(): void {
  for (const k of KEYS) delete process.env[k]
}

test("status reports missing when no MySQL namespace is set", () => {
  const snap = snapshotEnv()
  try {
    clearMysqlEnv()
    const status = getOnboardingMysqlConfigStatus()
    assert.equal(getOnboardingMysqlConfig(), null)
    assert.equal(status.configured, false)
    assert.equal(status.source, null)
    assert.equal(status.onboardingMysql.host, "missing")
    assert.equal(status.onboardingMysql.user, "missing")
    assert.equal(status.onboardingMysql.database, "missing")
    assert.equal(status.onboardingMysql.port, "default")
    assert.equal(status.onboardingMysql.password, "missing")
    assert.equal(status.gqMysql.host, "missing")
    assert.equal(status.kaosJdbc.url, "missing")
    const json = JSON.stringify(status)
    assert.equal(json.includes("secret"), false)
    assert.equal(/:\d{2,}/.test(json), false)
  } finally {
    restoreEnv(snap)
  }
})

test("HOST+USER+DATABASE is enough; empty password is present; PORT defaults", () => {
  const snap = snapshotEnv()
  try {
    clearMysqlEnv()
    process.env.ONBOARDING_MYSQL_HOST = "127.0.0.1"
    process.env.ONBOARDING_MYSQL_USER = "app_user"
    process.env.ONBOARDING_MYSQL_DATABASE = "app_schema"
    process.env.ONBOARDING_MYSQL_PASSWORD = ""
    const cfg = getOnboardingMysqlConfig()
    const status = getOnboardingMysqlConfigStatus()
    assert.ok(cfg)
    assert.equal(cfg?.database, "app_schema")
    assert.equal(status.configured, true)
    assert.equal(status.source, "ONBOARDING_MYSQL")
    assert.equal(status.onboardingMysql.host, "present")
    assert.equal(status.onboardingMysql.user, "present")
    assert.equal(status.onboardingMysql.database, "present")
    assert.equal(status.onboardingMysql.port, "default")
    assert.equal(status.onboardingMysql.password, "present")
    const json = JSON.stringify(status)
    assert.equal(json.includes("app_schema"), false)
    assert.equal(json.includes("app_user"), false)
    assert.equal(json.includes("127.0.0.1"), false)
  } finally {
    restoreEnv(snap)
  }
})

test("MYSQL_* fallback is used when ONBOARDING_MYSQL_* is incomplete", () => {
  const snap = snapshotEnv()
  try {
    clearMysqlEnv()
    process.env.ONBOARDING_MYSQL_HOST = "127.0.0.1"
    process.env.MYSQL_HOST = "127.0.0.1"
    process.env.MYSQL_USER = "app_user"
    process.env.MYSQL_DATABASE = "app_schema"
    const status = getOnboardingMysqlConfigStatus()
    assert.equal(status.configured, true)
    assert.equal(status.source, "MYSQL")
    assert.equal(status.onboardingMysql.user, "missing")
    assert.equal(status.onboardingMysql.database, "missing")
  } finally {
    restoreEnv(snap)
  }
})

test("GQ_MYSQL_* fallback is used when ONBOARDING_MYSQL_* is absent", () => {
  const snap = snapshotEnv()
  try {
    clearMysqlEnv()
    process.env.GQ_MYSQL_HOST = "127.0.0.1"
    process.env.GQ_MYSQL_USER = "gq_user"
    process.env.GQ_MYSQL_DATABASE = "gq_schema"
    process.env.GQ_MYSQL_PASSWORD = "not-a-real-secret"
    const cfg = getOnboardingMysqlConfig()
    const status = getOnboardingMysqlConfigStatus()
    assert.ok(cfg)
    assert.equal(cfg?.database, "gq_schema")
    assert.equal(cfg?.user, "gq_user")
    assert.equal(status.configured, true)
    assert.equal(status.source, "GQ_MYSQL")
    assert.equal(status.gqMysql.host, "present")
    assert.equal(status.gqMysql.user, "present")
    assert.equal(status.gqMysql.database, "present")
    const json = JSON.stringify(status)
    assert.equal(json.includes("gq_schema"), false)
    assert.equal(json.includes("gq_user"), false)
    assert.equal(json.includes("not-a-real-secret"), false)
  } finally {
    restoreEnv(snap)
  }
})

test("ONBOARDING_MYSQL_* takes precedence over GQ_MYSQL_*", () => {
  const snap = snapshotEnv()
  try {
    clearMysqlEnv()
    process.env.ONBOARDING_MYSQL_HOST = "127.0.0.1"
    process.env.ONBOARDING_MYSQL_USER = "onb_user"
    process.env.ONBOARDING_MYSQL_DATABASE = "onb_schema"
    process.env.GQ_MYSQL_HOST = "10.0.0.1"
    process.env.GQ_MYSQL_USER = "gq_user"
    process.env.GQ_MYSQL_DATABASE = "gq_schema"
    const cfg = getOnboardingMysqlConfig()
    const status = getOnboardingMysqlConfigStatus()
    assert.equal(cfg?.database, "onb_schema")
    assert.equal(cfg?.user, "onb_user")
    assert.equal(status.source, "ONBOARDING_MYSQL")
  } finally {
    restoreEnv(snap)
  }
})

test("DB_URL + DB_USER + DB_PASS fallback matches kaos JDBC shape", () => {
  const snap = snapshotEnv()
  try {
    clearMysqlEnv()
    process.env.DB_URL = "jdbc:mysql://127.0.0.1:3306/app_schema?useSSL=false"
    process.env.DB_USER = "jdbc_user"
    process.env.DB_PASS = "not-a-real-secret"
    const cfg = getOnboardingMysqlConfig()
    const status = getOnboardingMysqlConfigStatus()
    assert.ok(cfg)
    assert.equal(cfg?.host, "127.0.0.1")
    assert.equal(cfg?.port, 3306)
    assert.equal(cfg?.database, "app_schema")
    assert.equal(cfg?.user, "jdbc_user")
    assert.equal(status.configured, true)
    assert.equal(status.source, "DB_URL")
    assert.equal(status.kaosJdbc.url, "present")
    assert.equal(status.kaosJdbc.user, "present")
    assert.equal(status.kaosJdbc.password, "present")
    const json = JSON.stringify(status)
    assert.equal(json.includes("app_schema"), false)
    assert.equal(json.includes("jdbc_user"), false)
    assert.equal(json.includes("not-a-real-secret"), false)
    assert.equal(json.includes("jdbc:mysql"), false)
  } finally {
    restoreEnv(snap)
  }
})
