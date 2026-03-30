-- Set bracelet type to elastic for products in category "Vòng co giãn"
-- Keep other products unchanged.
UPDATE products
SET bracelet_type = 'elastic'
WHERE id IN (
    SELECT DISTINCT pc.product_id
    FROM product_categories pc
    JOIN categories c ON c.id = pc.category_id
    WHERE LOWER(TRIM(c.name)) = LOWER('Vòng co giãn')
);
