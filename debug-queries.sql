-- Debug queries to check why item_key_words and famille are null
-- Run these queries against your database to identify the issue

-- 1. Check table structure for products
DESCRIBE products;

-- 2. Check if item_key_words column exists and has data
SELECT 
    COUNT(*) as total_products,
    COUNT(item_key_words) as products_with_item_key_words,
    COUNT(CASE WHEN item_key_words IS NULL OR item_key_words = '' THEN 1 END) as missing_item_key_words
FROM products;

-- 3. Check if famille column exists and has data  
SELECT
    COUNT(*) as total_products,
    COUNT(famille) as products_with_famille,
    COUNT(CASE WHEN famille IS NULL OR famille = '' THEN 1 END) as missing_famille
FROM products;

-- 4. Sample products to see actual data structure
SELECT 
    id,
    item_commercial_name,
    item_key_words,
    famille,
    FAMILLE,
    image_url,
    item_image_url,
    IMAGE_URL,
    supplier_account,
    source
FROM products 
LIMIT 10;

-- 5. Check for case sensitivity issues - maybe column is FAMILLE not famille
SELECT 
    COUNT(*) as total,
    COUNT(famille) as famille_count,
    COUNT(FAMILLE) as FAMILLE_count
FROM products;

-- 6. Check if item_key_words has different name variations
SHOW COLUMNS FROM products LIKE '%item%';
SHOW COLUMNS FROM products LIKE '%key%';
SHOW COLUMNS FROM products LIKE '%code%';

-- 7. Check products with images but missing key fields
SELECT 
    COUNT(*) as total,
    COUNT(CASE WHEN image_url IS NOT NULL AND image_url != '' THEN 1 END) as has_image_url,
    COUNT(CASE WHEN item_image_url IS NOT NULL AND item_image_url != '' THEN 1 END) as has_item_image_url,
    COUNT(CASE WHEN IMAGE_URL IS NOT NULL AND IMAGE_URL != '' THEN 1 END) as has_IMAGE_URL,
    COUNT(CASE WHEN item_key_words IS NOT NULL AND item_key_words != '' THEN 1 END) as has_item_key_words,
    COUNT(CASE WHEN famille IS NOT NULL AND famille != '' THEN 1 END) as has_famille
FROM products;

-- 8. Check specific supplier/category that's showing issues
-- Replace 'MELIA TEST' with actual category/supplier you're testing
SELECT 
    p.item_commercial_name,
    p.item_key_words,
    p.famille,
    p.FAMILLE,
    p.image_url,
    p.supplier_account,
    p.source
FROM products p
WHERE p.supplier_account = 'MELIA TEST' 
LIMIT 5;

-- 9. Check Redis vs Database data differences
SELECT 
    source,
    COUNT(*) as count,
    COUNT(CASE WHEN item_key_words IS NULL THEN 1 END) as missing_item_key_words,
    COUNT(CASE WHEN famille IS NULL AND FAMILLE IS NULL THEN 1 END) as missing_famille
FROM products 
GROUP BY source;

-- 10. Check if there are any products with valid image fields
SELECT 
    item_commercial_name,
    item_key_words,
    famille,
    image_url,
    CASE 
        WHEN item_key_words IS NOT NULL AND item_key_words != '' AND 
             famille IS NOT NULL AND famille != '' THEN 'SHOULD_WORK'
        WHEN image_url IS NOT NULL AND image_url != '' THEN 'HAS_IMAGE_URL'
        ELSE 'MISSING_FIELDS'
    END as image_status
FROM products 
WHERE item_commercial_name IS NOT NULL
LIMIT 10;
