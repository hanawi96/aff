// Run migration 051: Rename cost_config to materials
import { createClient } from '@libsql/client';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
});

async function runMigration() {
    try {
        console.log('🚀 Starting Migration 051: Rename cost_config to materials\n');

        // Read SQL file
        const sql = readFileSync('database/migrations/051_rename_cost_config_to_materials.sql', 'utf8');
        
        // Split by semicolon and filter empty statements
        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));

        console.log(`📝 Found ${statements.length} SQL statements\n`);

        // Execute each statement
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            console.log(`\n[${i + 1}/${statements.length}] Executing:`);
            console.log(statement.substring(0, 100) + '...\n');
            
            try {
                await client.execute(statement);
                console.log('✅ Success');
            } catch (error) {
                console.error('❌ Error:', error.message);
                throw error;
            }
        }

        // Verify table was renamed
        console.log('\n📊 Verifying table rename...');
        const tables = await client.execute(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name IN ('cost_config', 'materials')
        `);
        
        console.log('\nTables found:');
        console.table(tables.rows);

        const hasMaterials = tables.rows.some(r => r.name === 'materials');
        const hasCostConfig = tables.rows.some(r => r.name === 'cost_config');

        if (hasMaterials && !hasCostConfig) {
            console.log('\n✅ Table successfully renamed: cost_config → materials');
        } else if (hasCostConfig) {
            console.log('\n⚠️  Warning: cost_config table still exists!');
        } else {
            console.log('\n❌ Error: materials table not found!');
        }

        // Check triggers
        console.log('\n📊 Checking triggers...');
        const triggers = await client.execute(`
            SELECT name FROM sqlite_master 
            WHERE type='trigger' AND name LIKE '%material%'
        `);
        console.log('\nTriggers found:');
        console.table(triggers.rows);

        // Sample data
        console.log('\n📊 Sample materials data:');
        const sample = await client.execute(`
            SELECT * FROM materials LIMIT 5
        `);
        console.table(sample.rows);

        console.log('\n✅ Migration 051 completed successfully!');
        console.log('\n⚠️  NEXT STEPS:');
        console.log('1. Update backend code (src/services/)');
        console.log('2. Update frontend code (public/assets/js/)');
        console.log('3. Update documentation files');
        console.log('4. Test all features');

    } catch (error) {
        console.error('\n❌ Migration failed:', error);
        process.exit(1);
    } finally {
        client.close();
    }
}

runMigration();
