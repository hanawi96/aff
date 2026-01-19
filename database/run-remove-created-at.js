/**
 * Remove created_at column from orders table
 * Run: node database/run-remove-created-at.js
 */

import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

dotenv.config();

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
});

async function runMigration() {
    console.log('========================================');
    console.log('Migration 037: Remove created_at column');
    console.log('========================================\n');

    try {
        // Step 1: Verify all orders have created_at_unix
        console.log('Step 1: Verifying data...');
        const verifyResult = await client.execute(`
            SELECT 
                COUNT(*) as total_orders,
                COUNT(created_at_unix) as orders_with_unix_timestamp,
                COUNT(*) - COUNT(created_at_unix) as missing_timestamps
            FROM orders
        `);
        
        const stats = verifyResult.rows[0];
        console.log(`  Total orders: ${stats.total_orders}`);
        console.log(`  Orders with created_at_unix: ${stats.orders_with_unix_timestamp}`);
        console.log(`  Missing timestamps: ${stats.missing_timestamps}`);
        
        if (stats.missing_timestamps > 0) {
            console.error('\n❌ ERROR: Some orders are missing created_at_unix!');
            console.error('Please run timezone migration first.');
            process.exit(1);
        }
        
        console.log('✅ All orders have created_at_unix\n');

        // Step 2: Create backup
        console.log('Step 2: Creating backup...');
        const backupName = `orders_backup_${new Date().toISOString().split('T')[0].replace(/-/g, '')}`;
        
        try {
            await client.execute(`CREATE TABLE ${backupName} AS SELECT * FROM orders`);
            console.log(`✅ Backup created: ${backupName}\n`);
        } catch (error) {
            if (error.message.includes('already exists')) {
                console.log(`⚠️  Backup table ${backupName} already exists, skipping...\n`);
            } else {
                throw error;
            }
        }

        // Step 3: Drop index on created_at (if exists)
        console.log('Step 3: Dropping index on created_at...');
        try {
            await client.execute('DROP INDEX IF EXISTS idx_orders_created_at');
            console.log('✅ Index dropped\n');
        } catch (error) {
            console.log('⚠️  Index does not exist or already dropped\n');
        }

        // Step 4: Drop created_at column
        console.log('Step 4: Dropping created_at column...');
        console.log('⚠️  This will permanently remove the created_at column!');
        console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');
        
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        await client.execute('ALTER TABLE orders DROP COLUMN created_at');
        console.log('✅ Column dropped successfully!\n');

        // Step 5: Verify migration
        console.log('Step 5: Verifying migration...');
        const tableInfo = await client.execute('PRAGMA table_info(orders)');
        
        const hasCreatedAt = tableInfo.rows.some(row => row.name === 'created_at');
        const hasCreatedAtUnix = tableInfo.rows.some(row => row.name === 'created_at_unix');
        
        if (hasCreatedAt) {
            console.error('❌ ERROR: created_at column still exists!');
            process.exit(1);
        }
        
        if (!hasCreatedAtUnix) {
            console.error('❌ ERROR: created_at_unix column is missing!');
            process.exit(1);
        }
        
        console.log('✅ Migration verified successfully!');
        console.log('  - created_at column: REMOVED ✓');
        console.log('  - created_at_unix column: EXISTS ✓\n');

        // Step 6: Check data integrity
        console.log('Step 6: Checking data integrity...');
        const dataCheck = await client.execute(`
            SELECT 
                COUNT(*) as total_orders,
                MIN(created_at_unix) as oldest_timestamp,
                MAX(created_at_unix) as newest_timestamp
            FROM orders
        `);
        
        const data = dataCheck.rows[0];
        console.log(`  Total orders: ${data.total_orders}`);
        console.log(`  Oldest timestamp: ${data.oldest_timestamp} (${new Date(Number(data.oldest_timestamp)).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })})`);
        console.log(`  Newest timestamp: ${data.newest_timestamp} (${new Date(Number(data.newest_timestamp)).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })})`);
        
        console.log('\n========================================');
        console.log('✅ Migration completed successfully!');
        console.log('========================================\n');
        
        console.log('Next steps:');
        console.log('1. Test the application thoroughly');
        console.log('2. Check order display, filtering, and sorting');
        console.log('3. If everything works, you can drop the backup:');
        console.log(`   DROP TABLE ${backupName};\n`);
        
        console.log('To rollback (if needed):');
        console.log(`   DROP TABLE orders;`);
        console.log(`   ALTER TABLE ${backupName} RENAME TO orders;\n`);

    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        client.close();
    }
}

runMigration();
