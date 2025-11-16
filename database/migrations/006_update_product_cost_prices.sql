-- Migration: Update cost_price for all products
-- Date: 2024-11-15
-- Description: Add realistic cost_price values for demo/testing purposes
--              Cost price is typically 40-60% of selling price

-- Update products with cost_price = 0 or NULL
-- Using different percentages based on price ranges for realism

-- Low price items (< 50k): 40% cost
UPDATE products 
SET cost_price = ROUND(price * 0.40)
WHERE (cost_price = 0 OR cost_price IS NULL) 
  AND price < 50000;

-- Medium price items (50k-100k): 45% cost
UPDATE products 
SET cost_price = ROUND(price * 0.45)
WHERE (cost_price = 0 OR cost_price IS NULL) 
  AND price >= 50000 AND price < 100000;

-- High price items (100k-200k): 50% cost
UPDATE products 
SET cost_price = ROUND(price * 0.50)
WHERE (cost_price = 0 OR cost_price IS NULL) 
  AND price >= 100000 AND price < 200000;

-- Premium items (200k-300k): 55% cost
UPDATE products 
SET cost_price = ROUND(price * 0.55)
WHERE (cost_price = 0 OR cost_price IS NULL) 
  AND price >= 200000 AND price < 300000;

-- Luxury items (>= 300k): 60% cost
UPDATE products 
SET cost_price = ROUND(price * 0.60)
WHERE (cost_price = 0 OR cost_price IS NULL) 
  AND price >= 300000;

-- Fix products with unrealistic cost_price (cost > price)
UPDATE products 
SET cost_price = ROUND(price * 0.50)
WHERE cost_price > price;

-- Verification
SELECT 
  CASE 
    WHEN price < 50000 THEN '< 50k'
    WHEN price < 100000 THEN '50k-100k'
    WHEN price < 200000 THEN '100k-200k'
    WHEN price < 300000 THEN '200k-300k'
    ELSE '>= 300k'
  END as price_range,
  COUNT(*) as count,
  AVG(ROUND(cost_price * 100.0 / price, 2)) as avg_cost_percentage,
  MIN(cost_price) as min_cost,
  MAX(cost_price) as max_cost
FROM products
WHERE price > 0
GROUP BY price_range
ORDER BY MIN(price);
