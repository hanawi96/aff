#!/usr/bin/env node

/**
 * Drop all product material triggers
 * Run this to remove problematic triggers
 */

import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';

dotenv.config();

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
    intMode: 'number',
});

async function dropTriggers() {
    console.log('🗑️ Dropping product material triggers...\n');

    const triggerNames = [
        'update_product_cost_after_material_insert',
        'update_product_cost_after_material_update',
        'update_product_cost_after_material_delete',
        'update_all_products_cost_after_material_price_change'
    ];

    try {
        for (const name of triggerNames) {
            console.log(`⏳ Dropping trigger: ${name}...`);
            try {
                await client.execute(`DROP TRIGGER IF EXISTS ${name}`);
                console.log(`✅ Dropped\n`);
            } catch (error) {
                console.error(`❌ Error:`, error.message);
            }
        }

        // Verify triggers are gone
        const result = await client.execute(`
            SELECT name FROM sqlite_master 
            WHERE type='trigger' AND name LIKE '%product_cost%'
        `);

        console.log(`\n✅ Triggers dropped!`);
        console.log(`📊 Remaining triggers: ${result.rows.length}\n`);
        for (const row of result.rows) {
            console.log(`   - ${row.name}`);
        }

    } catch (error) {
        console.error('\n❌ Failed to drop triggers:', error.message);
        throw error;
    }
}

dropTriggers()
    .then(() => {
        console.log('\n✅ Done!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Fatal error:', error);
        process.exit(1);
    });
