import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

dotenv.config();

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

async function checkForeignKeys() {
    try {
        console.log('🔍 Checking foreign keys in discounts table...\n');
        
        const fks = await client.execute('PRAGMA foreign_key_list(discounts)');
        
        if (fks.rows.length === 0) {
            console.log('✅ No foreign keys found in discounts table');
        } else {
            console.log(`Found ${fks.rows.length} foreign keys:\n`);
            fks.rows.forEach((fk, index) => {
                console.log(`${index + 1}. Foreign Key:`);
                console.log(`   From column: ${fk.from}`);
                console.log(`   To table: ${fk.table}`);
                console.log(`   To column: ${fk.to}`);
                console.log(`   On update: ${fk.on_update}`);
                console.log(`   On delete: ${fk.on_delete}\n`);
                
                if (fk.table && fk.table.toLowerCase().includes('campaign')) {
                    console.log('   ⚠️ WARNING: This FK references a campaign table!\n');
                }
            });
        }
        
        // Check if discount_campaigns table exists
        console.log('\n🔍 Checking if discount_campaigns table exists...\n');
        const tables = await client.execute(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='discount_campaigns'
        `);
        
        if (tables.rows.length > 0) {
            console.log('⚠️ Table discount_campaigns EXISTS');
        } else {
            console.log('✅ Table discount_campaigns does NOT exist (as expected)');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        client.close();
    }
}

checkForeignKeys();
