// Check if address_learning table exists and is working
import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

dotenv.config();

async function checkTable() {
    const client = createClient({
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN,
    });

    try {
        console.log('🔍 Checking address_learning table...\n');

        // Check table structure
        const schema = await client.execute(`
            SELECT sql FROM sqlite_master 
            WHERE type='table' AND name='address_learning'
        `);

        if (schema.rows.length > 0) {
            console.log('✅ Table exists!');
            console.log('\n📋 Table schema:');
            console.log(schema.rows[0].sql);
        } else {
            console.log('❌ Table not found!');
            return;
        }

        // Check indexes
        console.log('\n📊 Indexes:');
        const indexes = await client.execute(`
            SELECT name, sql FROM sqlite_master 
            WHERE type='index' AND tbl_name='address_learning'
        `);

        indexes.rows.forEach(idx => {
            console.log(`  - ${idx.name}`);
        });

        // Check if table is empty
        const count = await client.execute('SELECT COUNT(*) as count FROM address_learning');
        console.log(`\n📈 Current records: ${count.rows[0].count}`);

        console.log('\n✅ Table is ready to use!');

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

checkTable();
