// Query discounts table from Turso
import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

dotenv.config();

async function queryDiscounts() {
    try {
        console.log('🔄 Connecting to Turso database...\n');
        
        const client = createClient({
            url: process.env.TURSO_DATABASE_URL,
            authToken: process.env.TURSO_AUTH_TOKEN,
        });

        console.log('✅ Connected to Turso\n');
        console.log('📊 Querying discounts table...\n');

        // Get all discounts
        const result = await client.execute(`
            SELECT 
                id,
                code,
                title,
                type,
                discount_value,
                min_order_amount,
                max_total_uses,
                max_uses_per_customer,
                allowed_customer_phones,
                active,
                visible,
                expiry_date,
                notes,
                usage_count,
                created_at_unix
            FROM discounts
            ORDER BY created_at_unix DESC
            LIMIT 20
        `);

        console.log(`Found ${result.rows.length} discounts:\n`);
        console.log('='.repeat(120));

        result.rows.forEach((row, index) => {
            console.log(`\n[${index + 1}] ID: ${row.id} | Code: ${row.code}`);
            console.log(`    Title: ${row.title}`);
            console.log(`    Type: ${row.type} | Value: ${row.discount_value}`);
            console.log(`    Min Order: ${row.min_order_amount} | Max Uses: ${row.max_total_uses}/${row.max_uses_per_customer}`);
            console.log(`    Allowed Phones: ${row.allowed_customer_phones || 'null'}`);
            console.log(`    Active: ${row.active} | Visible: ${row.visible} | Usage: ${row.usage_count}`);
            console.log(`    Expiry: ${row.expiry_date}`);
            if (row.notes) console.log(`    Notes: ${row.notes}`);
            console.log(`    Created: ${row.created_at_unix ? new Date(row.created_at_unix).toLocaleString('vi-VN') : 'N/A'}`);
        });

        console.log('\n' + '='.repeat(120));
        console.log(`\n✅ Query completed. Total: ${result.rows.length} records\n`);

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

queryDiscounts();
