-- Optional: audit who created the seller row (admin email, flow name, or API id).
-- Run against the database that actually has `account_seller` (e.g. chaos_theta), NOT an empty test DB.
-- In MySQL Workbench: select the correct schema in the dropdown, or run:
--   USE chaos_theta;
-- If the column already exists, skip this file.

ALTER TABLE `account_seller`
  ADD COLUMN `created_by` VARCHAR(255) NULL DEFAULT NULL COMMENT 'Admin email, onboarding flow, or API id' AFTER `email`;
