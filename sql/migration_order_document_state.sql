-- Delivery note → invoice document columns on order_transaction.
-- Idempotent: skips columns that already exist (safe to re-run).

SET @db := DATABASE();

-- DOCUMENT_STATE
SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'order_transaction' AND COLUMN_NAME = 'DOCUMENT_STATE'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE order_transaction ADD COLUMN DOCUMENT_STATE VARCHAR(32) NOT NULL DEFAULT ''DELIVERY_NOTE'' COMMENT ''DELIVERY_NOTE | INVOICE_REQUESTED | INVOICED''',
  'SELECT ''DOCUMENT_STATE already exists'' AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- INVOICE_REQUESTED_AT
SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'order_transaction' AND COLUMN_NAME = 'INVOICE_REQUESTED_AT'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE order_transaction ADD COLUMN INVOICE_REQUESTED_AT DATETIME NULL COMMENT ''When buyer asked for invoice''',
  'SELECT ''INVOICE_REQUESTED_AT already exists'' AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- INVOICE_REQUESTED_BY
SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'order_transaction' AND COLUMN_NAME = 'INVOICE_REQUESTED_BY'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE order_transaction ADD COLUMN INVOICE_REQUESTED_BY VARCHAR(255) NULL COMMENT ''Buyer email/account who requested invoice''',
  'SELECT ''INVOICE_REQUESTED_BY already exists'' AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- INVOICED_AT
SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'order_transaction' AND COLUMN_NAME = 'INVOICED_AT'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE order_transaction ADD COLUMN INVOICED_AT DATETIME NULL COMMENT ''When seller issued invoice''',
  'SELECT ''INVOICED_AT already exists'' AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- SERVED_BY
SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'order_transaction' AND COLUMN_NAME = 'SERVED_BY'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE order_transaction ADD COLUMN SERVED_BY VARCHAR(255) NULL COMMENT ''Staff who fulfilled''',
  'SELECT ''SERVED_BY already exists'' AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- INVOICE_PDF_URL
SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'order_transaction' AND COLUMN_NAME = 'INVOICE_PDF_URL'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE order_transaction ADD COLUMN INVOICE_PDF_URL VARCHAR(512) NULL COMMENT ''URL or path to generated invoice PDF''',
  'SELECT ''INVOICE_PDF_URL already exists'' AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- EXTERNAL_LIV_ID (CIS livraison / bon id, e.g. LIV-896)
SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'order_transaction' AND COLUMN_NAME = 'EXTERNAL_LIV_ID'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE order_transaction ADD COLUMN EXTERNAL_LIV_ID VARCHAR(64) NULL COMMENT ''CIS livraison id e.g. LIV-896''',
  'SELECT ''EXTERNAL_LIV_ID already exists'' AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- CIS_INVOICE_META (JSON: MRC, invoice title/number, buyer TIN, etc. from CIS)
SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'order_transaction' AND COLUMN_NAME = 'CIS_INVOICE_META'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE order_transaction ADD COLUMN CIS_INVOICE_META TEXT NULL COMMENT ''JSON meta from CIS when bon becomes invoice''',
  'SELECT ''CIS_INVOICE_META already exists'' AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
