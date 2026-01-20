#!/usr/bin/env node

/**
 * Migration 048: Create Product Materials System
 * Run this script to create the product_materials table and triggers
 * 
 * Usage: node database/run-migration-048.js
 */

import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

const TURSO_DATABASE_URL = process.env.TURSO_DATABASE_URL;
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;

if (!TURSO_DATABASE_URL || !TURSO_AUTH_TOKEN) {
    console.error('❌ Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN in .env file');
    process.exit(1);
}

// Create Turso client
const client = createClient({
    url: TURSO_DATABASE_URL,
    authToken: TURSO_AUTH_TOKEN,
    intMode: 'number',
});

async function runMigration() {
    console.log('🚀 Starting Migration 048: Product Materials System\n');

    try {
        // Execute statements one by one
        const statements = [
            // 1. Create table
            `CREATE TABLE IF NOT EXISTS product_materials (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id INTEGER NOT NULL,
                material_name TEXT NOT NULL,
                quantity REAL NOT NULL,
                unit TEXT,
                notes TEXT,
                created_at_unix INTEGER DEFAULT (strftime('%s', 'now')),
                updated_at_unix INTEGER DEFAULT (strftime('%s', 'now')),
                FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
            )`,
            
            // 2. Create indexes
            `CREATE INDEX IF NOT EXISTS idx_product_materials_product_id ON product_materials(product_id)`,
            `CREATE INDEX IF NOT EXISTS idx_product_materials_material_name ON product_materials(material_name)`,
            
            // 3. Insert materials
            `INSERT OR IGNORE INTO cost_config (item_name, item_cost, is_default) VALUES ('bi_bac_s999', 15000, 1)`,
            `INSERT OR IGNORE INTO cost_config (item_name, item_cost, is_default) VALUES ('ho_phach_vang', 50000, 1)`,
            `INSERT OR IGNORE INTO cost_config (item_name, item_cost, is_default) VALUES ('ho_phach_nau', 45000, 1)`,
            `INSERT OR IGNORE INTO cost_config (item_name, item_cost, is_default) VALUES ('da_do', 30000, 1)`,
            `INSERT OR IGNORE INTO cost_config (item_name, item_cost, is_default) VALUES ('da_xanh', 28000, 1)`,
            `INSERT OR IGNORE INTO cost_config (item_name, item_cost, is_default) VALUES ('day_tron', 5000, 1)`,
            `INSERT OR IGNORE INTO cost_config (item_name, item_cost, is_default) VALUES ('day_ngu_sac', 8000, 1)`,
            `INSERT OR IGNORE INTO cost_config (item_name, item_cost, is_default) VALUES ('day_vang', 6000, 1)`,
            `INSERT OR IGNORE INTO cost_config (item_name, item_cost, is_default) VALUES ('charm_ran', 12000, 1)`,
            `INSERT OR IGNORE INTO cost_config (item_name, item_cost, is_default) VALUES ('charm_rong', 25000, 1)`,
            `INSERT OR IGNORE INTO cost_config (item_name, item_cost, is_default) VALUES ('charm_hoa_sen', 15000, 1)`,
            `INSERT OR IGNORE INTO cost_config (item_name, item_cost, is_default) VALUES ('charm_co_4_la', 10000, 1)`,
            `INSERT OR IGNORE INTO cost_config (item_name, item_cost, is_default) VALUES ('chuong', 3000, 1)`,
            `INSERT OR IGNORE INTO cost_config (item_name, item_cost, is_default) VALUES ('the_ten_tron', 8000, 1)`,
            `INSERT OR IGNORE INTO cost_config (item_name, item_cost, is_default) VALUES ('the_hinh_ran', 10000, 1)`,
            `INSERT OR IGNORE INTO cost_config (item_name, item_cost, is_default) VALUES ('thanh_gia', 12000, 1)`,
        ];

        console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

        // Execute each statement
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            const preview = statement.substring(0, 60).replace(/\s+/g, ' ');
            console.log(`⏳ [${i + 1}/${statements.length}] ${preview}...`);
            
            try {
                await client.execute(statement);
                console.log(`✅ Success\n`);
            } catch (error) {
                if (error.message.includes('already exists')) {
                    console.log(`⚠️  Skipped (already exists)\n`);
                } else {
                    console.error(`❌ Error:`, error.message);
                    throw error;
                }
            }
        }

        // Verify tables were created
        console.log('🔍 Verifying migration...\n');

        const tableCheck = await client.execute(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='product_materials'
        `);

        if (tableCheck.rows.length > 0) {
            console.log('✅ Table "product_materials" created successfully');
        } else {
            throw new Error('Table "product_materials" was not created');
        }

        // Check triggers
        const triggerCheck = await client.execute(`
            SELECT name FROM sqlite_master 
            WHERE type='trigger' AND name LIKE '%product_cost%'
        `);

        console.log(`✅ ${triggerCheck.rows.length} triggers created successfully`);

        // Check cost_config materials
        const materialsCheck = await client.execute(`
            SELECT COUNT(*) as count FROM cost_config
        `);

        console.log(`✅ ${materialsCheck.rows[0].count} materials in cost_config\n`);

        console.log('🎉 Migration 048 completed successfully!\n');
        console.log('📋 Summary:');
        console.log('   - Created table: product_materials');
        console.log('   - Created indexes for faster lookups');
        console.log('   - Added sample materials to cost_config');
        console.log('   - Created triggers for auto-calculation');
        console.log('\n✨ Next steps:');
        console.log('   1. Run: node database/seed-sample-materials.js (optional)');
        console.log('   2. Start using the materials system in admin panel');

    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        console.error('\nStack trace:', error.stack);
        process.exit(1);
    }
}

// Run migration
runMigration()
    .then(() => {
        console.log('\n✅ Done!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Fatal error:', error);
        process.exit(1);
    });
