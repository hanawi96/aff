-- Migration 051: Rename cost_config table to materials
-- Purpose: Rename table to better reflect its current purpose (materials management)
-- Date: 2026-01-20

-- Step 1: Rename the table
ALTER TABLE cost_config RENAME TO materials;

-- Step 2: Recreate triggers with new table name
-- Drop old triggers first
DROP TRIGGER IF EXISTS update_cost_config_timestamp;
DROP TRIGGER IF EXISTS update_product_cost_on_material_insert;
DROP TRIGGER IF EXISTS update_product_cost_on_material_update;
DROP TRIGGER IF EXISTS update_product_cost_on_material_delete;

-- Recreate trigger for materials table timestamp
CREATE TRIGGER IF NOT EXISTS update_materials_timestamp 
AFTER UPDATE ON materials
FOR EACH ROW
BEGIN
  UPDATE materials SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Recreate triggers for product cost calculation
CREATE TRIGGER IF NOT EXISTS update_product_cost_on_material_insert
AFTER INSERT ON product_materials
FOR EACH ROW
BEGIN
    UPDATE products
    SET cost_price = (
        SELECT COALESCE(SUM(pm.quantity * m.item_cost), 0)
        FROM product_materials pm
        JOIN materials m ON pm.material_name = m.item_name
        WHERE pm.product_id = NEW.product_id
    ),
    updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.product_id;
END;

CREATE TRIGGER IF NOT EXISTS update_product_cost_on_material_update
AFTER UPDATE ON product_materials
FOR EACH ROW
BEGIN
    UPDATE products
    SET cost_price = (
        SELECT COALESCE(SUM(pm.quantity * m.item_cost), 0)
        FROM product_materials pm
        JOIN materials m ON pm.material_name = m.item_name
        WHERE pm.product_id = NEW.product_id
    ),
    updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.product_id;
END;

CREATE TRIGGER IF NOT EXISTS update_product_cost_on_material_delete
AFTER DELETE ON product_materials
FOR EACH ROW
BEGIN
    UPDATE products
    SET cost_price = (
        SELECT COALESCE(SUM(pm.quantity * m.item_cost), 0)
        FROM product_materials pm
        JOIN materials m ON pm.material_name = m.item_name
        WHERE pm.product_id = OLD.product_id
    ),
    updated_at = CURRENT_TIMESTAMP
    WHERE id = OLD.product_id;
END;

-- Step 3: Create index on item_name for better performance
CREATE INDEX IF NOT EXISTS idx_materials_item_name ON materials(item_name);
CREATE INDEX IF NOT EXISTS idx_materials_category ON materials(category_id);

-- Verification
SELECT 'Migration 051 completed: cost_config renamed to materials' as status;
