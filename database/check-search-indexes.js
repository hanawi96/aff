import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';
dotenv.config();

const db = createClient({
    url: process.env.TURSO_DATABASE_URL || 'libsql://vdt-yendev96.aws-ap-northeast-1.turso.io',
    authToken: process.env.TURSO_AUTH_TOKEN,
    intMode: 'number'
});

const indexes = await db.execute(`
    SELECT name, sql 
    FROM sqlite_master 
    WHERE type='index' 
    AND tbl_name='orders' 
    ORDER BY name
`);

console.log('✅ All indexes on orders table:\n');
indexes.rows.forEach(row => {
    console.log(`  - ${row.name}`);
});

console.log(`\n📊 Total: ${indexes.rows.length} indexes`);

// Check for search-specific indexes
const searchIndexes = ['idx_orders_customer_phone', 'idx_orders_customer_name_lower', 'idx_orders_phone_created_at'];
console.log('\n🔍 Search indexes status:');
searchIndexes.forEach(idx => {
    const exists = indexes.rows.some(r => r.name === idx);
    console.log(`  ${exists ? '✅' : '❌'} ${idx}`);
});

process.exit(0);
