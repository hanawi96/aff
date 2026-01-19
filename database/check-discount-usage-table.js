#!/usr/bin/env node

/**
 * Check if discount_usage table exists and has correct schema
 * Usage: node database/check-discount-usage-table.js
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('🔍 Checking discount_usage table...\n');

try {
    // Note: This script is for local SQLite checking
    // For Turso/D1, use: wrangler d1 execute vdt --command "SELECT * FROM sqlite_master WHERE type='table' AND name='discount_usage';"
    
    console.log('📌 For Turso/D1 Database, run:');
    console.log('   wrangler d1 execute vdt --command "SELECT * FROM sqlite_master WHERE type=\'table\' AND name=\'discount_usage\';"');
    console.log('\n📌 To check table structure:');
    console.log('   wrangler d1 execute vdt --command "PRAGMA table_info(discount_usage);"');
    console.log('\n📌 To check triggers:');
    console.log('   wrangler d1 execute vdt --command "SELECT name FROM sqlite_master WHERE type=\'trigger\' AND tbl_name=\'discount_usage\';"');
    console.log('\n📌 To check existing discount_usage records:');
    console.log('   wrangler d1 execute vdt --command "SELECT COUNT(*) as count FROM discount_usage;"');
    console.log('\n📌 To run the migration:');
    console.log('   wrangler d1 execute vdt --file=database/migrations/043_ensure_discount_usage_table.sql');
    
} catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
}
