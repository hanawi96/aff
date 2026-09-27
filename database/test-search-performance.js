import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';
dotenv.config();

console.log('🔍 Testing Search Query Performance\n');
console.log('=' .repeat(60));

const db = createClient({
    url: process.env.TURSO_DATABASE_URL || 'libsql://vdt-yendev96.aws-ap-northeast-1.turso.io',
    authToken: process.env.TURSO_AUTH_TOKEN,
    intMode: 'number'
});

// Test queries
const tests = [
    {
        name: 'Exact Order ID',
        query: `SELECT COUNT(*) as total FROM orders WHERE LOWER(order_id) LIKE '%dh179%'`,
        expectedSpeed: 'Very Fast'
    },
    {
        name: 'Phone Number Search',
        query: `SELECT COUNT(*) as total FROM orders WHERE LOWER(customer_phone) LIKE '%0123%'`,
        expectedSpeed: 'Fast'
    },
    {
        name: 'Customer Name Search',
        query: `SELECT COUNT(*) as total FROM orders WHERE LOWER(customer_name) LIKE '%nguyen%'`,
        expectedSpeed: 'Fast'
    },
    {
        name: 'Address Search (no index)',
        query: `SELECT COUNT(*) as total FROM orders WHERE LOWER(address) LIKE '%ha noi%'`,
        expectedSpeed: 'Medium'
    },
    {
        name: 'Full Search Query (Multiple OR)',
        query: `
            SELECT COUNT(*) as total
            FROM orders
            WHERE LOWER(order_id) LIKE '%dh%'
               OR LOWER(customer_phone) LIKE '%09%'
               OR LOWER(customer_name) LIKE '%nguyen%'
               OR LOWER(address) LIKE '%ha noi%'
               OR LOWER(notes) LIKE '%note%'
        `,
        expectedSpeed: 'Medium'
    },
    {
        name: 'Full Search Query with LIMIT (actual API query)',
        query: `
            SELECT orders.*
            FROM orders
            LEFT JOIN ctv ON orders.referral_code = ctv.referral_code
            WHERE LOWER(orders.order_id) LIKE '%dh%'
               OR LOWER(orders.customer_phone) LIKE '%09%'
               OR LOWER(orders.customer_name) LIKE '%nguyen%'
               OR LOWER(orders.address) LIKE '%ha noi%'
               OR LOWER(orders.notes) LIKE '%note%'
            ORDER BY orders.created_at_unix DESC
            LIMIT 100
        `,
        expectedSpeed: 'Medium-Fast'
    }
];

// Run tests
for (const test of tests) {
    console.log(`\n📊 Test: ${test.name}`);
    console.log(`Expected: ${test.expectedSpeed}`);
    
    const start = Date.now();
    const result = await db.execute(test.query);
    const duration = Date.now() - start;
    
    const count = result.rows[0]?.total || result.rows.length;
    const status = duration < 200 ? '🟢' : duration < 500 ? '🟡' : '🔴';
    
    console.log(`${status} Time: ${duration}ms`);
    console.log(`   Results: ${count} rows`);
    
    if (duration > 500) {
        console.log('   ⚠️  WARNING: Slower than target (500ms)');
    }
}

console.log('\n' + '='.repeat(60));
console.log('\n✅ Performance test completed!');
console.log('\nLegend:');
console.log('  🟢 < 200ms (Excellent)');
console.log('  🟡 200-500ms (Good)');
console.log('  🔴 > 500ms (Needs optimization)');

process.exit(0);
