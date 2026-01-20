// Run migration 052: Add markup_multiplier to products
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
        console.log('🚀 Starting Migration 052: Add markup_multiplier to products\n');

        // Read SQL file
        const sql = readFileSync('database/migrations/052_add_markup_multiplier_to_products.sql', 'utf8');
        
        // Remove all comment lines first
        const cleanedSQL = sql
            .split('\n')
            .filter(line => !line.trim().startsWith('--'))
            .join('\n');
        
        // Split by semicolon and filter empty statements
        const statements = cleanedSQL
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0);

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
                // Column might already exist, continue
                if (!error.message.includes('duplicate column')) {
                    throw error;
                }
            }
        }

        // Verify column was added
        console.log('\n📊 Verifying column addition...');
        const columns = await client.execute(`
            PRAGMA table_info(products)
        `);
        
        const hasMarkupColumn = columns.rows.some(r => r.name === 'markup_multiplier');
        
        if (hasMarkupColumn) {
            console.log('\n✅ Column markup_multiplier successfully added to products table');
            
            // Show column details
            const markupColumn = columns.rows.find(r => r.name === 'markup_multiplier');
            console.log('\nColumn details:');
            console.table([markupColumn]);
        } else {
            console.log('\n❌ Error: markup_multiplier column not found!');
        }

        // Sample data
        console.log('\n📊 Sample products with new column:');
        const sample = await client.execute(`
            SELECT id, name, price, cost_price, markup_multiplier 
            FROM products 
            LIMIT 5
        `);
        console.table(sample.rows);

        console.log('\n✅ Migration 052 completed successfully!');
        console.log('\n📝 Next steps:');
        console.log('1. Update product save logic to store markup_multiplier');
        console.log('2. Create API endpoint for bulk price recalculation');
        console.log('3. Add UI for price recalculation');

    } catch (error) {
        console.error('\n❌ Migration failed:', error);
        process.exit(1);
    } finally {
        client.close();
    }
}

runMigration();

