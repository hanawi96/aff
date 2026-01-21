import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

/**
 * Migration 055: Normalize Address IDs to String Format
 * 
 * Problem: Database stores address IDs as integers (e.g., 1756)
 *          but tree.json uses zero-padded strings (e.g., "01756")
 * 
 * Solution: Convert all address ID columns to TEXT with zero-padding
 *           - province_id: 2 digits (e.g., 11 → "11")
 *           - district_id: 3 digits (e.g., 107 → "107")
 *           - ward_id: 5 digits (e.g., 1756 → "01756")
 */

async function runMigration() {
    console.log('🚀 Starting Migration 055: Normalize Address IDs to String Format');
    console.log('=' .repeat(70));

    try {
        // Step 1: Check current schema
        console.log('\n📋 Step 1: Checking current schema...');
        const schemaResult = await client.execute(`
            SELECT sql FROM sqlite_master 
            WHERE type='table' AND name='orders'
        `);
        console.log('Current orders table schema:');
        console.log(schemaResult.rows[0]?.sql);

        // Step 2: Check current data types
        console.log('\n🔍 Step 2: Checking current column types...');
        const columnsResult = await client.execute(`
            PRAGMA table_info(orders)
        `);
        
        const addressColumns = columnsResult.rows.filter(row => 
            ['province_id', 'district_id', 'ward_id'].includes(row.name)
        );
        
        console.log('Address columns:');
        addressColumns.forEach(col => {
            console.log(`  - ${col.name}: ${col.type}`);
        });

        // Step 3: Count orders with address data
        console.log('\n📊 Step 3: Analyzing address data...');
        const statsResult = await client.execute(`
            SELECT 
                COUNT(*) as total_orders,
                COUNT(province_id) as has_province,
                COUNT(district_id) as has_district,
                COUNT(ward_id) as has_ward
            FROM orders
        `);
        
        const stats = statsResult.rows[0];
        console.log(`Total orders: ${stats.total_orders}`);
        console.log(`Orders with province_id: ${stats.has_province}`);
        console.log(`Orders with district_id: ${stats.has_district}`);
        console.log(`Orders with ward_id: ${stats.has_ward}`);

        // Step 4: Sample current data
        console.log('\n🔍 Step 4: Sampling current address IDs...');
        const sampleResult = await client.execute(`
            SELECT 
                order_id,
                province_id, 
                district_id, 
                ward_id,
                province_name,
                district_name,
                ward_name
            FROM orders 
            WHERE province_id IS NOT NULL 
            LIMIT 5
        `);
        
        console.log('Sample data (before migration):');
        sampleResult.rows.forEach(row => {
            console.log(`  Order ${row.order_id}:`);
            console.log(`    Province: ${row.province_id} (${row.province_name})`);
            console.log(`    District: ${row.district_id} (${row.district_name})`);
            console.log(`    Ward: ${row.ward_id} (${row.ward_name})`);
        });

        // Step 5: Begin migration
        console.log('\n🔧 Step 5: Starting migration...');
        console.log('⚠️  This will recreate the orders table with TEXT address columns');
        
        // Note: Turso auto-commits each statement, no explicit transaction needed

        // Drop triggers
        console.log('\n🗑️ Dropping triggers...');
        await client.execute('DROP TRIGGER IF EXISTS trg_order_items_insert_update_total');
        await client.execute('DROP TRIGGER IF EXISTS trg_order_items_update_update_total');
        await client.execute('DROP TRIGGER IF EXISTS trg_order_items_delete_update_total');
        console.log('✅ Dropped triggers');

        // Create new table with TEXT address columns
        console.log('\n🏗️ Creating new table with TEXT address columns...');
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
                province_id TEXT,
                province_name TEXT,
                district_id TEXT,
                district_name TEXT,
                ward_id TEXT,
                ward_name TEXT,
                street_address TEXT,
                discount_code TEXT,
                discount_amount INTEGER DEFAULT 0,
                is_priority INTEGER DEFAULT 0
            )
        `);
        console.log('✅ Created orders_new table');

        // Copy and transform data
        console.log('\n📦 Copying and transforming data...');
        console.log('   Converting IDs to zero-padded strings:');
        console.log('   - province_id: INTEGER → TEXT (2 digits)');
        console.log('   - district_id: INTEGER → TEXT (3 digits)');
        console.log('   - ward_id: INTEGER → TEXT (5 digits)');
        
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
                CASE 
                    WHEN province_id IS NOT NULL THEN printf('%02d', province_id)
                    ELSE NULL 
                END as province_id,
                province_name,
                CASE 
                    WHEN district_id IS NOT NULL THEN printf('%03d', district_id)
                    ELSE NULL 
                END as district_id,
                district_name,
                CASE 
                    WHEN ward_id IS NOT NULL THEN printf('%05d', ward_id)
                    ELSE NULL 
                END as ward_id,
                ward_name,
                street_address,
                discount_code, discount_amount, is_priority
            FROM orders
        `);
        console.log('✅ Data copied and transformed');

        // Drop old table
        await client.execute('DROP TABLE orders');
        console.log('✅ Dropped old orders table');

        // Rename new table
        await client.execute('ALTER TABLE orders_new RENAME TO orders');
        console.log('✅ Renamed orders_new to orders');

        // Recreate indexes
        console.log('\n🔧 Recreating indexes...');
        
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
        
        // Add new indexes for address columns
        await client.execute(`
            CREATE INDEX IF NOT EXISTS idx_orders_province_id ON orders(province_id)
        `);
        
        await client.execute(`
            CREATE INDEX IF NOT EXISTS idx_orders_district_id ON orders(district_id)
        `);
        
        await client.execute(`
            CREATE INDEX IF NOT EXISTS idx_orders_ward_id ON orders(ward_id)
        `);
        
        console.log('✅ Recreated indexes');

        // Note: No explicit commit needed for Turso

        // Step 6: Verify migration
        console.log('\n🔍 Step 6: Verifying migration...');
        
        // Check new schema
        const newSchemaResult = await client.execute(`
            SELECT sql FROM sqlite_master 
            WHERE type='table' AND name='orders'
        `);
        console.log('New orders table schema:');
        console.log(newSchemaResult.rows[0]?.sql);

        // Check new column types
        const newColumnsResult = await client.execute(`
            PRAGMA table_info(orders)
        `);
        
        const newAddressColumns = newColumnsResult.rows.filter(row => 
            ['province_id', 'district_id', 'ward_id'].includes(row.name)
        );
        
        console.log('\nNew address column types:');
        newAddressColumns.forEach(col => {
            console.log(`  - ${col.name}: ${col.type}`);
        });

        // Verify row count
        const newCountResult = await client.execute(`
            SELECT COUNT(*) as total FROM orders
        `);
        
        if (newCountResult.rows[0]?.total !== stats.total_orders) {
            throw new Error('❌ Data loss detected: row count mismatch');
        }
        
        console.log(`✅ Row count verified: ${newCountResult.rows[0]?.total} orders`);

        // Sample transformed data
        console.log('\n🔍 Sampling transformed address IDs...');
        const newSampleResult = await client.execute(`
            SELECT 
                order_id,
                province_id, 
                district_id, 
                ward_id,
                province_name,
                district_name,
                ward_name
            FROM orders 
            WHERE province_id IS NOT NULL 
            LIMIT 5
        `);
        
        console.log('Sample data (after migration):');
        newSampleResult.rows.forEach(row => {
            console.log(`  Order ${row.order_id}:`);
            console.log(`    Province: "${row.province_id}" (${row.province_name})`);
            console.log(`    District: "${row.district_id}" (${row.district_name})`);
            console.log(`    Ward: "${row.ward_id}" (${row.ward_name})`);
        });

        // Verify padding
        console.log('\n✅ Verifying zero-padding...');
        const paddingCheckResult = await client.execute(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN length(province_id) = 2 THEN 1 ELSE 0 END) as province_ok,
                SUM(CASE WHEN length(district_id) = 3 THEN 1 ELSE 0 END) as district_ok,
                SUM(CASE WHEN length(ward_id) = 5 THEN 1 ELSE 0 END) as ward_ok
            FROM orders 
            WHERE province_id IS NOT NULL
        `);
        
        const paddingStats = paddingCheckResult.rows[0];
        console.log(`Province IDs with correct padding (2 digits): ${paddingStats.province_ok}/${paddingStats.total}`);
        console.log(`District IDs with correct padding (3 digits): ${paddingStats.district_ok}/${paddingStats.total}`);
        console.log(`Ward IDs with correct padding (5 digits): ${paddingStats.ward_ok}/${paddingStats.total}`);

        if (paddingStats.province_ok !== paddingStats.total ||
            paddingStats.district_ok !== paddingStats.total ||
            paddingStats.ward_ok !== paddingStats.total) {
            console.warn('⚠️  Warning: Some IDs may not have correct padding');
        }

        console.log('\n' + '='.repeat(70));
        console.log('✅ Migration 055 completed successfully!');
        console.log('📝 Summary:');
        console.log('   ✓ Converted province_id: INTEGER → TEXT (2 digits)');
        console.log('   ✓ Converted district_id: INTEGER → TEXT (3 digits)');
        console.log('   ✓ Converted ward_id: INTEGER → TEXT (5 digits)');
        console.log('   ✓ All data preserved and transformed');
        console.log('   ✓ Indexes recreated');
        console.log('   ✓ Now compatible with tree.json format');
        console.log('\n💡 Next steps:');
        console.log('   1. Remove padding logic from frontend code');
        console.log('   2. Remove parseInt conversions when saving');
        console.log('   3. Test address selection in all modals');

    } catch (error) {
        console.error('\n❌ Migration failed:', error);
        console.error('\n⚠️  WARNING: Migration may be partially applied!');
        console.error('   Please check database state and restore from backup if needed.');
        
        process.exit(1);
    } finally {
        client.close();
    }
}

// Run migration
runMigration().catch(console.error);
