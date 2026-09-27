-- Migration 090: Add indexes for Server-Side Search optimization
-- Purpose: Tối ưu tốc độ tìm kiếm toàn bộ đơn hàng qua searchOrders API
-- Date: 2026-09-27
-- Related: specs/server-side-search/

-- Index 1: Customer phone (high priority search field)
-- Giúp tăng tốc: WHERE LOWER(customer_phone) LIKE '%xxx%'
-- Note: SQLite không tối ưu LIKE với leading wildcard, nhưng index vẫn giúp cho exact/prefix match
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON orders(customer_phone);

-- Index 2: Customer name (high priority search field)  
-- Giúp tăng tốc: WHERE LOWER(customer_name) LIKE '%xxx%'
-- Sử dụng LOWER() để hỗ trợ case-insensitive search
CREATE INDEX IF NOT EXISTS idx_orders_customer_name_lower ON orders(LOWER(customer_name));

-- Index 3: order_id already has UNIQUE index (không cần tạo thêm)
-- Existing: CREATE UNIQUE INDEX idx_orders_order_id ON orders(order_id);

-- Index 4: Composite index for phone + created_at (optimization cho search + sort)
-- Giúp tối ưu query: WHERE phone LIKE ... ORDER BY created_at_unix DESC
CREATE INDEX IF NOT EXISTS idx_orders_phone_created_at 
ON orders(customer_phone, created_at_unix DESC);

-- Note: address và notes không tạo index vì:
-- 1. Ít khi search theo address/notes (medium/low priority)
-- 2. Index cho text dài sẽ tốn storage và slow down INSERTs
-- 3. Full table scan chấp nhận được cho low-frequency searches
