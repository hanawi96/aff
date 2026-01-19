import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
  intMode: 'number',
});

console.log('🔍 Checking discount_usage table structure...\n');

try {
  const result = await client.execute('PRAGMA table_info(discount_usage)');
  
  console.log('Columns in discount_usage:');
  result.rows.forEach(row => {
    console.log(`  ✓ ${row.name} (${row.type})`);
  });
  
  console.log('\n📊 Sample data:');
  const sampleResult = await client.execute('SELECT * FROM discount_usage LIMIT 3');
  console.log(`Found ${sampleResult.rows.length} rows`);
  
  if (sampleResult.rows.length > 0) {
    console.log('\nFirst row keys:', Object.keys(sampleResult.rows[0]));
    console.log('First row:', sampleResult.rows[0]);
  }
  
  process.exit(0);
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
