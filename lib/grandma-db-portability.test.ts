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
