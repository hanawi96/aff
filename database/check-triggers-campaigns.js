import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

dotenv.config();

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

async function checkTriggers() {
    try {
        console.log('🔍 Checking for triggers related to campaigns...\n');

        const triggers = await client.execute(
            "SELECT name, sql FROM sqlite_master WHERE type='trigger' AND sql LIKE '%campaign%'"
        );
        
        if (triggers.rows.length > 0) {
            console.log('Found triggers:');
            triggers.rows.forEach(t => {
                console.log(`\nTrigger: ${t.name}`);
                console.log(`SQL: ${t.sql}`);
            });
            
            console.log('\n⚠️  Need to drop these triggers!');
        } else {
            console.log('✅ No campaign-related triggers found');
        }

        // Check foreign keys
        console.log('\n🔍 Checking foreign keys...');
        const fks = await client.execute('PRAGMA foreign_key_list(discounts)');
        
        if (fks.rows.length > 0) {
            console.log('Foreign keys in discounts table:');
            fks.rows.forEach(fk => {
                console.log(`  - ${fk.from} → ${fk.table}.${fk.to}`);
            });
        } else {
            console.log('✅ No foreign keys found');
        }

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        client.close();
    }
}

checkTriggers();
