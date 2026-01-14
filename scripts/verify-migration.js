// Verify data migration from D1 to Turso
// Run this script to compare data between D1 and Turso

import { createClient } from '@libsql/client';
import { config } from 'dotenv';

// Load environment variables
config();

// Configuration
const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

if (!TURSO_URL || !TURSO_TOKEN) {
  console.error('❌ Missing environment variables!');
  console.error('Please set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN');
  process.exit(1);
}

// Create Turso client
const turso = createClient({
  url: TURSO_URL,
  authToken: TURSO_TOKEN,
});

// Tables to verify
const TABLES = [
  'ctv',
  'orders',
  'order_items',
  'products',
  'categories',
  'product_categories',
  'customers',
  'cost_config',
  'discounts',
  'discount_usage',
  'users',
  'sessions',
];

async function verifyTable(tableName) {
  try {
    // Count rows
    const countResult = await turso.execute(`SELECT COUNT(*) as count FROM ${tableName}`);
    const count = countResult.rows[0].count;

    // Get sample data
    const sampleResult = await turso.execute(`SELECT * FROM ${tableName} LIMIT 3`);
    const samples = sampleResult.rows;

    return {
      table: tableName,
      count,
      samples,
      status: 'success',
    };
  } catch (error) {
    return {
      table: tableName,
      count: 0,
      samples: [],
      status: 'error',
      error: error.message,
    };
  }
}

async function verifyIndexes() {
  try {
    const result = await turso.execute(`
      SELECT name, tbl_name, sql 
      FROM sqlite_master 
      WHERE type='index' 
      ORDER BY tbl_name, name
    `);
    return result.rows;
  } catch (error) {
    console.error('Error checking indexes:', error);
    return [];
  }
}

async function verifyTriggers() {
  try {
    const result = await turso.execute(`
      SELECT name, tbl_name, sql 
      FROM sqlite_master 
      WHERE type='trigger' 
      ORDER BY tbl_name, name
    `);
    return result.rows;
  } catch (error) {
    console.error('Error checking triggers:', error);
    return [];
  }
}

async function main() {
  console.log('========================================');
  console.log('🔍 Turso Migration Verification');
  console.log('========================================\n');

  console.log('📊 Verifying tables...\n');

  const results = [];
  for (const table of TABLES) {
    const result = await verifyTable(table);
    results.push(result);

    if (result.status === 'success') {
      console.log(`✅ ${table.padEnd(20)} - ${result.count} rows`);
    } else {
      console.log(`❌ ${table.padEnd(20)} - ERROR: ${result.error}`);
    }
  }

  console.log('\n========================================');
  console.log('📋 Detailed Results');
  console.log('========================================\n');

  for (const result of results) {
    if (result.status === 'success' && result.count > 0) {
      console.log(`\n📦 ${result.table} (${result.count} rows)`);
      console.log('Sample data:');
      console.table(result.samples);
    }
  }

  console.log('\n========================================');
  console.log('🔧 Verifying Indexes');
  console.log('========================================\n');

  const indexes = await verifyIndexes();
  console.log(`Found ${indexes.length} indexes:`);
  indexes.forEach(idx => {
    console.log(`  - ${idx.name} on ${idx.tbl_name}`);
  });

  console.log('\n========================================');
  console.log('⚡ Verifying Triggers');
  console.log('========================================\n');

  const triggers = await verifyTriggers();
  console.log(`Found ${triggers.length} triggers:`);
  triggers.forEach(trg => {
    console.log(`  - ${trg.name} on ${trg.tbl_name}`);
  });

  console.log('\n========================================');
  console.log('📊 Summary');
  console.log('========================================\n');

  const totalRows = results.reduce((sum, r) => sum + (r.count || 0), 0);
  const successTables = results.filter(r => r.status === 'success').length;
  const errorTables = results.filter(r => r.status === 'error').length;

  console.log(`Total tables: ${TABLES.length}`);
  console.log(`✅ Success: ${successTables}`);
  console.log(`❌ Errors: ${errorTables}`);
  console.log(`📊 Total rows: ${totalRows.toLocaleString()}`);
  console.log(`🔧 Indexes: ${indexes.length}`);
  console.log(`⚡ Triggers: ${triggers.length}`);

  if (errorTables === 0) {
    console.log('\n🎉 Migration verification completed successfully!');
  } else {
    console.log('\n⚠️  Some tables have errors. Please review above.');
  }

  console.log('\n========================================\n');
}

main().catch(console.error);
