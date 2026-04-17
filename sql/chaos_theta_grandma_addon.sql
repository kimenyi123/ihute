-- Grandma-specific tables + optional split accounts (theta additions).
-- Loaded after full chaos_beta table replica. Does NOT duplicate account_signup:
-- keep account_signup from dump for IHUTE compatibility; use these for new flows.

CREATE TABLE IF NOT EXISTS `account_buyer` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `ishyiga_account` varchar(100) NOT NULL,
  `email` varchar(255) NOT NULL,
  `pwd_hash` varchar(255) NOT NULL,
  `firstname` varchar(100) DEFAULT NULL,
  `lastname` varchar(100) DEFAULT NULL,
  `tel` varchar(50) NOT NULL,
  `language` enum('KIN','SWA','ENG','FRA','POR') NOT NULL DEFAULT 'KIN',
  `status` enum('LIVE','SLEEPING','PENDING') NOT NULL DEFAULT 'LIVE',
  `currency` varchar(10) NOT NULL DEFAULT 'RWF',
  `country` varchar(50) DEFAULT NULL,
  `momo` varchar(45) DEFAULT NULL,
  `prefered_pay` varchar(50) DEFAULT NULL,
  `loc_province` varchar(100) DEFAULT NULL,
  `loc_district` varchar(100) DEFAULT NULL,
  `loc_cell` varchar(100) DEFAULT NULL,
  `rating_star` decimal(3,1) DEFAULT NULL,
  `total_ratings` int unsigned NOT NULL DEFAULT 0,
  `otp` varchar(50) DEFAULT NULL,
  `user_token` varchar(255) DEFAULT NULL,
  `pwd_reset_token` varchar(128) DEFAULT NULL,
  `pwd_reset_expires` datetime DEFAULT NULL,
  `force_password_change` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_buyer_ishyiga` (`ishyiga_account`),
  UNIQUE KEY `uq_buyer_email` (`email`),
  KEY `idx_buyer_tel` (`tel`),
  KEY `idx_buyer_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `account_seller` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `ishyiga_account` varchar(100) NOT NULL,
  `email` varchar(255) NOT NULL,
  `pwd_hash` varchar(255) NOT NULL,
  `firstname` varchar(100) DEFAULT NULL,
  `lastname` varchar(100) DEFAULT NULL,
  `owner` varchar(200) DEFAULT NULL,
  `tel` varchar(50) NOT NULL,
  `hq_location` varchar(200) DEFAULT NULL,
  `tin` varchar(20) DEFAULT NULL,
  `language` enum('KIN','SWA','ENG','FRA','POR') NOT NULL DEFAULT 'KIN',
  `status` enum('LIVE','SLEEPING','PENDING') NOT NULL DEFAULT 'PENDING',
  `description` varchar(500) DEFAULT NULL,
  `department` varchar(100) DEFAULT NULL,
  `preferedcategories` text,
  `certificate` varchar(255) DEFAULT NULL,
  `photo` varchar(255) DEFAULT NULL,
  `currency` varchar(10) NOT NULL DEFAULT 'RWF',
  `country` varchar(50) DEFAULT NULL,
  `momo` varchar(45) DEFAULT NULL,
  `nickname` varchar(50) DEFAULT NULL,
  `supplier_latitude` decimal(10,8) DEFAULT NULL,
  `supplier_longitude` decimal(11,8) DEFAULT NULL,
  `supplier_geohash` varchar(12) DEFAULT NULL,
  `gps_accuracy` decimal(6,2) DEFAULT NULL,
  `gps_last_updated` timestamp NULL DEFAULT NULL,
  `gps_override` enum('INHERIT','FORCE_ON','FORCE_OFF') NOT NULL DEFAULT 'INHERIT',
  `location_source` enum('MANUAL','AUTO','ADMIN') NOT NULL DEFAULT 'AUTO',
  `rejection_reason` text,
  `rejected_by` varchar(255) DEFAULT NULL,
  `rejected_at` timestamp NULL DEFAULT NULL,
  `approved_by` varchar(255) DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `auto_approved` tinyint(1) NOT NULL DEFAULT 0,
  `rating_star` decimal(3,1) DEFAULT NULL,
  `total_ratings` int unsigned NOT NULL DEFAULT 0,
  `pwd_reset_token` varchar(128) DEFAULT NULL,
  `pwd_reset_expires` datetime DEFAULT NULL,
  `force_password_change` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_seller_ishyiga` (`ishyiga_account`),
  UNIQUE KEY `uq_seller_email` (`email`),
  KEY `idx_seller_status` (`status`),
  KEY `idx_seller_geo` (`supplier_latitude`,`supplier_longitude`),
  KEY `idx_seller_geohash` (`supplier_geohash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `account_rider` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `ishyiga_account` varchar(100) NOT NULL,
  `email` varchar(255) NOT NULL,
  `pwd_hash` varchar(255) NOT NULL,
  `firstname` varchar(100) DEFAULT NULL,
  `lastname` varchar(100) DEFAULT NULL,
  `tel` varchar(50) NOT NULL,
  `language` enum('KIN','SWA','ENG','FRA','POR') NOT NULL DEFAULT 'KIN',
  `status` enum('LIVE','SLEEPING','PENDING') NOT NULL DEFAULT 'PENDING',
  `vehicle_plate` varchar(30) DEFAULT NULL,
  `vehicle_type` varchar(50) DEFAULT NULL,
  `license_number` varchar(80) DEFAULT NULL,
  `current_latitude` decimal(10,8) DEFAULT NULL,
  `current_longitude` decimal(11,8) DEFAULT NULL,
  `last_location_at` timestamp NULL DEFAULT NULL,
  `rating_star` decimal(3,1) DEFAULT NULL,
  `total_ratings` int unsigned NOT NULL DEFAULT 0,
  `pwd_reset_token` varchar(128) DEFAULT NULL,
  `pwd_reset_expires` datetime DEFAULT NULL,
  `force_password_change` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_rider_ishyiga` (`ishyiga_account`),
  UNIQUE KEY `uq_rider_email` (`email`),
  KEY `idx_rider_status` (`status`),
  KEY `idx_rider_tel` (`tel`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `grandma_shop_item` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `seller_ishyiga_account` varchar(100) NOT NULL,
  `niki_code` varchar(20) NOT NULL,
  `display_order` tinyint unsigned NOT NULL DEFAULT 0,
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_shop_niki` (`seller_ishyiga_account`,`niki_code`),
  KEY `idx_grandma_shop` (`seller_ishyiga_account`,`active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `grandma_stock_balance` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `seller_ishyiga_account` varchar(100) NOT NULL,
  `niki_code` varchar(20) NOT NULL,
  `qty_on_hand` decimal(18,4) NOT NULL DEFAULT 0.0000,
  `qty_reserved` decimal(18,4) NOT NULL DEFAULT 0.0000,
  `unit_price_rwf` decimal(18,2) DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_stock_shop_sku` (`seller_ishyiga_account`,`niki_code`),
  KEY `idx_stock_seller` (`seller_ishyiga_account`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `grandma_stock_movement` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `seller_ishyiga_account` varchar(100) NOT NULL,
  `niki_code` varchar(20) NOT NULL,
  `delta` decimal(18,4) NOT NULL,
  `reason` enum('ORDER_CONFIRM','ORDER_CANCEL','REFUND','ADJUSTMENT','SYNC_FROM_NIKI','SYNC_FROM_POS','OTHER') NOT NULL,
  `order_ref` varchar(64) DEFAULT NULL,
  `note` varchar(500) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_mov_shop_time` (`seller_ishyiga_account`,`created_at`),
  KEY `idx_mov_order` (`order_ref`),
  KEY `idx_mov_sku` (`seller_ishyiga_account`,`niki_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `grandma_order_link` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `external_order_id` varchar(64) NOT NULL,
  `buyer_ishyiga_account` varchar(100) DEFAULT NULL,
  `seller_ishyiga_account` varchar(100) NOT NULL,
  `status` varchar(50) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ext_order` (`external_order_id`),
  KEY `idx_link_buyer` (`buyer_ishyiga_account`),
  KEY `idx_link_seller` (`seller_ishyiga_account`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `grandma_rating_shop` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `buyer_ishyiga_account` varchar(100) NOT NULL,
  `seller_ishyiga_account` varchar(100) NOT NULL,
  `order_ref` varchar(64) DEFAULT NULL,
  `stars` tinyint unsigned NOT NULL,
  `comment` varchar(1000) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_rate_shop_order` (`buyer_ishyiga_account`,`seller_ishyiga_account`,`order_ref`),
  KEY `idx_rate_seller` (`seller_ishyiga_account`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `grandma_rating_product` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `buyer_ishyiga_account` varchar(100) NOT NULL,
  `seller_ishyiga_account` varchar(100) NOT NULL,
  `niki_code` varchar(20) NOT NULL,
  `order_ref` varchar(64) DEFAULT NULL,
  `stars` tinyint unsigned NOT NULL,
  `comment` varchar(1000) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_rate_prod` (`seller_ishyiga_account`,`niki_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `grandma_rating_rider` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `buyer_ishyiga_account` varchar(100) NOT NULL,
  `rider_ishyiga_account` varchar(100) NOT NULL,
  `order_ref` varchar(64) DEFAULT NULL,
  `stars` tinyint unsigned NOT NULL,
  `comment` varchar(1000) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_rate_rider` (`rider_ishyiga_account`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
