#!/usr/bin/env node

/**
 * Create triggers for product materials system
 * Run this after migration 048
 */

import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';

dotenv.config();

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
    intMode: 'number',
});

async function createTriggers() {
    console.log('🔧 Creating triggers for auto-calculation...\n');

    const triggers = [
        {
            name: 'update_product_cost_after_material_insert',
            sql: `CREATE TRIGGER IF NOT EXISTS update_product_cost_after_material_insert
                AFTER INSERT ON product_materials
                BEGIN
                    UPDATE products
                    SET cost_price = (
                        SELECT COALESCE(SUM(pm.quantity * cc.item_cost), 0)
                        FROM product_materials pm
                        JOIN cost_config cc ON pm.material_name = cc.item_name
                        WHERE pm.product_id = NEW.product_id
                    )
                    WHERE id = NEW.product_id;
                END`
        },
        {
            name: 'update_product_cost_after_material_update',
            sql: `CREATE TRIGGER IF NOT EXISTS update_product_cost_after_material_update
                AFTER UPDATE ON product_materials
                BEGIN
                    UPDATE products
                    SET cost_price = (
                        SELECT COALESCE(SUM(pm.quantity * cc.item_cost), 0)
                        FROM product_materials pm
                        JOIN cost_config cc ON pm.material_name = cc.item_name
                        WHERE pm.product_id = NEW.product_id
                    )
                    WHERE id = NEW.product_id;
                END`
        },
        {
            name: 'update_product_cost_after_material_delete',
            sql: `CREATE TRIGGER IF NOT EXISTS update_product_cost_after_material_delete
                AFTER DELETE ON product_materials
                BEGIN
                    UPDATE products
                    SET cost_price = (
                        SELECT COALESCE(SUM(pm.quantity * cc.item_cost), 0)
                        FROM product_materials pm
                        JOIN cost_config cc ON pm.material_name = cc.item_name
                        WHERE pm.product_id = OLD.product_id
                    )
                    WHERE id = OLD.product_id;
                END`
        },
        {
            name: 'update_all_products_cost_after_material_price_change',
            sql: `CREATE TRIGGER IF NOT EXISTS update_all_products_cost_after_material_price_change
                AFTER UPDATE OF item_cost ON cost_config
                BEGIN
                    UPDATE products
                    SET cost_price = (
                        SELECT COALESCE(SUM(pm.quantity * cc.item_cost), 0)
                        FROM product_materials pm
                        JOIN cost_config cc ON pm.material_name = cc.item_name
                        WHERE pm.product_id = products.id
                    )
                    WHERE id IN (
                        SELECT DISTINCT product_id 
                        FROM product_materials 
                        WHERE material_name = NEW.item_name
                    );
                END`
        }
    ];

    try {
        for (const trigger of triggers) {
            console.log(`⏳ Creating trigger: ${trigger.name}...`);
            try {
                await client.execute(trigger.sql);
                console.log(`✅ Success\n`);
            } catch (error) {
                if (error.message.includes('already exists')) {
                    console.log(`⚠️  Already exists\n`);
                } else {
                    console.error(`❌ Error:`, error.message);
                    throw error;
                }
            }
        }

        // Verify triggers
        const result = await client.execute(`
            SELECT name FROM sqlite_master 
            WHERE type='trigger' AND name LIKE '%product_cost%'
        `);

        console.log(`\n🎉 Triggers created successfully!`);
        console.log(`✅ ${result.rows.length} triggers active:\n`);
        for (const row of result.rows) {
            console.log(`   - ${row.name}`);
        }

    } catch (error) {
        console.error('\n❌ Failed to create triggers:', error.message);
        throw error;
    }
}

createTriggers()
    .then(() => {
        console.log('\n✅ Done!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Fatal error:', error);
        process.exit(1);
    });
