-- Client suggestions / Grandma support form.
-- Run on the same database as ONBOARDING_MYSQL_DATABASE (Java Kaos schema).
-- Safe to re-run: CREATE TABLE IF NOT EXISTS.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `client_suggestion` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `full_name` VARCHAR(120) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(24) NOT NULL,
  `subject` VARCHAR(200) NOT NULL,
  `suggestion_details` TEXT NOT NULL,
  `category` VARCHAR(40) DEFAULT NULL,
  `status` ENUM('NEW', 'READ', 'IN_PROGRESS', 'RESOLVED') NOT NULL DEFAULT 'NEW',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_client_suggestion_created` (`created_at`),
  KEY `idx_client_suggestion_status` (`status`),
  KEY `idx_client_suggestion_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Grandma client suggestions submitted via /grandma/support';
