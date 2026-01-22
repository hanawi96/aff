import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

dotenv.config();

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

async function checkTriggers() {
    try {
        console.log('🔍 Checking ALL triggers in database...\n');
        
        // Get all triggers
        const triggers = await client.execute(`
            SELECT name, tbl_name, sql 
            FROM sqlite_master 
            WHERE type = 'trigger'
            ORDER BY tbl_name, name
        `);
        
        if (triggers.rows.length === 0) {
            console.log('✅ No triggers found in database');
            return;
        }
        
        console.log(`Found ${triggers.rows.length} triggers:\n`);
        
        triggers.rows.forEach((trigger, index) => {
            console.log(`${index + 1}. Trigger: ${trigger.name}`);
            console.log(`   Table: ${trigger.tbl_name}`);
            console.log(`   SQL:\n${trigger.sql}\n`);
            
            // Check if it references campaigns
            if (trigger.sql && trigger.sql.toLowerCase().includes('campaign')) {
                console.log('   ⚠️ WARNING: This trigger references "campaign"!\n');
            }
        });
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        client.close();
    }
}

checkTriggers();
