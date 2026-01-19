import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
  intMode: 'number',
});

console.log('🧪 Testing discount_usage query...\n');

try {
  const result = await client.execute(`
    SELECT 
        du.id,
        du.discount_id,
        du.discount_code,
        du.order_id,
        du.customer_name,
        du.customer_phone,
        du.order_amount,
        du.discount_amount,
        du.gift_received,
        du.used_at_unix,
        d.title as discount_title,
        d.type as discount_type,
        o.total_amount as order_total_amount
    FROM discount_usage du
    LEFT JOIN discounts d ON du.discount_id = d.id
    LEFT JOIN orders o ON du.order_id = o.order_id
    ORDER BY du.used_at_unix DESC NULLS LAST
    LIMIT 1000
  `);
  
  console.log('✅ Query successful');
  console.log(`📊 Found ${result.rows.length} rows\n`);
  
  if (result.rows.length > 0) {
    console.log('First 3 rows:');
    result.rows.slice(0, 3).forEach((row, i) => {
      console.log(`\nRow ${i + 1}:`);
      console.log(`  - id: ${row.id}`);
      console.log(`  - discount_code: ${row.discount_code}`);
      console.log(`  - order_id: ${row.order_id}`);
      console.log(`  - used_at_unix: ${row.used_at_unix}`);
      console.log(`  - discount_title: ${row.discount_title}`);
    });
  }
  
  process.exit(0);
} catch (error) {
  console.error('❌ Query failed:', error.message);
  console.error('Full error:', error);
  process.exit(1);
}
