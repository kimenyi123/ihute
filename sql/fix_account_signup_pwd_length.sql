-- ============================================================================
-- FIX: Extend account_signup.PWD to store bcrypt hashes (60+ chars)
-- ============================================================================
-- Problem: PWD was char(100), truncating bcrypt hashes on password reset.
-- Solution: Extend to varchar(255) to store full bcrypt hashes.
--
-- Run ONCE against your database:
--   mysql -h localhost -u root chaos_theta < fix_account_signup_pwd_length.sql
-- ============================================================================

ALTER TABLE `account_signup`
  MODIFY COLUMN `PWD` varchar(255) NOT NULL DEFAULT 'NA';

-- Verify the change
-- SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT 
-- FROM INFORMATION_SCHEMA.COLUMNS 
-- WHERE TABLE_NAME = 'account_signup' AND COLUMN_NAME = 'PWD';
