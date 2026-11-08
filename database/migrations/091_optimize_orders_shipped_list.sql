-- Migration 091: Optimize shipped orders list (cut ~9.5K rows read / query)
-- Purpose:
--   1) Normalize status so filters can use equality (index-friendly)
--   2) Backfill shipped_at_unix so ORDER BY can use a real column (no COALESCE)
--   3) Composite indexes for status + sort/cursor keyset pagination
-- Related: getOrdersHistoryPage (statusFilter=shipped)

-- Normalize legacy status values (case / whitespace)
UPDATE orders
SET status = LOWER(TRIM(status))
WHERE status IS NOT NULL
  AND status != LOWER(TRIM(status));

-- Backfill ship timestamp for shipped orders missing it (sort key)
UPDATE orders
SET shipped_at_unix = created_at_unix
WHERE status = 'shipped'
  AND COALESCE(shipped_at_unix, 0) = 0;

-- Shipped history: WHERE status = ? ORDER BY shipped_at_unix DESC, id DESC LIMIT ?
CREATE INDEX IF NOT EXISTS idx_orders_status_shipped_at
ON orders(status, shipped_at_unix DESC, id DESC);

-- Unshipped / created-date lists: WHERE status IN (...) ORDER BY created_at_unix DESC
CREATE INDEX IF NOT EXISTS idx_orders_status_created_at
ON orders(status, created_at_unix DESC, id DESC);
