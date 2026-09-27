import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';
dotenv.config();

console.log('🚀 Creating missing search indexes...\n');

const db = createClient({
    url: process.env.TURSO_DATABASE_URL || 'libsql://vdt-yendev96.aws-ap-northeast-1.turso.io',
    authToken: process.env.TURSO_AUTH_TOKEN,
    intMode: 'number'
});

// Index 1: Customer name (case-insensitive)
console.log('Creating idx_orders_customer_name_lower...');
try {
    await db.execute(`
        CREATE INDEX IF NOT EXISTS idx_orders_customer_name_lower 
        ON orders(LOWER(customer_name))
    `);
    console.log('✅ Created idx_orders_customer_name_lower\n');
} catch (err) {
    console.error('❌ Error:', err.message, '\n');
}

// Index 2: Composite index (phone + created_at)
console.log('Creating idx_orders_phone_created_at...');
try {
    await db.execute(`
        CREATE INDEX IF NOT EXISTS idx_orders_phone_created_at 
        ON orders(customer_phone, created_at_unix DESC)
    `);
    console.log('✅ Created idx_orders_phone_created_at\n');
} catch (err) {
    console.error('❌ Error:', err.message, '\n');
}

// Verify all indexes
console.log('📊 Verifying all search indexes...');
const indexes = await db.execute(`
    SELECT name 
    FROM sqlite_master 
    WHERE type='index' 
    AND tbl_name='orders' 
    AND (name = 'idx_orders_customer_phone' 
         OR name = 'idx_orders_customer_name_lower'
         OR name = 'idx_orders_phone_created_at')
`);

console.log(`✅ Found ${indexes.rows.length}/3 search indexes:`);
indexes.rows.forEach(row => {
    console.log(`   - ${row.name}`);
});

console.log('\n🎉 Done!');
process.exit(0);
