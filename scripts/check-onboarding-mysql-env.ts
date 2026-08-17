/**
 * Presence-only MySQL env check for Grandma Search. Never prints secrets or values.
 *
 *   npx tsx scripts/check-onboarding-mysql-env.ts
 *
 * Loads .env then .env.local from cwd (does not overwrite non-empty process env).
 */
import fs from "node:fs"
import path from "node:path"
import { getOnboardingMysqlConfigStatus } from "../lib/onboarding-mysql"

function stripQuotes(raw: string): string {
  const v = raw.trim()
  if (
    (v.startsWith('"') && v.endsWith('"') && v.length >= 2) ||
    (v.startsWith("'") && v.endsWith("'") && v.length >= 2)
  ) {
    return v.slice(1, -1)
  }
  return v
}

function readEnvText(filePath: string): string {
  const buf = fs.readFileSync(filePath)
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) return buf.toString("utf16le")
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return buf.slice(3).toString("utf8")
  }
  const utf8 = buf.toString("utf8")
  if (utf8.includes("\u0000")) return buf.toString("utf16le").replace(/^\uFEFF/, "")
  return utf8
}

function loadEnvFile(filePath: string): string[] {
  if (!fs.existsSync(filePath)) return []
  const loaded: string[] = []
  const text = readEnvText(filePath)
  for (const line of text.split(/\r\n|\n|\r/)) {
    let trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    if (trimmed.startsWith("export ")) trimmed = trimmed.slice("export ".length).trim()
    const eq = trimmed.indexOf("=")
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue
    loaded.push(key)
    if (process.env[key]?.trim()) continue
    process.env[key] = stripQuotes(trimmed.slice(eq + 1))
  }
  return loaded
}

const cwd = process.cwd()
const loadedFiles: string[] = []
const keysFromFiles: string[] = []
for (const name of [".env", ".env.local"] as const) {
  const keys = loadEnvFile(path.join(cwd, name))
  if (keys.length || fs.existsSync(path.join(cwd, name))) {
    if (fs.existsSync(path.join(cwd, name))) loadedFiles.push(name)
    keysFromFiles.push(...keys)
  }
}

const status = getOnboardingMysqlConfigStatus()
const onboardingKeys = keysFromFiles.filter((k) => k.startsWith("ONBOARDING_MYSQL_"))
console.log(
  JSON.stringify({
    ...status,
    envFiles: loadedFiles,
    onboardingKeysInFiles: [...new Set(onboardingKeys)],
  }),
)
process.exit(status.configured ? 0 : 1)
