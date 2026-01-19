#!/usr/bin/env node

/**
 * Run migration 044: Add used_at_unix column to discount_usage table
 */

import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const db = createClient({
    url: process.env.TURSO_CONNECTION_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

async function runMigration() {
    console.log('🚀 Running migration 044: Add used_at_unix to discount_usage...\n');

    try {
        // Read migration SQL file
        const migrationPath = path.join(process.cwd(), 'database/migrations/044_add_used_at_unix_to_discount_usage.sql');
        const sql = fs.readFileSync(migrationPath, 'utf-8');

        // Split by semicolon and execute each statement
        const statements = sql.split(';').filter(stmt => stmt.trim());

        for (const statement of statements) {
            if (statement.trim()) {
                console.log(`📝 Executing: ${statement.trim().substring(0, 50)}...`);
                await db.execute(statement.trim());
            }
        }

        console.log('\n✅ Migration 044 completed successfully!');
        console.log('📊 Changes:');
        console.log('   ✅ Added column: used_at_unix (INTEGER)');
        console.log('   ✅ Created index: idx_discount_usage_used_at_unix');

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    }
}

runMigration();
