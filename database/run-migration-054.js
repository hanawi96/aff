import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env' });

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

async function runMigration() {
    console.log('🚀 Starting Migration 054: Remove order_date column');
    console.log('=' .repeat(60));

    try {
        // Step 1: Check current schema
        console.log('\n📋 Step 1: Checking current schema...');
        const schemaResult = await client.execute(`
            SELECT sql FROM sqlite_master 
            WHERE type='table' AND name='orders'
        `);
        console.log('Current orders table schema:');
        console.log(schemaResult.rows[0]?.sql);

        // Step 2: Check if order_date column exists
        console.log('\n🔍 Step 2: Checking if order_date column exists...');
        const columnsResult = await client.execute(`
            PRAGMA table_info(orders)
        `);
        
        const hasOrderDate = columnsResult.rows.some(row => row.name === 'order_date');
        
        if (!hasOrderDate) {
            console.log('✅ order_date column does not exist. Migration not needed.');
            return;
        }
        
        console.log('✅ order_date column found. Proceeding with migration...');

        // Step 3: Verify data consistency (optional)
        console.log('\n🔍 Step 3: Verifying data consistency...');
        const countResult = await client.execute(`
            SELECT COUNT(*) as total FROM orders
        `);
        console.log(`Total orders: ${countResult.rows[0]?.total}`);

        // Step 4: SQLite doesn't support DROP COLUMN directly in older versions
        // We need to recreate the table without order_date column
        console.log('\n🔧 Step 4: Recreating table without order_date column...');
        
        // Begin transaction
        await client.execute('BEGIN TRANSACTION');

        // Drop triggers that reference orders table
        console.log('🗑️ Dropping triggers...');
        await client.execute('DROP TRIGGER IF EXISTS trg_order_items_insert_update_total');
        await client.execute('DROP TRIGGER IF EXISTS trg_order_items_update_update_total');
        await client.execute('DROP TRIGGER IF EXISTS trg_order_items_delete_update_total');
        console.log('✅ Dropped triggers');

        // Create new table without order_date
        await client.execute(`
            CREATE TABLE orders_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id TEXT NOT NULL UNIQUE,
                customer_name TEXT NOT NULL,
                customer_phone TEXT NOT NULL,
                address TEXT,
                products TEXT,
                total_amount INTEGER DEFAULT 0,
                payment_method TEXT DEFAULT 'cod',
                status TEXT DEFAULT 'pending',
                referral_code TEXT,
                commission INTEGER DEFAULT 0,
                commission_rate REAL DEFAULT 0,
                ctv_phone TEXT,
                notes TEXT,
                shipping_fee INTEGER DEFAULT 0,
                shipping_cost INTEGER DEFAULT 0,
                packaging_cost INTEGER DEFAULT 0,
                packaging_details TEXT,
                tax_amount INTEGER DEFAULT 0,
                tax_rate REAL DEFAULT 0,
                created_at_unix INTEGER,
                province_id INTEGER,
                province_name TEXT,
                district_id INTEGER,
                district_name TEXT,
                ward_id INTEGER,
                ward_name TEXT,
                street_address TEXT,
                discount_code TEXT,
                discount_amount INTEGER DEFAULT 0,
                is_priority INTEGER DEFAULT 0
            )
        `);
        console.log('✅ Created orders_new table');

        // Copy data from old table to new table (excluding order_date)
        await client.execute(`
            INSERT INTO orders_new (
                id, order_id, customer_name, customer_phone,
                address, products, total_amount, payment_method,
                status, referral_code, commission, commission_rate, ctv_phone, notes,
                shipping_fee, shipping_cost, packaging_cost, packaging_details,
                tax_amount, tax_rate, created_at_unix,
                province_id, province_name, district_id, district_name,
                ward_id, ward_name, street_address,
                discount_code, discount_amount, is_priority
            )
            SELECT 
                id, order_id, customer_name, customer_phone,
                address, products, total_amount, payment_method,
                status, referral_code, commission, commission_rate, ctv_phone, notes,
                shipping_fee, shipping_cost, packaging_cost, packaging_details,
                tax_amount, tax_rate, created_at_unix,
                province_id, province_name, district_id, district_name,
                ward_id, ward_name, street_address,
                discount_code, discount_amount, is_priority
            FROM orders
        `);
        console.log('✅ Copied data to orders_new');

        // Drop old table
        await client.execute('DROP TABLE orders');
        console.log('✅ Dropped old orders table');

        // Rename new table to orders
        await client.execute('ALTER TABLE orders_new RENAME TO orders');
        console.log('✅ Renamed orders_new to orders');

        // Recreate indexes if any
        console.log('\n🔧 Step 5: Recreating indexes...');
        
        await client.execute(`
            CREATE INDEX IF NOT EXISTS idx_orders_referral_code ON orders(referral_code)
        `);
        
        await client.execute(`
            CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON orders(customer_phone)
        `);
        
        await client.execute(`
            CREATE INDEX IF NOT EXISTS idx_orders_created_at_unix ON orders(created_at_unix)
        `);
        
        await client.execute(`
            CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)
        `);
        
        console.log('✅ Recreated indexes');

        // Commit transaction
        await client.execute('COMMIT');
        console.log('\n✅ Transaction committed');

        // Step 6: Verify migration
        console.log('\n🔍 Step 6: Verifying migration...');
        const newSchemaResult = await client.execute(`
            SELECT sql FROM sqlite_master 
            WHERE type='table' AND name='orders'
        `);
        console.log('New orders table schema:');
        console.log(newSchemaResult.rows[0]?.sql);

        const newColumnsResult = await client.execute(`
            PRAGMA table_info(orders)
        `);
        
        const stillHasOrderDate = newColumnsResult.rows.some(row => row.name === 'order_date');
        
        if (stillHasOrderDate) {
            throw new Error('❌ Migration failed: order_date column still exists');
        }

        const newCountResult = await client.execute(`
            SELECT COUNT(*) as total FROM orders
        `);
        
        if (newCountResult.rows[0]?.total !== countResult.rows[0]?.total) {
            throw new Error('❌ Data loss detected: row count mismatch');
        }

        console.log('✅ Migration verified successfully');
        console.log(`✅ Total orders after migration: ${newCountResult.rows[0]?.total}`);

        console.log('\n' + '='.repeat(60));
        console.log('✅ Migration 054 completed successfully!');
        console.log('📝 Summary:');
        console.log('   - Removed order_date column');
        console.log('   - Kept created_at_unix as single source of truth');
        console.log('   - All data preserved');
        console.log('   - Indexes recreated');

    } catch (error) {
        console.error('\n❌ Migration failed:', error);
        
        // Rollback transaction if it's still open
        try {
            await client.execute('ROLLBACK');
            console.log('🔄 Transaction rolled back');
        } catch (rollbackError) {
            console.error('❌ Rollback failed:', rollbackError);
        }
        
        process.exit(1);
    } finally {
        client.close();
    }
}

// Run migration
runMigration().catch(console.error);
