/**
 * Builds cursoReviewIhuteGrandma.csv from cursoReviewIhute.csv
 * Adds column: Grandma app guidance (keep / add / remove / hide)
 * Appends rows for Grandma-only functionalities not in the source sheet.
 * Run: node scripts/build-curso-review-grandma.mjs
 */
import fs from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")
const src = join(root, "cursoReviewIhute.csv")
const out = join(root, "cursoReviewIhuteGrandma.csv")

function parseCsvLine(line) {
  const out = []
  let cur = ""
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQ = false
        }
      } else {
        cur += c
      }
    } else {
      if (c === '"') inQ = true
      else if (c === ",") {
        out.push(cur)
        cur = ""
      } else cur += c
    }
  }
  out.push(cur)
  return out
}

function escapeField(s) {
  if (s == null) return ""
  const t = String(s)
  if (/[",\n\r]/.test(t)) return `"${t.replace(/"/g, '""')}"`
  return t
}

function rowToCsv(cols) {
  return cols.map(escapeField).join(",")
}

/** One line per data row (44 rows), after header */
const grandmaByRow = [
  "Hide from Grandma buyer app: seller onboarding only; keep in seller tools.",
  "Keep: core public browse path; ensure large tap targets and stable shop link.",
  "Seller-only: enforce NiKi rules; hide complexity from Grandma buyer.",
  "Seller-only: same as add item.",
  "Keep: large product photos and prices are essential for Grandma; fix broken images first.",
  "Seller-only: catalog edit.",
  "Add: only FMCG-tagged NiKi items should appear in Grandma catalog; critical filter.",
  "Keep: show Available / Out of stock clearly; avoid fake availability.",
  "Keep: primary fast path; ensure one-tap works in WebView.",
  "Keep: simple add/remove; show which shop each line belongs to.",
  "Hide or rename: pharmacy Refill jargon confuses general Grandma; use Order again if needed.",
  "Remove from Grandma: seller analytics; keep in seller dashboard app only.",
  "Keep: simple name search; hide advanced filters on first screen.",
  "Add: tap category then see list of shops (not only products); reduces wrong shop.",
  "Keep: default nearest shop + map or sorted list; core Grandma need.",
  "Add: search within favorites; hide duplicate Wishlist naming in Grandma.",
  "Hide behind More: cheapest sort is optional; not default for Grandma.",
  "Hide behind More: brand filter is power-user; not default.",
  "Keep: closest-first is default priority; improve prominence and km display.",
  "Keep: minimal signup; fix broken forms before any Grandma campaign.",
  "Keep: MoMo / Cash with plain labels; one sentence on fees if variable.",
  "Keep: full-screen Order received; large text.",
  "Keep: simple order ID; large font on confirmation.",
  "Add: every line item must show shop name and logo; fixes multi-shop confusion.",
  "Seller-only: seller order list; optional lightweight view if same app.",
  "Keep: big status chips for seller preparing orders for Grandma buyers.",
  "Add: one-tap Call buyer on order row (tel:).",
  "Add: optional SMS; keep simple preset message.",
  "Keep: MoMo code visible to seller on order card.",
  "Keep: large Accept / Reject; primary Grandma seller flow.",
  "Keep: show order time clearly (relative + clock).",
  "Keep: short address text; optional landmark field for riders.",
  "Keep: simple Out for delivery status for trust.",
  "Add: show rider phone + call when assigned.",
  "Optional: rate driver after delivery; hide if too many steps.",
  "Optional: rate shop; one screen after order.",
  "Optional: rate product; do not block reorder.",
  "Remove from Grandma: payout/katuruza; seller finance only.",
  "Remove from Grandma: table/B2B commands; venue-only.",
  "Critical: fix signup before pushing Grandma; block broken paths.",
  "Keep: show delivery price rule in one plain sentence on confirm.",
  "Remove from Grandma: B2B procurement; not buyer Grandma.",
  "Remove from Grandma: EBM integration; back-office only.",
  "Merge: use Favorites only in Grandma; remove or hide Wishlist duplicate.",
]

/** Extra rows: same column count as header (23 after add). Template: 22 empty-ish + grandma text — we use 23 cols with last = grandma */
/** Each row: 23 columns (0–22). Col 20 readiness %, 21 fixing priority, 22 Grandma guidance */
const grandmaOnlyRows = [
  [
    "",
    "",
    "Grandma-only",
    "Default journey: nearest shop first",
    "",
    "",
    "BUYER",
    "Not in original onboarding sheet",
    "1",
    "NEW",
    "NEW",
    "",
    "",
    "",
    "Add: open app → detect location → list closest shops → big photos → cart → pay.",
    "Implement as default tab and sort on /grandma",
    "",
    "",
    "",
    "",
    "65",
    "High",
    "Add: make this the first screen; reduce steps to first purchase.",
  ],
  [
    "",
    "",
    "Grandma-only",
    "Cart line: shop name + logo on every item",
    "",
    "",
    "BUYER",
    "Reduces wrong-shop confusion",
    "1",
    "NEW",
    "NEW",
    "",
    "",
    "",
    "Required for multi-seller cart clarity",
    "Bold shop name per line in cart and confirmation",
    "lib/cart-store.ts; cart UI",
    "N/A",
    "N/A",
    "JOIN order_items supplier",
    "70",
    "High",
    "Add: enforce display in cart-summary and order-success.",
  ],
  [
    "",
    "",
    "Grandma-only",
    "Large typography and contrast",
    "",
    "",
    "BUYER",
    "Accessibility",
    "1",
    "NEW",
    "NEW",
    "",
    "",
    "",
    "Base font scale and high contrast theme for Grandma route",
    "CSS theme or Tailwind tokens on /grandma",
    "app/grandma",
    "N/A",
    "N/A",
    "N/A",
    "50",
    "High",
    "Add: Grandma theme tokens; test on small phones.",
  ],
  [
    "",
    "",
    "Grandma-only",
    "Capacitor shell: minimal navigation",
    "",
    "",
    "BUYER",
    "Single-app focus",
    "2",
    "NEW",
    "NEW",
    "",
    "",
    "",
    "Hide global features not needed for ordering",
    "Capacitor config + deep link only to /grandma",
    "capacitor.config.ts",
    "N/A",
    "N/A",
    "N/A",
    "55",
    "Medium",
    "Hide: reduce tabs; hide B2B/kiosk entry points.",
  ],
  [
    "",
    "",
    "Grandma-only",
    "Plain-language errors (Kinyarwanda / French)",
    "",
    "",
    "BUYER",
    "Trust",
    "2",
    "NEW",
    "NEW",
    "",
    "",
    "",
    "Replace technical messages near checkout",
    "lib/translations or copy map",
    "Next error boundaries",
    "N/A",
    "N/A",
    "N/A",
    "40",
    "Medium",
    "Add: reviewed copy for payment and network failures.",
  ],
  [
    "",
    "",
    "Grandma-only",
    "Remove: B2B / EBM / table / kiosk from shell",
    "",
    "",
    "SYSTEM",
    "Scope reduction",
    "3",
    "N/A",
    "REMOVE",
    "",
    "",
    "",
    "Not shown in Grandma Capacitor build or feature flag",
    "Feature flag GRANDMA_MODE hides routes",
    "Next middleware or layout",
    "N/A",
    "N/A",
    "N/A",
    "60",
    "High",
    "Remove: route guards; keep IHUTE main for staff.",
  ],
  [
    "",
    "",
    "Grandma-only",
    "Remove: developer and Redis debug UI",
    "",
    "",
    "SYSTEM",
    "Safety",
    "4",
    "N/A",
    "REMOVE",
    "",
    "",
    "",
    "No internal keys or logs visible to users",
    "Strip in production Grandma build",
    "N/A",
    "N/A",
    "N/A",
    "N/A",
    "80",
    "Low",
    "Remove: any debug panels from /grandma.",
  ],
]

const raw = fs.readFileSync(src, "utf8").replace(/^\uFEFF/, "")
const lines = raw.split(/\r?\n/)
while (lines.length && lines[lines.length - 1] === "") lines.pop()

const headerCols = parseCsvLine(lines[0])
if (headerCols.length !== 22) {
  console.error("Expected 22 columns in source header, got", headerCols.length)
  process.exit(1)
}

const newHeader = headerCols.concat(["Grandma app guidance (keep / add / remove / hide)"])

const outLines = [rowToCsv(newHeader)]

for (let li = 1; li < lines.length; li++) {
  const cols = parseCsvLine(lines[li])
  if (cols.length !== 22) {
    console.warn("Row", li, "column count", cols.length, "expected 22")
  }
  const g = grandmaByRow[li - 1]
  if (!g) {
    console.error("Missing grandma text for row", li)
    process.exit(1)
  }
  while (cols.length < 22) cols.push("")
  outLines.push(rowToCsv(cols.slice(0, 22).concat([g])))
}

grandmaOnlyRows.forEach((row, idx) => {
  if (row.length !== 23) {
    console.error("Bad extra row", idx, "length", row.length)
    process.exit(1)
  }
  outLines.push(rowToCsv(row))
})

fs.writeFileSync(out, outLines.join("\r\n"), "utf8")
console.log("Wrote", out, "rows:", outLines.length)
