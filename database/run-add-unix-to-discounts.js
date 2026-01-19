/**
 * Add Unix timestamp columns to discounts table
 * Run: node database/run-add-unix-to-discounts.js
 */

import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
});

async function runMigration() {
    console.log('========================================');
    console.log('Migration 038: Add Unix timestamps to discounts');
    console.log('========================================\n');

    try {
        // Step 1: Check current schema
        console.log('Step 1: Checking current schema...');
        const tableInfo = await client.execute('PRAGMA table_info(discounts)');
        const hasCreatedAtUnix = tableInfo.rows.some(row => row.name === 'created_at_unix');
        const hasUpdatedAtUnix = tableInfo.rows.some(row => row.name === 'updated_at_unix');
        
        console.log(`  created_at_unix: ${hasCreatedAtUnix ? '✅ EXISTS' : '❌ MISSING'}`);
        console.log(`  updated_at_unix: ${hasUpdatedAtUnix ? '✅ EXISTS' : '❌ MISSING'}\n`);
        
        if (hasCreatedAtUnix && hasUpdatedAtUnix) {
            console.log('⚠️  Columns already exist. Skipping migration.\n');
            
            // Show current data
            const stats = await client.execute(`
                SELECT 
                    COUNT(*) as total,
                    COUNT(created_at_unix) as with_unix,
                    MIN(created_at_unix) as oldest,
                    MAX(created_at_unix) as newest
                FROM discounts
            `);
            console.log('Current stats:', stats.rows[0]);
            client.close();
            return;
        }

        // Step 2: Add columns
        console.log('Step 2: Adding Unix timestamp columns...');
        
        if (!hasCreatedAtUnix) {
            await client.execute('ALTER TABLE discounts ADD COLUMN created_at_unix INTEGER');
            console.log('  ✅ Added created_at_unix column');
        }
        
        if (!hasUpdatedAtUnix) {
            await client.execute('ALTER TABLE discounts ADD COLUMN updated_at_unix INTEGER');
            console.log('  ✅ Added updated_at_unix column');
        }
        console.log();

        // Step 3: Migrate existing data
        console.log('Step 3: Migrating existing data...');
        
        // Migrate created_at
        const migrateCreated = await client.execute(`
            UPDATE discounts 
            SET created_at_unix = CAST((julianday(created_at) - 2440587.5) * 86400000 AS INTEGER)
            WHERE created_at IS NOT NULL AND created_at_unix IS NULL
        `);
        console.log(`  ✅ Migrated ${migrateCreated.rowsAffected} created_at timestamps`);
        
        // Migrate updated_at
        const migrateUpdated = await client.execute(`
            UPDATE discounts 
            SET updated_at_unix = CAST((julianday(updated_at) - 2440587.5) * 86400000 AS INTEGER)
            WHERE updated_at IS NOT NULL AND updated_at_unix IS NULL
        `);
        console.log(`  ✅ Migrated ${migrateUpdated.rowsAffected} updated_at timestamps\n`);

        // Step 4: Create indexes
        console.log('Step 4: Creating indexes...');
        await client.execute('CREATE INDEX IF NOT EXISTS idx_discounts_created_at_unix ON discounts(created_at_unix)');
        await client.execute('CREATE INDEX IF NOT EXISTS idx_discounts_updated_at_unix ON discounts(updated_at_unix)');
        console.log('  ✅ Indexes created\n');

        // Step 5: Verify migration
        console.log('Step 5: Verifying migration...');
        const stats = await client.execute(`
            SELECT 
                COUNT(*) as total_discounts,
                COUNT(created_at_unix) as with_unix_timestamp,
                COUNT(*) - COUNT(created_at_unix) as missing_timestamps,
                MIN(created_at_unix) as oldest_timestamp,
                MAX(created_at_unix) as newest_timestamp
            FROM discounts
        `);
        
        const data = stats.rows[0];
        console.log(`  Total discounts: ${data.total_discounts}`);
        console.log(`  With Unix timestamp: ${data.with_unix_timestamp}`);
        console.log(`  Missing timestamps: ${data.missing_timestamps}`);
        
        if (data.oldest_timestamp) {
            console.log(`  Oldest: ${new Date(Number(data.oldest_timestamp)).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`);
            console.log(`  Newest: ${new Date(Number(data.newest_timestamp)).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`);
        }
        console.log();

        // Step 6: Show sample data
        console.log('Step 6: Sample data verification...');
        const samples = await client.execute(`
            SELECT 
                id,
                code,
                created_at,
                created_at_unix,
                updated_at,
                updated_at_unix
            FROM discounts
            ORDER BY id DESC
            LIMIT 3
        `);
        
        console.log('\nSample records:');
        samples.rows.forEach(row => {
            console.log(`  ID ${row.id} (${row.code}):`);
            console.log(`    created_at: ${row.created_at}`);
            console.log(`    created_at_unix: ${row.created_at_unix} (${new Date(Number(row.created_at_unix)).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })})`);
        });

        console.log('\n========================================');
        console.log('✅ Migration completed successfully!');
        console.log('========================================\n');
        
        console.log('Next steps:');
        console.log('1. Update discount service to use created_at_unix');
        console.log('2. Update frontend to send Unix timestamps');
        console.log('3. Test creating/editing discounts');
        console.log('4. After verification, can drop old created_at/updated_at columns\n');

    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        client.close();
    }
}

runMigration();
