/**
 * Reads MySQL table dump files in Dump20260406 and writes ihute_db_admin_review.csv
 * Run: node scripts/build-dump-db-review-csv.mjs
 */
import fs from "fs"
import path from "path"

const DUMP_DIR = "C:/Users/kimai/OneDrive/Documents/dumps/Dump20260406"
const OUT = path.join(DUMP_DIR, "ihute_db_admin_review.csv")

function escapeCsv(s) {
  if (s == null || s === "") return ""
  const t = String(s)
  if (/[",\n\r]/.test(t)) return `"${t.replace(/"/g, '""')}"`
  return t
}

function extractTableName(filePath) {
  const base = path.basename(filePath, ".sql")
  if (base === "chaos_beta_routines") return { schema: "chaos_beta", name: "routines", isRoutine: true }
  const prefix = "chaos_beta_"
  if (!base.startsWith(prefix)) return { schema: "chaos_beta", name: base, isRoutine: false }
  return { schema: "chaos_beta", name: base.slice(prefix.length), isRoutine: false }
}

function fullTableName(t) {
  return `\`${t.schema}\`.\`${t.name}\``
}

function decide(t) {
  const n = t.name
  const lower = n.toLowerCase()

  if (t.isRoutine) {
    return {
      action: "KEEP",
      alter:
        "-- Not a table: review stored procedures/functions in chaos_beta_routines.sql; version-control and least privilege on DEFINER.",
      admin:
        "Treat routines as application code: deploy via migration pipeline, not ad hoc on prod. Audit for SQL injection and excessive permissions.",
    }
  }

  if (lower.includes("backup_") || /_\d{8}$/.test(lower)) {
    return {
      action: "DELETE",
      alter: `DROP TABLE IF EXISTS ${fullTableName(t)}; -- Run only after verifying data is archived or merged into primary table.`,
      admin:
        "Point-in-time backup table from naming. Confirm with app owners, export to archive, then drop to save space and avoid schema drift.",
    }
  }

  if (lower.endsWith("_temp") || lower.includes("_temp_")) {
    return {
      action: "DELETE",
      alter: `DROP TABLE IF EXISTS ${fullTableName(t)}; -- If ETL still needs it, replace with a proper staging schema.`,
      admin:
        "Temp tables in production are risky. Drop if unused; otherwise rename to a dated staging name and document the job that fills it.",
    }
  }

  if (lower === "missingdata") {
    return {
      action: "UPDATE",
      alter: `ALTER TABLE ${fullTableName(t)}
  ADD INDEX idx_missing_order (ORDER_ID),
  ADD INDEX idx_missing_seller (SELLER_ISHYIGA_ACCOUNT),
  ADD INDEX idx_heure (HEURE_NOW);`,
      admin:
        "Quarantine table for order line gaps (AUTO_INCREMENT already high). Add indexes for reconciliation jobs; archive rows older than N months or merge into canonical order lines after fix.",
    }
  }

  if (lower === "niki_items") {
    return {
      action: "UPDATE",
      alter: `ALTER TABLE ${fullTableName(t)} CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- Optional Grandma / FMCG (after app agreement):
-- ALTER TABLE ${fullTableName(t)} ADD COLUMN fmcg_eligible TINYINT(1) NOT NULL DEFAULT 0 AFTER status;
-- DROP INDEX niki_code_UNIQUE; -- redundant duplicate of PRIMARY KEY; verify app first`,
      admin:
        "Core NiKi catalog: keep. Latin1 should move to utf8mb4 for names and keywords. Remove redundant UNIQUE on niki_code if identical to PK. Coordinate FMCG flag with product team.",
    }
  }

  if (lower === "order_transaction" || lower === "order_transaction_list") {
    return {
      action: "KEEP",
      alter: `ALTER TABLE ${fullTableName(t)}
  ADD INDEX idx_buyer (BUYER_ISHYIGA_ACCOUNT),
  ADD INDEX idx_seller (SELLER_ISHYIGA_ACCOUNT),
  ADD INDEX idx_order_status (ORDER_STATUS),
  ADD INDEX idx_heure (heure);`,
      admin:
        "Core orders: keep. Add composite indexes matching Kaos query patterns (buyer/seller/status/time). Validate PAYMENT_STATUS and amounts with finance before any column type tightening.",
    }
  }

  if (lower === "buyer_logistic") {
    return {
      action: "KEEP",
      alter: `ALTER TABLE ${fullTableName(t)} ADD INDEX idx_buyer (BUYER_ISHYIGA_ACCOUNT); -- verify column name.`,
      admin:
        "Buyer delivery preferences / addresses: keep for checkout. Not the same as audit logs; index buyer key.",
    }
  }

  const isLogLike =
    lower.includes("audit") ||
    lower.includes("history") ||
    (lower.includes("_log") && !lower.includes("logistic")) ||
    lower.includes("logs") ||
    (lower.includes("log") && !lower.includes("logistic"))

  if (isLogLike) {
    return {
      action: "KEEP",
      alter: `ALTER TABLE ${fullTableName(t)} ADD INDEX idx_created (created_at); -- adjust column name if different; consider monthly partitions for large logs.`,
      admin:
        "Retention policy: archive or purge after N days. Indexes on time columns for reporting. Ensure PII is minimized in logs.",
    }
  }

  if (lower.includes("error") || lower === "sdc_error" || lower === "webhook_retries") {
    return {
      action: "KEEP",
      alter: `ALTER TABLE ${fullTableName(t)} ADD INDEX idx_created (created_at); -- purge job for resolved rows.`,
      admin:
        "Operational diagnostics: keep for incident response. Schedule cleanup so errors table does not grow unbounded.",
    }
  }

  if (lower.includes("search_history") || lower === "search_notification_history") {
    return {
      action: "UPDATE",
      alter: `ALTER TABLE ${fullTableName(t)} ADD INDEX idx_user_time (user_id, created_at); -- column names may vary; verify in dump.`,
      admin:
        "Search analytics: useful for personalization. GDPR-style retention: truncate or anonymize old rows.",
    }
  }

  if (lower === "cart" || lower.startsWith("cart_") || lower.includes("buyer_cart")) {
    return {
      action: "KEEP",
      alter: `ALTER TABLE ${fullTableName(t)} ADD INDEX idx_updated (updated_at); -- verify column names from dump.`,
      admin:
        "Cart state: keep. Ensure TTL or cleanup for abandoned sessions aligns with abandoned_cart_reminders.",
    }
  }

  if (lower.includes("payment") || lower.includes("urubuto") || lower.includes("payers")) {
    return {
      action: "KEEP",
      alter: `ALTER TABLE ${fullTableName(t)} ADD INDEX idx_status_created (status, created_at); -- adjust to actual columns.`,
      admin:
        "Financial data: strict backups, least-privilege DB users, no direct prod edits. Reconcile with MoMo/EBM exports.",
    }
  }

  if (lower.startsWith("sdc009000057") || lower === "pre_evat_transaction") {
    return {
      action: "KEEP",
      alter: "-- No structural change without EBM vendor guidance; add indexes only if reporting is slow.",
      admin:
        "EBM / fiscal integration tables: keep. Changes must follow RRA or device vendor rules; coordinate with finance before ALTER.",
    }
  }

  if (lower.includes("b2b")) {
    return {
      action: "KEEP",
      alter: `ALTER TABLE ${fullTableName(t)} ADD INDEX idx_status_updated (status, updated_at); -- if columns exist.`,
      admin:
        "B2B module: keep for wholesale flows. Optional: separate read replica for heavy reporting.",
    }
  }

  if (lower.includes("special_deal") || lower === "special_deals" || lower === "deals" || lower === "new_deals") {
    return {
      action: "UPDATE",
      alter:
        "-- If special_deals duplicates special_deal: merge or document one canonical table; avoid two sources of truth.",
      admin:
        "Marketing deals: consolidate naming (special_deal vs special_deals). DBA should confirm which table the app writes to.",
    }
  }

  if (lower.includes("favorite") || lower === "wishlist") {
    return {
      action: "KEEP",
      alter: `ALTER TABLE ${fullTableName(t)} ADD UNIQUE KEY uq_user_item (user_id, item_id); -- adjust column names.`,
      admin:
        "Favorites/wishlist: align with product (single user-facing list). Prevent duplicate rows with a unique constraint.",
    }
  }

  if (lower.includes("driver") || lower.includes("delivery") || lower === "vehicles") {
    return {
      action: "KEEP",
      alter: `ALTER TABLE ${fullTableName(t)} ADD INDEX idx_active_location (status, updated_at); -- tune to schema.`,
      admin:
        "Logistics: keep for rider flows. Location tables may grow fast; partition or archive by month if needed.",
    }
  }

  if (lower.includes("rating") || lower.includes("order_ratings") || lower === "product_ratings") {
    return {
      action: "KEEP",
      alter: `ALTER TABLE ${fullTableName(t)} ADD INDEX idx_order (order_id); -- if column exists.`,
      admin:
        "Ratings: keep. Moderation tables should link to user and order for abuse handling.",
    }
  }

  if (lower.includes("notification")) {
    return {
      action: "KEEP",
      alter: `ALTER TABLE ${fullTableName(t)} ADD INDEX idx_user_sent (user_id, sent_at); -- verify columns.`,
      admin:
        "Notification history: retention and deduplication; coordinate with notification_fatigue rules.",
    }
  }

  if (
    lower.includes("top_") ||
    lower.includes("stats") ||
    lower.includes("daily_income") ||
    lower.includes("income_data")
  ) {
    return {
      action: "UPDATE",
      alter:
        "-- Materialized or summary tables: document rebuild job; consider refreshing via cron not manual SQL.",
      admin:
        "Summary/top tables: keep if app reads them; otherwise candidate to replace with views or nightly job output.",
    }
  }

  if (lower === "account_signup") {
    return {
      action: "KEEP",
      alter: `ALTER TABLE ${fullTableName(t)} ADD INDEX idx_email (EMAIL); ADD INDEX idx_tel (TEL);`,
      admin:
        "Signup master data: critical PII. Encrypt backups; index email and phone used by auth.",
    }
  }

  if (lower === "account_distances") {
    return {
      action: "KEEP",
      alter: `ALTER TABLE ${fullTableName(t)} ADD INDEX idx_account (account_id); -- verify PK/FK column names from dump.`,
      admin:
        "Distance cache between accounts: keep for nearest-shop UX. Refresh strategy if coordinates change often.",
    }
  }

  if (lower.includes("table_command") || lower === "table_commands") {
    return {
      action: "KEEP",
      alter: `ALTER TABLE ${fullTableName(t)} ADD INDEX idx_venue_status (supplier_account, status); -- tune names.`,
      admin:
        "Venue table ordering: keep for restaurant flows; separate from Grandma retail if product splits apps.",
    }
  }

  // default: core operational
  return {
    action: "KEEP",
    alter:
      `-- Review indexes on foreign-style keys (seller, buyer, order_id) and timestamps; CONVERT TO utf8mb4 if still latin1.`,
    admin:
      "Standard chaos_beta table: keep unless product confirms deprecation. Run pt-online-schema-change for large ALTERs in production.",
  }
}

function main() {
  const files = fs.readdirSync(DUMP_DIR).filter((f) => f.endsWith(".sql")).sort()
  const rows = [
    [
      "table_name",
      "keep_delete_update",
      "alter_sql_or_notes",
      "message_to_database_administrator",
    ],
  ]

  for (const f of files) {
    const t = extractTableName(path.join(DUMP_DIR, f))
    const fq = `${t.schema}.${t.name}`
    const d = decide(t)
    rows.push([fq, d.action, d.alter, d.admin])
  }

  const csv = rows.map((r) => r.map(escapeCsv).join(",")).join("\r\n")
  fs.writeFileSync(OUT, csv, "utf8")
  console.log("Wrote", OUT, "rows:", rows.length)
}

main()
