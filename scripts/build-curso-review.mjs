/**
 * Builds cursoReviewIhute.csv from onboarding-IHUTE-assessment.csv
 * Run: node scripts/build-curso-review.mjs
 */
import fs from "fs"
import { fileURLToPath } from "url"
import { dirname, join } from "path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")
const src = join(root, "onboarding-IHUTE-assessment.csv")
const out = join(root, "cursoReviewIhute.csv")

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

/** Six extra columns per onboarding row (44 data rows) */
const extra = [
  [
    "Kaos.Structures.SignupServlet; supplier onboarding UI (Next)",
    "POST /SignupServlet; Next /api/auth/register",
    "No dedicated signup key; supplier_* may appear after catalog sync",
    "INSERT INTO account_signup (FIRSTNAME, LASTNAME, EMAIL, ...)",
    "78",
    "Medium — unify flows and fix failing forms before new features",
  ],
  [
    "Kaos.shopWithMe; app/shop-with-me (Next)",
    "GET /shop_with_me/*; Next /api/shop-with-me",
    "supplier_<shopAccount> JSON cache; see Kaos/shopWithMe.java",
    "Reads product JSON cached per supplier; DB via SupplierStock paths",
    "85",
    "Low — add stable share URLs and analytics",
  ],
  [
    "Kaos.SupplierStock; Next app/api/supplier/products",
    "Supplier stock servlet actions; /api/supplier/products/add-product",
    "After writes: jedis.setex(supplier_<account>, TTL, json)",
    "INSERT INTO seller stock tables (SupplierStock.TABLE_SELLER_STOCK)",
    "80",
    "Medium — enforce Grandma 30K rule in API if required",
  ],
  [
    "Kaos.SupplierStock; supplier product routes",
    "Same as add item; list and mutate endpoints",
    "supplier_<account>; supplier_size_<account>",
    "Same stock / item tables as add item",
    "80",
    "Low",
  ],
  [
    "Kaos.SupplierStock; components/shop-with-me.tsx",
    "shop_with_me payload includes image URLs",
    "supplier_* cache stores item images in JSON",
    "Item image columns in NiKi / seller stock schema",
    "72",
    "High — fix upload and broken thumbnails first",
  ],
  [
    "Kaos.SupplierStock; SupplierServlet",
    "Product list and update endpoints",
    "supplier_<account> invalidated on update",
    "SELECT / UPDATE against seller item tables",
    "75",
    "Medium — single edit screen",
  ],
  [
    "Not implemented as dedicated job; chaos_beta.niki_items",
    "NiKi ingest (batch or servlet TBD)",
    "No FMCG-specific key; generic supplier_* only",
    "ALTER chaos_beta.niki_items ADD FMCG flag; filter in sync SQL",
    "35",
    "High — design sync job and Grandma filter",
  ],
  [
    "Kaos.SupplierStock",
    "POST supplier stock API; Java SupplierStock",
    "jedis.setex(\"supplier_\"+account, TTL, wrapper)",
    "INSERT INTO seller stock table; see SupplierStock.java",
    "82",
    "Medium — add reservation at order time",
  ],
  [
    "components/product-card.tsx; checkout flow",
    "Next /api/post-orders or confirmPayment chain",
    "None for button itself; order data may cache elsewhere",
    "EETransaction / DbHandler.insertTransaction via post_orders",
    "88",
    "Low — WebView QA",
  ],
  [
    "lib/cart-store.ts; Kaos.UpdateCartServlet (if used)",
    "Next /api/cart/sync; optional Java cart servlet",
    "Cart sync may use user or session keys if configured in Kaos",
    "Persistent cart tables or Java cart handler as deployed",
    "85",
    "Medium — multi-seller checkout rules",
  ],
  [
    "Pharmacy eRx: lib/erx-prescription.ts; reorder: Kaos.re_order @WebServlet /api/reorder",
    "POST /api/reorder; eRx fields in cart payload",
    "Typically none specific to refill",
    "Reorder inserts depend on reorder servlet and order tables",
    "50",
    "High — clarify product scope then wire UI",
  ],
  [
    "Kaos.SupplierServlet; payment DashboardServlet",
    "Analytics endpoints; DownloadOrderExel optional",
    "supplier:<account>:stats:<dateRange>",
    "SELECT aggregates from orders / transactions",
    "70",
    "Medium — export CSV",
  ],
  [
    "Kaos.fetchSuggestions; app/api/global-search",
    "GET global-search; Java fetchSuggestions search",
    "supplier_*; inverted index keys inside fetchSuggestions; quick_code:*",
    "SELECT from indexed products + Redis overlay",
    "83",
    "Low — synonyms",
  ],
  [
    "app/api/categories; Kaos.fetchSuggestions sector filters",
    "GET /api/categories; fetchSuggestions with category/sector",
    "type_<sector>_* style caches in fetchSuggestions",
    "Static list in Next OR DB categories table when wired",
    "65",
    "High — replace static categories with DB",
  ],
  [
    "Kaos.SupplierLocationServlet; app/api/suppliers/nearest",
    "suppliers/nearest; account_distances logic",
    "Less common; distance computed often in SQL + geo",
    "SELECT suppliers with lat/lon; haversine or stored distance",
    "72",
    "Medium — map and sort by km",
  ],
  [
    "lib/favorites-store.ts; Kaos (no Redis for favorites in grep)",
    "Next /api/favorites/*",
    "Not found in Kaos favorites; may be DB-only user_preferences",
    "SELECT user favorites join products",
    "55",
    "Medium — scoped search",
  ],
  [
    "fetchSuggestions; global-search (sort not exposed)",
    "Same search API; needs sort=price_asc",
    "Price inside supplier_* JSON; sort in app layer",
    "ORDER BY price in SQL or sort JSON after fetch",
    "40",
    "High — add API parameter and UI",
  ],
  [
    "Kaos.fetchSuggestions (brand facets)",
    "fetchSuggestions with brand parameter",
    "Brand bucket keys in fetchSuggestions cache builder",
    "Filter WHERE brand = ? on items",
    "60",
    "Medium — index brand column",
  ],
  [
    "Kaos.SupplierLocationServlet; SellerSearchServlet",
    "suppliers/nearest; geolocation APIs",
    "supplier_*; geo mostly SQL",
    "ORDER BY distance",
    "58",
    "High — UX for closest-first",
  ],
  [
    "Kaos.Structures.LoginServlet; UserAuthServlet; Next auth",
    "POST /LoginServlet or /api/auth/login",
    "Session tokens sometimes cached; LOG: email pattern in insertrekizisiyo",
    "SELECT from accounts for login; account_signup insert for register",
    "70",
    "Critical — fix broken supplier/customer forms (row 41)",
  ],
  [
    "ishyiga_src.MoMoPaymentServlet; payment.PayNowServlet; confirmPayment route",
    "POST confirmPayment; MoMo payment servlets",
    "Payment dashboards may cache stats; not order-specific",
    "INSERT payment / transaction rows",
    "82",
    "Medium — auto-confirm pipeline",
  ],
  [
    "app/order-success/page.tsx",
    "Client route only",
    "None",
    "N/A front-only",
    "90",
    "Low — optional SMS",
  ],
  [
    "Kaos.post_orders; DbHandler.orderId",
    "Java post_orders (mapping in web.xml); EETransaction",
    "None for ID generation",
    "insertTransaction; checkIfExist by TRANSACTION_ID",
    "85",
    "Low — shorter display IDs",
  ],
  [
    "Next app/orders; Kaos order list servlets",
    "GET /api/orders; buyer order APIs",
    "Rare; list from DB",
    "SELECT orders WHERE buyer = ?",
    "78",
    "Medium — per-shop line clarity",
  ],
  [
    "Kaos.SellerOrdersServlet",
    "POST action=listSellerOrders; Next /api/seller-orders",
    "Optional cache; mostly SQL",
    "fetchOrdersForSeller SQL in SellerOrdersServlet",
    "80",
    "Medium — websocket or poll",
  ],
  [
    "Kaos.OrderStatusServlet; app/api/orders/update-status",
    "/api/order-status; OrderStatusServlet",
    "Invalidate order caches if any",
    "UPDATE order status",
    "78",
    "Medium — buyer push notification",
  ],
  [
    "Not a first-class servlet; seller order UI only",
    "Add tel: link in Next supplier order row",
    "None",
    "SELECT buyer phone from order",
    "45",
    "Medium — ship tel: in UI",
  ],
  [
    "Kaos.WishlistServlet uses Twilio for SMS elsewhere",
    "Twilio from WishlistServlet pattern; new thin endpoint",
    "None for SMS body",
    "N/A or log table",
    "40",
    "Medium — sms: URI or Twilio",
  ],
  [
    "Payment dashboard; seller order detail",
    "Existing payment APIs",
    "None specific",
    "SELECT payment metadata",
    "75",
    "Low — surface on card",
  ],
  [
    "app/grandma/page.tsx seller actions; SellerOrdersServlet status",
    "updateSellerOrderStatus; listSellerOrderItems",
    "None",
    "UPDATE order SET status",
    "80",
    "Low — parity on /supplier/orders",
  ],
  [
    "SellerOrdersServlet timestamps",
    "Order JSON created_at",
    "None",
    "SELECT order created_at / updated_at",
    "70",
    "Low — format in UI",
  ],
  [
    "Kaos.DeliveryCreateServlet; app/api/delivery/*",
    "/api/delivery/create, list",
    "Typically none for address text",
    "INSERT delivery_orders or equivalent",
    "75",
    "Medium — validation",
  ],
  [
    "Delivery status APIs; drivers module",
    "/api/delivery/* received status",
    "None",
    "UPDATE delivery status",
    "72",
    "Low — buyer tracking link",
  ],
  [
    "Driver phone in delivery record",
    "GET delivery detail",
    "None",
    "SELECT driver phone",
    "50",
    "Medium — show tel:",
  ],
  [
    "app/api/delivery/rate",
    "POST rate delivery",
    "None",
    "INSERT delivery_rating",
    "55",
    "Medium — prompt after delivery",
  ],
  [
    "Kaos.RatingServlet; order_ratings",
    "/Kaos/RatingServlet; Next /api/ratings",
    "Low usage in Redis for ratings",
    "INSERT supplier_rating / order_ratings",
    "58",
    "Medium — post-order prompt",
  ],
  [
    "app/api/products/rate",
    "POST /api/products/rate",
    "None",
    "INSERT product_rating",
    "55",
    "Medium — gate by purchase",
  ],
  [
    "payment.DashboardServlet; DashboardAnalyticsServlet",
    "Dashboard payout actions",
    "supplier:<account>:stats:*",
    "SELECT transactions for payout",
    "50",
    "High — clarify business rule",
  ],
  [
    "Kaos.TableCommandQRCodeServlet; table-commands APIs",
    "POST /api/table-commands/*",
    "Per-venue optional",
    "INSERT table_commands",
    "45",
    "High — product definition",
  ],
  [
    "SignupServlet; LoginServlet; UserAuthServlet",
    "SignupServlet; register routes",
    "None",
    "account_signup INSERT; login SELECT",
    "40",
    "Critical — backend errors first",
  ],
  [
    "DeliveryCreateServlet; ServiceAreaServlet",
    "delivery rate; service area",
    "None",
    "Pricing tables or fixed fee column",
    "35",
    "High — rules engine",
  ],
  [
    "B2B buy page; b2bApi.ts",
    "/supplier/b2b/api",
    "None",
    "B2B negotiation tables",
    "55",
    "Medium — scope module",
  ],
  [
    "payment.TransactionSyncServlet; sdc009000057_transaction",
    "EBM-specific sync servlet if deployed",
    "None",
    "SELECT sdc009000057_transaction",
    "30",
    "Low — documentation only until required",
  ],
  [
    "Kaos.WishlistServlet; Next favorites-store",
    "/WishlistServlet; /api/favorites",
    "WishlistServlet is SQL-heavy; Redis not required",
    "Wishlist tables; favorites merge in Next",
    "65",
    "Medium — align naming wishlist vs favorites",
  ],
]

const raw = fs.readFileSync(src, "utf8").replace(/^\uFEFF/, "")
const lines = raw.split(/\r?\n/)
while (lines.length && lines[lines.length - 1] === "") lines.pop()

if (extra.length !== lines.length - 1) {
  console.error("Expected", lines.length - 1, "extra rows, got", extra.length)
  process.exit(1)
}

const newHeader = [
  "Class names (Kaos / Next)",
  "API endpoint or servlet name",
  "Redis keys or usage (Kaos IHUTE_BCND)",
  "Representative SQL or table",
  "Readiness percent",
  "Fixing priority",
]

const outLines = []
for (let li = 0; li < lines.length; li++) {
  const cols = parseCsvLine(lines[li])
  if (li === 0) {
    outLines.push(rowToCsv(cols.concat(newHeader)))
    continue
  }
  outLines.push(rowToCsv(cols.concat(extra[li - 1])))
}

fs.writeFileSync(out, outLines.join("\r\n"), "utf8")
console.log("Wrote", out, "rows:", outLines.length)
