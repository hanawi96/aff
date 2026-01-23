import { createClient } from '@libsql/client';
import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config();

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

async function runMigration() {
    console.log('🚀 Starting Migration 059: Add Flash Sale Quantity Limits...\n');

    try {
        // Read migration file
        const migrationPath = join(__dirname, 'migrations', '059_add_flash_sale_quantity_limits.sql');
        const migrationSQL = readFileSync(migrationPath, 'utf-8');

        // Remove comments and split properly
        const lines = migrationSQL.split('\n');
        let currentStatement = '';
        const statements = [];
        
        for (const line of lines) {
            const trimmed = line.trim();
            // Skip comment lines
            if (trimmed.startsWith('--') || trimmed.length === 0) {
                continue;
            }
            
            currentStatement += line + '\n';
            
            // If line ends with semicolon, it's end of statement
            if (trimmed.endsWith(';')) {
                statements.push(currentStatement.trim());
                currentStatement = '';
            }
        }
        
        // Add last statement if exists
        if (currentStatement.trim().length > 0) {
            statements.push(currentStatement.trim());
        }

        console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

        // Execute each statement
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            console.log(`⚙️  Executing statement ${i + 1}/${statements.length}...`);
            
            // Show first 100 chars of statement
            const preview = statement.substring(0, 100).replace(/\n/g, ' ');
            console.log(`   ${preview}${statement.length > 100 ? '...' : ''}`);
            
            try {
                await client.execute(statement);
                console.log(`   ✅ Success\n`);
            } catch (error) {
                // Check if error is "duplicate column" or "table already exists"
                if (error.message.includes('duplicate column') || 
                    error.message.includes('already exists')) {
                    console.log(`   ⚠️  Already exists, skipping\n`);
                } else {
                    throw error;
                }
            }
        }

        console.log('✅ Migration 059 completed successfully!\n');
        console.log('📊 Changes applied:');
        console.log('   1. Added max_per_customer column to flash_sale_products');
        console.log('   2. Created flash_sale_purchases table');
        console.log('   3. Created 4 indexes for performance\n');

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.error(error);
        process.exit(1);
    }
}

runMigration();
