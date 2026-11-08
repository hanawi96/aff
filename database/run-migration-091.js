/**
 * Migration 091: Optimize shipped orders list
 * - Normalize status
 * - Backfill shipped_at_unix for shipped orders
 * - Composite indexes for status + sort keyset
 *
 * Run: node database/run-migration-091.js
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function splitSqlStatements(sql) {
    return sql
        .split(';')
        .map((s) => s.trim())
        .filter((s) => {
            if (!s) return false;
            // Drop pure-comment chunks
            const withoutComments = s
                .split('\n')
                .map((line) => line.trim())
                .filter((line) => line && !line.startsWith('--'))
                .join('\n')
                .trim();
            return withoutComments.length > 0;
        })
        .map((s) =>
            s
                .split('\n')
                .map((line) => line.trim())
                .filter((line) => !line.startsWith('--'))
                .join('\n')
                .trim()
        )
        .filter(Boolean);
}

async function runMigration() {
    console.log('🚀 Starting migration 091: Optimize shipped orders list...');

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

    const migrationPath = join(__dirname, 'migrations', '091_optimize_orders_shipped_list.sql');
    const sql = readFileSync(migrationPath, 'utf-8');
    const statements = splitSqlStatements(sql);

    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

    for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i];
        console.log(`[${i + 1}/${statements.length}] Executing:`);
        console.log(stmt.substring(0, 120).replace(/\s+/g, ' ') + (stmt.length > 120 ? '...' : ''));
        console.log('');

        const startTime = Date.now();
        const result = await db.execute(stmt);
        const duration = Date.now() - startTime;
        const rowsAffected = result.rowsAffected ?? result.rows?.length ?? 0;
        console.log(`✅ Success (${duration}ms, rowsAffected=${rowsAffected})\n`);
    }

    const indexes = await db.execute(`
        SELECT name, sql
        FROM sqlite_master
        WHERE type = 'index'
          AND tbl_name = 'orders'
          AND name IN ('idx_orders_status_shipped_at', 'idx_orders_status_created_at')
        ORDER BY name
    `);

    console.log(`\n✅ Verified indexes (${indexes.rows.length}/2):`);
    indexes.rows.forEach((row) => {
        console.log(`   - ${row.name}`);
    });

    const sample = await db.execute(`
        SELECT
            COUNT(*) AS shipped_total,
            SUM(CASE WHEN COALESCE(shipped_at_unix, 0) = 0 THEN 1 ELSE 0 END) AS shipped_missing_ts,
            SUM(CASE WHEN status != LOWER(TRIM(status)) THEN 1 ELSE 0 END) AS status_not_normalized
        FROM orders
        WHERE status = 'shipped'
    `);
    const row = sample.rows[0] || {};
    console.log('\n📊 Shipped sanity check:');
    console.log(`   shipped_total=${row.shipped_total}`);
    console.log(`   shipped_missing_ts=${row.shipped_missing_ts}`);
    console.log(`   status_not_normalized_among_shipped=${row.status_not_normalized}`);

    console.log('\n🎉 Migration 091 completed successfully!');
}

runMigration().catch((err) => {
    console.error('❌ Migration 091 failed:', err);
    process.exit(1);
});
