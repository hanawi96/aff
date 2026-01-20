// Check products table columns
import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
});

async function checkColumns() {
    try {
        console.log('📊 Products table columns:\n');
        const result = await client.execute('PRAGMA table_info(products)');
        
        console.table(result.rows);
        
        // Check specific columns
        const hasUpdatedAtUnix = result.rows.some(r => r.name === 'updated_at_unix');
        const hasMarkupMultiplier = result.rows.some(r => r.name === 'markup_multiplier');
        
        console.log('\n✅ Column check:');
        console.log(`  - updated_at_unix: ${hasUpdatedAtUnix ? '✅ EXISTS' : '❌ MISSING'}`);
        console.log(`  - markup_multiplier: ${hasMarkupMultiplier ? '✅ EXISTS' : '❌ MISSING'}`);
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        client.close();
    }
}

checkColumns();
