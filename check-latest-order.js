// Check latest order priority
import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';

dotenv.config();

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

async function checkLatestOrder() {
    const result = await client.execute(`
        SELECT id, order_id, customer_name, is_priority, created_at
        FROM orders
        ORDER BY id DESC
        LIMIT 5
    `);
    
    console.log('📋 Latest 5 orders:');
    result.rows.forEach(row => {
        console.log(`  - ${row.order_id}: is_priority = ${row.is_priority} (${row.customer_name})`);
    });
}

checkLatestOrder();
