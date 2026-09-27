/**
 * Migration 090: Add search indexes for Server-Side Search
 * Run: node database/run-migration-090.js
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigration() {
    console.log('🚀 Starting migration 090: Add search indexes...');
    
    try {
        // Setup database client
        const TURSO_DATABASE_URL = process.env.TURSO_DATABASE_URL || 'libsql://vdt-yendev96.aws-ap-northeast-1.turso.io';
        const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;

        if (!TURSO_AUTH_TOKEN) {
            console.error('❌ Missing TURSO_AUTH_TOKEN in environment');
            process.exit(1);
        }

        const db = createClient({
            url: TURSO_DATABASE_URL,
            authToken: TURSO_AUTH_TOKEN,
            intMode: 'number'
        });
        
        // Read migration SQL
        const migrationPath = join(__dirname, 'migrations', '090_add_search_indexes.sql');
        const sql = readFileSync(migrationPath, 'utf-8');
        
        // Split by semicolon and filter out comments
        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s && s.length > 0 && !s.match(/^--/))
            .filter(s => s.toUpperCase().includes('CREATE INDEX'));
        
        console.log(`📝 Found ${statements.length} SQL statements to execute\n`);
        
        // Execute each statement
        for (let i = 0; i < statements.length; i++) {
            const stmt = statements[i];
            console.log(`[${i + 1}/${statements.length}] Executing:`);
            console.log(stmt.substring(0, 100) + '...\n');
            
            const startTime = Date.now();
            await db.execute(stmt);
            const duration = Date.now() - startTime;
            
            console.log(`✅ Success (${duration}ms)\n`);
        }
        
        console.log('🎉 Migration 090 completed successfully!');
        console.log('\n📊 Verifying indexes...');
        
        // Verify indexes were created
        const indexes = await db.execute(`
            SELECT name, sql 
            FROM sqlite_master 
            WHERE type='index' 
            AND tbl_name='orders' 
            AND name LIKE 'idx_orders_%'
            ORDER BY name
        `);
        
        console.log(`\n✅ Found ${indexes.rows.length} indexes on orders table:`);
        indexes.rows.forEach(row => {
            console.log(`   - ${row.name}`);
        });
        
        // Test query performance
        console.log('\n🔍 Testing search query performance...');
        
        const testQuery = `
            SELECT COUNT(*) as total
            FROM orders
            WHERE LOWER(customer_phone) LIKE '%0123%'
               OR LOWER(customer_name) LIKE '%nguyen%'
               OR LOWER(order_id) LIKE '%DH%'
        `;
        
        const testStart = Date.now();
        const result = await db.execute(testQuery);
        const testDuration = Date.now() - testStart;
        
        console.log(`✅ Test query completed in ${testDuration}ms`);
        console.log(`   Found ${result.rows[0].total} matching orders\n`);
        
        if (testDuration > 500) {
            console.warn('⚠️  Warning: Query took > 500ms. Consider optimizing or using FTS5.');
        } else {
            console.log('✅ Performance looks good! (< 500ms target)\n');
        }
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run migration
runMigration();
