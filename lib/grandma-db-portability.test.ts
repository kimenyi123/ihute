import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

const GRANDMA_RUNTIME = [
  "lib/grandma-search-mysql.ts",
  "lib/grandma-seller-gps-persist.ts",
  "lib/onboarding-mysql.ts",
  "app/api/grandma/search/route.ts",
  "app/api/grandma/sellers/route.ts",
  "scripts/check-onboarding-mysql-env.ts",
]

const FORBIDDEN_DB_NAMES = ["chaos_dev", "chaos_theta", "ihute_dev", "chaos_test", "chaos_beta"]

test("Grandma runtime does not hardcode database names", () => {
  for (const rel of GRANDMA_RUNTIME) {
    const text = fs.readFileSync(path.join(root, rel), "utf8")
    for (const name of FORBIDDEN_DB_NAMES) {
      assert.equal(
        text.includes(`"${name}"`) || text.includes(`'${name}'`) || text.includes("`" + name + "`"),
        false,
        `${rel} must not hardcode database ${name}`,
      )
    }
  }
})

test(".env.dev.example does not pin a Kaos schema name", () => {
  const text = fs.readFileSync(path.join(root, ".env.dev.example"), "utf8")
  for (const name of FORBIDDEN_DB_NAMES) {
    assert.equal(
      new RegExp(`^ONBOARDING_MYSQL_DATABASE=${name}\\s*$`, "m").test(text),
      false,
      `.env.dev.example must not assign ONBOARDING_MYSQL_DATABASE=${name}`,
    )
  }
  assert.match(text, /^ONBOARDING_MYSQL_HOST=/m)
  assert.match(text, /^ONBOARDING_MYSQL_USER=/m)
  assert.match(text, /^ONBOARDING_MYSQL_DATABASE=/m)
  assert.match(text, /^ONBOARDING_MYSQL_PORT=/m)
})
