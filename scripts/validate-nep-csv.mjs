/**
 * Quick check: each District should map to exactly one Province in the NEP CSV.
 * Run: node scripts/validate-nep-csv.mjs [path-to-csv]
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function parseCSVLine(line) {
  const out = []
  let cur = ""
  let q = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (q) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          q = false
        }
      } else {
        cur += c
      }
    } else {
      if (c === '"') q = true
      else if (c === ",") {
        out.push(cur)
        cur = ""
      } else cur += c
    }
  }
  out.push(cur)
  return out
}

const csvPath =
  process.argv[2] ||
  path.join(__dirname, "..", "data", "FINAL_LIST_OF_REVISED_NEP_VILLAGES_JULY_2023-PUBLISHED.csv")

if (!fs.existsSync(csvPath)) {
  console.error("CSV not found:", csvPath)
  process.exit(1)
}

const text = fs.readFileSync(csvPath, "utf8")
const lines = text.split(/\r?\n/).filter((l) => l.trim())
const d2p = new Map()

for (let i = 1; i < lines.length; i++) {
  const cols = parseCSVLine(lines[i])
  if (cols.length < 4) continue
  const prov = (cols[1] || "").trim()
  const dist = (cols[2] || "").trim()
  if (!dist || !prov) continue
  if (!d2p.has(dist)) d2p.set(dist, new Set())
  d2p.get(dist).add(prov)
}

const bad = [...d2p.entries()].filter(([, s]) => s.size > 1)
console.log("Districts with multiple provinces:", bad.length)
bad.slice(0, 30).forEach(([d, s]) => console.log(d, [...s]))
process.exit(bad.length ? 1 : 0)
