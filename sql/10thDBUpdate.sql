-- =============================================================================
-- IHUTE — 10th DB update (consolidated)
-- MySQL 8.0+ · InnoDB · utf8mb4_unicode_ci
--
-- Covers UI/backend work for:
--   • Seller / buyer / rider registration flows (JSON-first where noted)
--   • Onboarding drafts: crazy-shopping + Umuriro (`kind` inside payload_json)
--   • Umuriro seller SMS (Twilio/webhook) — audit table ready for API wiring
--   • Full rider profile schema (aligned with components/rider-register-form.tsx)
--
-- Run against the same database as ONBOARDING_MYSQL_DATABASE / app DB.
-- Safe to re-run: CREATE TABLE IF NOT EXISTS throughout.
--
-- Payload notes (no extra columns required):
--   Umuriro JSON includes: kind, rid, savedBy, policy.createdBy + policy.adjustmentRwf (100 RWF),
--   shop (companyName, momo…, shopPhoneOptional, …), line, ussd, submittedAt.
--   SMS text is not persisted by the Node route today; optional `umuriro_sms_outbound.sms_body`.
--
-- Seller stock onboarding still expects legacy table `seller_add_stock` (Java / chaos_theta schema);
--   not recreated here — use your main schema dump if missing.
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------------
-- 1) shop_onboarding_draft — INSERT from:
--      app/api/onboarding/crazy-shopping/route.ts
--      app/api/onboarding/umuriro/route.ts
--    Filter in app by JSON: $.kind = 'umuriro' | seller payload keys as implemented.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `shop_onboarding_draft` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `payload_json` JSON NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_shop_onboarding_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Full JSON snapshots: Umuriro, crazy-shopping seller onboarding, etc.';

-- ---------------------------------------------------------------------------
-- 2) umuriro_sms_outbound — audit trail for SMS to seller (+250…).
--    Optional: INSERT from app/api/onboarding/umuriro/route.ts after sendSms().
--    Until wired, table stays empty; delivery still works without DB logging.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `umuriro_sms_outbound` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `request_id` CHAR(36) NOT NULL COMMENT 'UUID rid returned by POST /api/onboarding/umuriro',
  `to_e164` VARCHAR(24) DEFAULT NULL COMMENT 'Normalized seller mobile e.g. +2507xxxxxxxx',
  `sent_ok` TINYINT(1) NOT NULL DEFAULT 0,
  `provider` VARCHAR(32) DEFAULT NULL COMMENT 'twilio | webhook | none',
  `error_message` VARCHAR(512) DEFAULT NULL,
  `sms_body` MEDIUMTEXT NULL COMMENT 'Optional full text for compliance / support',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_umuriro_sms_request` (`request_id`),
  KEY `idx_umuriro_sms_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Umuriro Kinyarwanda SMS to shop phone — audit';

