import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

async function checkTriggers() {
    console.log('🔍 Checking all triggers');
    console.log('=' .repeat(60));

    try {
        // Get all triggers
        const triggersResult = await client.execute(`
            SELECT name, tbl_name, sql FROM sqlite_master 
            WHERE type='trigger'
            ORDER BY tbl_name, name
        `);
        
        console.log(`\nFound ${triggersResult.rows.length} triggers:\n`);
        
        triggersResult.rows.forEach(row => {
            console.log(`📋 Trigger: ${row.name}`);
            console.log(`   Table: ${row.tbl_name}`);
            console.log(`   SQL:\n${row.sql}\n`);
            console.log('-'.repeat(60));
        });
        
    } catch (error) {
        console.error('\n❌ Error:', error);
        process.exit(1);
    } finally {
        client.close();
    }
}

checkTriggers().catch(console.error);
