// Fix and recreate triggers in Turso
import { createClient } from '@libsql/client';
import { config } from 'dotenv';

config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

console.log('🔧 Fixing triggers in Turso...\n');

const triggers = [
  {
    name: 'update_ctv_timestamp',
    sql: `CREATE TRIGGER IF NOT EXISTS update_ctv_timestamp 
AFTER UPDATE ON ctv
BEGIN
  UPDATE ctv SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;`
  },
  {
    name: 'update_cost_config_timestamp',
    sql: `CREATE TRIGGER IF NOT EXISTS update_cost_config_timestamp 
AFTER UPDATE ON cost_config
BEGIN
  UPDATE cost_config SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;`
  },
  {
    name: 'increment_purchases_on_order_item_insert',
    sql: `CREATE TRIGGER IF NOT EXISTS increment_purchases_on_order_item_insert
AFTER INSERT ON order_items
FOR EACH ROW
WHEN NEW.product_id IS NOT NULL
BEGIN
  UPDATE products 
  SET purchases = purchases + NEW.quantity
  WHERE id = NEW.product_id;
END;`
  },
  {
    name: 'decrement_purchases_on_order_item_delete',
    sql: `CREATE TRIGGER IF NOT EXISTS decrement_purchases_on_order_item_delete
AFTER DELETE ON order_items
FOR EACH ROW
WHEN OLD.product_id IS NOT NULL
BEGIN
  UPDATE products 
  SET purchases = CASE 
    WHEN purchases - OLD.quantity < 0 THEN 0 
    ELSE purchases - OLD.quantity 
  END
  WHERE id = OLD.product_id;
END;`
  },
  {
    name: 'update_purchases_on_order_item_update',
    sql: `CREATE TRIGGER IF NOT EXISTS update_purchases_on_order_item_update
AFTER UPDATE OF quantity ON order_items
FOR EACH ROW
WHEN NEW.product_id IS NOT NULL
BEGIN
  UPDATE products 
  SET purchases = purchases - OLD.quantity + NEW.quantity
  WHERE id = NEW.product_id;
END;`
  },
  {
    name: 'update_discounts_timestamp',
    sql: `CREATE TRIGGER IF NOT EXISTS update_discounts_timestamp 
AFTER UPDATE ON discounts
BEGIN
  UPDATE discounts SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;`
  },
  {
    name: 'increment_discount_usage',
    sql: `CREATE TRIGGER IF NOT EXISTS increment_discount_usage
AFTER INSERT ON discount_usage
BEGIN
  UPDATE discounts 
  SET 
    usage_count = usage_count + 1,
    total_discount_amount = total_discount_amount + NEW.discount_amount
  WHERE id = NEW.discount_id;
END;`
  },
  {
    name: 'decrement_discount_usage',
    sql: `CREATE TRIGGER IF NOT EXISTS decrement_discount_usage
AFTER DELETE ON discount_usage
BEGIN
  UPDATE discounts 
  SET 
    usage_count = usage_count - 1,
    total_discount_amount = total_discount_amount - OLD.discount_amount
  WHERE id = OLD.discount_id;
END;`
  },
  {
    name: 'trg_order_items_insert_update_total',
    sql: `CREATE TRIGGER IF NOT EXISTS trg_order_items_insert_update_total
AFTER INSERT ON order_items
BEGIN
    UPDATE orders 
    SET total_amount = (
        SELECT COALESCE(SUM(product_price * quantity), 0) 
        FROM order_items 
        WHERE order_id = NEW.order_id
    ) + COALESCE(shipping_fee, 0) - COALESCE(discount_amount, 0)
    WHERE id = NEW.order_id;
END;`
  },
  {
    name: 'trg_order_items_update_update_total',
    sql: `CREATE TRIGGER IF NOT EXISTS trg_order_items_update_update_total
AFTER UPDATE ON order_items
BEGIN
    UPDATE orders 
    SET total_amount = (
        SELECT COALESCE(SUM(product_price * quantity), 0) 
        FROM order_items 
        WHERE order_id = NEW.order_id
    ) + COALESCE(shipping_fee, 0) - COALESCE(discount_amount, 0)
    WHERE id = NEW.order_id;
END;`
  },
  {
    name: 'trg_order_items_delete_update_total',
    sql: `CREATE TRIGGER IF NOT EXISTS trg_order_items_delete_update_total
AFTER DELETE ON order_items
BEGIN
    UPDATE orders 
    SET total_amount = (
        SELECT COALESCE(SUM(product_price * quantity), 0) 
        FROM order_items 
        WHERE order_id = OLD.order_id
    ) + COALESCE(shipping_fee, 0) - COALESCE(discount_amount, 0)
    WHERE id = OLD.order_id;
END;`
  },
  {
    name: 'trg_orders_shipping_fee_update_total',
    sql: `CREATE TRIGGER IF NOT EXISTS trg_orders_shipping_fee_update_total
AFTER UPDATE OF shipping_fee ON orders
BEGIN
    UPDATE orders 
    SET total_amount = (
        SELECT COALESCE(SUM(product_price * quantity), 0) 
        FROM order_items 
        WHERE order_id = NEW.id
    ) + COALESCE(NEW.shipping_fee, 0) - COALESCE(NEW.discount_amount, 0)
    WHERE id = NEW.id;
END;`
  },
  {
    name: 'trg_orders_discount_update_total',
    sql: `CREATE TRIGGER IF NOT EXISTS trg_orders_discount_update_total
AFTER UPDATE OF discount_amount ON orders
BEGIN
    UPDATE orders 
    SET total_amount = (
        SELECT COALESCE(SUM(product_price * quantity), 0) 
        FROM order_items 
        WHERE order_id = NEW.id
    ) + COALESCE(NEW.shipping_fee, 0) - COALESCE(NEW.discount_amount, 0)
    WHERE id = NEW.id;
END;`
  },
  {
    name: 'ensure_single_primary_category',
    sql: `CREATE TRIGGER IF NOT EXISTS ensure_single_primary_category
BEFORE INSERT ON product_categories
WHEN NEW.is_primary = 1
BEGIN
  UPDATE product_categories SET is_primary = 0 WHERE product_id = NEW.product_id AND is_primary = 1;
END;`
  },
  {
    name: 'ensure_single_primary_category_update',
    sql: `CREATE TRIGGER IF NOT EXISTS ensure_single_primary_category_update
BEFORE UPDATE ON product_categories
WHEN NEW.is_primary = 1 AND OLD.is_primary = 0
BEGIN
  UPDATE product_categories SET is_primary = 0 WHERE product_id = NEW.product_id AND id != NEW.id AND is_primary = 1;
END;`
  },
  {
    name: 'sync_primary_category_to_products',
    sql: `CREATE TRIGGER IF NOT EXISTS sync_primary_category_to_products
AFTER INSERT ON product_categories
WHEN NEW.is_primary = 1
BEGIN
  UPDATE products SET category_id = NEW.category_id WHERE id = NEW.product_id;
END;`
  },
  {
    name: 'sync_primary_category_update',
    sql: `CREATE TRIGGER IF NOT EXISTS sync_primary_category_update
AFTER UPDATE ON product_categories
WHEN NEW.is_primary = 1
BEGIN
  UPDATE products SET category_id = NEW.category_id WHERE id = NEW.product_id;
END;`
  },
  {
    name: 'handle_primary_category_delete',
    sql: `CREATE TRIGGER IF NOT EXISTS handle_primary_category_delete
AFTER DELETE ON product_categories
WHEN OLD.is_primary = 1
BEGIN
  UPDATE products SET category_id = (SELECT category_id FROM product_categories WHERE product_id = OLD.product_id AND is_primary = 1 LIMIT 1) WHERE id = OLD.product_id;
END;`
  }
];

async function fixTriggers() {
  let success = 0;
  let errors = 0;

  for (const trigger of triggers) {
    try {
      // Drop existing trigger first
      await client.execute(`DROP TRIGGER IF EXISTS ${trigger.name}`);
      
      // Create new trigger
      await client.execute(trigger.sql);
      console.log(`✅ Created trigger: ${trigger.name}`);
      success++;
    } catch (error) {
      console.error(`❌ Error creating ${trigger.name}:`, error.message);
      errors++;
    }
  }

  console.log(`\n📊 Summary: ${success} success, ${errors} errors\n`);
}

fixTriggers();
