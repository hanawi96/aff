// Check if materials table exists
import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
});

async function checkTables() {
    try {
        console.log('📊 Checking tables...\n');
        
        // Get all tables
        const tables = await client.execute(`
            SELECT name FROM sqlite_master WHERE type='table' ORDER BY name
        `);
        
        console.log('All tables:');
        tables.rows.forEach(t => console.log(`  - ${t.name}`));
        
        const hasCostConfig = tables.rows.some(t => t.name === 'cost_config');
        const hasMaterials = tables.rows.some(t => t.name === 'materials');
        
        console.log('\n Table check:');
        console.log(`  - cost_config: ${hasCostConfig ? ' EXISTS' : '❌ MISSING'}`);
        console.log(`  - materials: ${hasMaterials ? ' EXISTS' : '❌ MISSING'}`);
        
        if (hasCostConfig) {
            console.log('\n⚠️  Migration 051 has NOT been run yet!');
            console.log('   Run: node database/run-migration-051.js');
        } else if (hasMaterials) {
            console.log('\n Migration 051 has been run successfully!');
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        client.close();
    }
}

checkTables();
