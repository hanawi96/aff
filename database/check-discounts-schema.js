import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

dotenv.config();

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

async function checkSchema() {
    try {
        console.log('🔍 Checking discounts table schema...\n');
        
        const result = await client.execute('PRAGMA table_info(discounts)');
        
        console.log('Columns in discounts table:');
        result.rows.forEach(col => {
            const nullable = col.notnull ? 'NOT NULL' : 'NULL';
            const defaultVal = col.dflt_value ? `DEFAULT ${col.dflt_value}` : '';
            console.log(`  ${col.name.padEnd(30)} ${col.type.padEnd(10)} ${nullable.padEnd(10)} ${defaultVal}`);
        });
        
        // Check if campaign_id exists
        const hasCampaignId = result.rows.some(col => col.name === 'campaign_id');
        console.log(`\n${hasCampaignId ? '⚠️' : '✅'} campaign_id column: ${hasCampaignId ? 'EXISTS (unused)' : 'NOT FOUND'}`);
        
        // Check new event columns
        const hasSpecialEvent = result.rows.some(col => col.name === 'special_event');
        const hasEventIcon = result.rows.some(col => col.name === 'event_icon');
        const hasEventDate = result.rows.some(col => col.name === 'event_date');
        
        console.log(`${hasSpecialEvent ? '✅' : '❌'} special_event column: ${hasSpecialEvent ? 'EXISTS' : 'NOT FOUND'}`);
        console.log(`${hasEventIcon ? '✅' : '❌'} event_icon column: ${hasEventIcon ? 'EXISTS' : 'NOT FOUND'}`);
        console.log(`${hasEventDate ? '✅' : '❌'} event_date column: ${hasEventDate ? 'EXISTS' : 'NOT FOUND'}`);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        client.close();
    }
}

checkSchema();
