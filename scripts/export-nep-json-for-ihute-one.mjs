/**
 * Writes rwanda-nep-hierarchy data to IHUTE_ONE static JS folder as JSON.
 * Run from master: node scripts/export-nep-json-for-ihute-one.mjs
 */
import { writeFileSync, mkdirSync } from "fs"
import { dirname, resolve } from "path"
import { fileURLToPath } from "url"
import { DISTRICT_CELLS, SECTOR_CELLULES, CELLULE_VILLAGES } from "../lib/rwanda-nep-hierarchy.ts"

const __dirname = dirname(fileURLToPath(import.meta.url))
const out = resolve(__dirname, "../../../IHUTE_ONE/src/main/resources/static/js/rwanda-nep-data.json")
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, JSON.stringify({ DISTRICT_CELLS, SECTOR_CELLULES, CELLULE_VILLAGES }))
console.log("Wrote", out)