-- ---------------------------------------------------------------------------
-- 3) Riders — full schema (was sql/riders.sql). Link riders.email to account_signup in app layer.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `riders` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `email` VARCHAR(255) NOT NULL COMMENT 'Login email (may match account_signup.EMAIL)',
  `phone` VARCHAR(50) NOT NULL COMMENT 'Primary mobile (E.164 or local 250…)',
  `status` ENUM(
    'draft',
    'submitted',
    'under_review',
    'approved',
    'rejected',
    'suspended',
    'active'
  ) NOT NULL DEFAULT 'draft',
  `completion_percent` TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '0–100 weighted profile completion',
  `registration_source` VARCHAR(64) DEFAULT 'web' COMMENT 'web, app, rider.ihute.rw, …',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_riders_email` (`email`),
  KEY `idx_riders_phone` (`phone`),
  KEY `idx_riders_status` (`status`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Rider master record';

CREATE TABLE IF NOT EXISTS `rider_registration_draft` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `rider_id` BIGINT UNSIGNED NOT NULL,
  `payload_json` JSON NOT NULL COMMENT 'Full client form state (RiderFormState)',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_rider_draft_rider` (`rider_id`, `created_at`),
  CONSTRAINT `fk_rider_draft_rider` FOREIGN KEY (`rider_id`) REFERENCES `riders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Append-only or latest draft snapshots';

CREATE TABLE IF NOT EXISTS `rider_identity` (
  `rider_id` BIGINT UNSIGNED NOT NULL,
  `legal_full_name` VARCHAR(255) DEFAULT NULL,
  `preferred_display_name` VARCHAR(255) DEFAULT NULL,
  `date_of_birth` DATE DEFAULT NULL,
  `gender` ENUM('female', 'male', 'other', 'prefer_not') DEFAULT NULL,
  `nationality` VARCHAR(64) DEFAULT NULL,
  `national_id_number` VARCHAR(64) DEFAULT NULL,
  `id_document_type` ENUM('national_id', 'passport', 'refugee', 'other') DEFAULT NULL,
  `id_issue_date` DATE DEFAULT NULL,
  `id_expiry_date` DATE DEFAULT NULL,
  `id_photo_front_path` VARCHAR(512) DEFAULT NULL,
  `id_photo_back_path` VARCHAR(512) DEFAULT NULL,
  `selfie_photo_path` VARCHAR(512) DEFAULT NULL,
  `marital_status` VARCHAR(64) DEFAULT NULL,
  `languages_json` JSON DEFAULT NULL COMMENT 'e.g. {"rw":true,"en":true,"fr":false}',
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`rider_id`),
  CONSTRAINT `fk_rider_identity_rider` FOREIGN KEY (`rider_id`) REFERENCES `riders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `rider_contact` (
  `rider_id` BIGINT UNSIGNED NOT NULL,
  `primary_mobile` VARCHAR(50) DEFAULT NULL,
  `secondary_mobile` VARCHAR(50) DEFAULT NULL,
  `whatsapp_number` VARCHAR(50) DEFAULT NULL,
  `contact_email` VARCHAR(255) DEFAULT NULL,
  `emergency_name` VARCHAR(255) DEFAULT NULL,
  `emergency_relationship` VARCHAR(128) DEFAULT NULL,
  `emergency_phone` VARCHAR(50) DEFAULT NULL,
  `emergency_address` TEXT,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`rider_id`),
  CONSTRAINT `fk_rider_contact_rider` FOREIGN KEY (`rider_id`) REFERENCES `riders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `rider_security` (
  `rider_id` BIGINT UNSIGNED NOT NULL,
  `password_hash` VARCHAR(255) DEFAULT NULL COMMENT 'bcrypt/argon2 — never plain text',
  `pin_hash` VARCHAR(255) DEFAULT NULL,
  `two_factor_preference` ENUM('sms', 'app', 'none') DEFAULT 'none',
  `recovery_email` VARCHAR(255) DEFAULT NULL,
  `recovery_phone` VARCHAR(50) DEFAULT NULL,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`rider_id`),
  CONSTRAINT `fk_rider_security_rider` FOREIGN KEY (`rider_id`) REFERENCES `riders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `rider_address` (
  `rider_id` BIGINT UNSIGNED NOT NULL,
  `residential_province` VARCHAR(128) DEFAULT NULL,
  `residential_district` VARCHAR(128) DEFAULT NULL,
  `residential_sector` VARCHAR(128) DEFAULT NULL,
  `residential_cell` VARCHAR(128) DEFAULT NULL,
  `residential_village` VARCHAR(128) DEFAULT NULL,
  `residential_street` VARCHAR(255) DEFAULT NULL,
  `residential_landmark` VARCHAR(255) DEFAULT NULL,
  `mailing_same_as_residential` TINYINT(1) NOT NULL DEFAULT 1,
  `mailing_address` TEXT,
  `gps_lat` DECIMAL(10, 7) DEFAULT NULL,
  `gps_lng` DECIMAL(10, 7) DEFAULT NULL,
  `map_pin_label` VARCHAR(128) DEFAULT NULL,
  `delivery_zones` TEXT COMMENT 'Free text or JSON list',
  `areas_refuse` TEXT,
  `cross_district_willing` ENUM('yes', 'no') DEFAULT NULL,
  `cross_district_which` VARCHAR(255) DEFAULT NULL,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`rider_id`),
  CONSTRAINT `fk_rider_address_rider` FOREIGN KEY (`rider_id`) REFERENCES `riders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `rider_vehicle` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `rider_id` BIGINT UNSIGNED NOT NULL,
  `is_primary` TINYINT(1) NOT NULL DEFAULT 1,
  `delivery_mode` ENUM('foot', 'bicycle', 'motorcycle', 'car') DEFAULT NULL,
  `vehicle_category` VARCHAR(128) DEFAULT NULL,
  `make` VARCHAR(128) DEFAULT NULL,
  `model` VARCHAR(128) DEFAULT NULL,
  `year` SMALLINT UNSIGNED DEFAULT NULL,
  `color` VARCHAR(64) DEFAULT NULL,
  `plate_number` VARCHAR(32) DEFAULT NULL,
  `registration_doc_number` VARCHAR(128) DEFAULT NULL,
  `registration_expiry` DATE DEFAULT NULL,
  `vehicle_photo_front_path` VARCHAR(512) DEFAULT NULL,
  `vehicle_photo_side_path` VARCHAR(512) DEFAULT NULL,
  `vehicle_photo_plate_path` VARCHAR(512) DEFAULT NULL,
  `engine_cc` SMALLINT UNSIGNED DEFAULT NULL,
  `fuel_type` VARCHAR(64) DEFAULT NULL,
  `helmet_owned` VARCHAR(32) DEFAULT NULL,
  `helmet_photo_path` VARCHAR(512) DEFAULT NULL,
  `reflective_vest` VARCHAR(32) DEFAULT NULL,
  `phone_mount` VARCHAR(32) DEFAULT NULL,
  `thermal_bag` VARCHAR(32) DEFAULT NULL,
  `odometer_reading` INT UNSIGNED DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_rider_vehicle_rider` (`rider_id`),
  CONSTRAINT `fk_rider_vehicle_rider` FOREIGN KEY (`rider_id`) REFERENCES `riders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `rider_license` (
  `rider_id` BIGINT UNSIGNED NOT NULL,
  `driving_license_number` VARCHAR(64) DEFAULT NULL,
  `driving_license_class` VARCHAR(32) DEFAULT NULL,
  `driving_license_issue` DATE DEFAULT NULL,
  `driving_license_expiry` DATE DEFAULT NULL,
  `license_photo_front_path` VARCHAR(512) DEFAULT NULL,
  `license_photo_back_path` VARCHAR(512) DEFAULT NULL,
  `moto_taxi_permit` VARCHAR(128) DEFAULT NULL,
  `municipal_permit_number` VARCHAR(128) DEFAULT NULL,
  `insurance_provider` VARCHAR(128) DEFAULT NULL,
  `insurance_policy_number` VARCHAR(128) DEFAULT NULL,
  `insurance_coverage_type` VARCHAR(128) DEFAULT NULL,
  `insurance_expiry` DATE DEFAULT NULL,
  `insurance_document_path` VARCHAR(512) DEFAULT NULL,
  `roadworthiness_sticker` VARCHAR(128) DEFAULT NULL,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`rider_id`),
  CONSTRAINT `fk_rider_license_rider` FOREIGN KEY (`rider_id`) REFERENCES `riders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `rider_payout` (
  `rider_id` BIGINT UNSIGNED NOT NULL,
  `payout_method` ENUM('momo', 'airtel', 'bank', 'cash') DEFAULT NULL,
  `mtn_momo` VARCHAR(50) DEFAULT NULL,
  `mtn_momo_name_on_account` VARCHAR(255) DEFAULT NULL,
  `airtel_money` VARCHAR(50) DEFAULT NULL,
  `bank_name` VARCHAR(128) DEFAULT NULL,
  `bank_branch` VARCHAR(128) DEFAULT NULL,
  `bank_account_name` VARCHAR(255) DEFAULT NULL,
  `bank_account_number` VARCHAR(64) DEFAULT NULL,
  `bank_iban_swift` VARCHAR(128) DEFAULT NULL,
  `mobile_money_registered_name` VARCHAR(255) DEFAULT NULL,
  `tax_id_tin` VARCHAR(64) DEFAULT NULL,
  `withholding_vat_status` VARCHAR(128) DEFAULT NULL,
  `currency_preference` VARCHAR(8) DEFAULT 'RWF',
  `payout_frequency` ENUM('daily', 'weekly', 'monthly') DEFAULT NULL,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`rider_id`),
  CONSTRAINT `fk_rider_payout_rider` FOREIGN KEY (`rider_id`) REFERENCES `riders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `rider_availability` (
  `rider_id` BIGINT UNSIGNED NOT NULL,
  `availability_type` ENUM('full', 'part', 'occasional') DEFAULT NULL,
  `work_days_json` JSON DEFAULT NULL COMMENT 'Mon–Sun flags',
  `time_windows_json` JSON DEFAULT NULL COMMENT 'morning,lunch,evening,night',
  `max_hours_per_day` DECIMAL(4, 1) DEFAULT NULL,
  `max_hours_per_week` DECIMAL(5, 1) DEFAULT NULL,
  `notice_period_minutes` INT UNSIGNED DEFAULT NULL,
  `willing_holidays` VARCHAR(32) DEFAULT NULL,
  `shift_notes` TEXT,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`rider_id`),
  CONSTRAINT `fk_rider_availability_rider` FOREIGN KEY (`rider_id`) REFERENCES `riders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `rider_capacity` (
  `rider_id` BIGINT UNSIGNED NOT NULL,
  `max_concurrent_orders` TINYINT UNSIGNED DEFAULT NULL,
  `max_distance_km` DECIMAL(8, 2) DEFAULT NULL,
  `max_radius_km` DECIMAL(8, 2) DEFAULT NULL,
  `max_weight_kg` DECIMAL(8, 2) DEFAULT NULL,
  `max_volume` VARCHAR(128) DEFAULT NULL,
  `cash_on_delivery_willing` VARCHAR(32) DEFAULT NULL,
  `cash_on_delivery_limit` DECIMAL(12, 2) DEFAULT NULL,
  `cold_chain_pharma` VARCHAR(32) DEFAULT NULL,
  `cold_chain_training` VARCHAR(32) DEFAULT NULL,
  `large_cash_handling` VARCHAR(32) DEFAULT NULL,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`rider_id`),
  CONSTRAINT `fk_rider_capacity_rider` FOREIGN KEY (`rider_id`) REFERENCES `riders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `rider_compliance` (
  `rider_id` BIGINT UNSIGNED NOT NULL,
  `background_check_consent` VARCHAR(32) DEFAULT NULL,
  `background_check_consent_date` DATE DEFAULT NULL,
  `background_check_status` VARCHAR(64) DEFAULT NULL,
  `background_check_ref_id` VARCHAR(128) DEFAULT NULL,
  `background_check_expiry` DATE DEFAULT NULL,
  `road_safety_training` VARCHAR(32) DEFAULT NULL,
  `road_safety_certificate_path` VARCHAR(512) DEFAULT NULL,
  `food_hygiene_training` VARCHAR(255) DEFAULT NULL,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`rider_id`),
  CONSTRAINT `fk_rider_compliance_rider` FOREIGN KEY (`rider_id`) REFERENCES `riders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `rider_document` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `rider_id` BIGINT UNSIGNED NOT NULL,
  `doc_type` VARCHAR(64) NOT NULL COMMENT 'id_front, license, insurance, …',
  `storage_path` VARCHAR(512) NOT NULL,
  `mime_type` VARCHAR(128) DEFAULT NULL,
  `status` ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  `reviewed_at` TIMESTAMP NULL DEFAULT NULL,
  `rejection_reason` VARCHAR(512) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_rider_doc_rider` (`rider_id`, `doc_type`),
  CONSTRAINT `fk_rider_document_rider` FOREIGN KEY (`rider_id`) REFERENCES `riders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
-- Legacy / manual follow-up (only if you already had partial riders or old draft table):
--   ALTER TABLE `riders` ADD COLUMN `completion_percent` TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER `status`;
--   ALTER TABLE `riders` ADD COLUMN `registration_source` VARCHAR(64) DEFAULT 'web' AFTER `completion_percent`;
--
-- If shop_onboarding_draft existed as `id BIGINT` without UNSIGNED, no change required for app.
-- =============================================================================
