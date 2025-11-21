/**
 * Run Timezone Migration
 * 
 * This script ensures all orders have created_at_unix timestamp
 * for consistent timezone handling across the application.
 * 
 * Usage:
 *   node database/run-timezone-migration.js
 */

const fs = require('fs');
const path = require('path');

// Configuration
const WRANGLER_CONFIG_PATH = path.join(__dirname, '..', 'wrangler.toml');
const MIGRATION_SQL_PATH = path.join(__dirname, 'migrations', 'fix_timezone_timestamps.sql');

async function runMigration() {
    console.log('🚀 Starting Timezone Migration...\n');

    // Read migration SQL
    const migrationSQL = fs.readFileSync(MIGRATION_SQL_PATH, 'utf8');
    console.log('📄 Migration SQL loaded from:', MIGRATION_SQL_PATH);

    // Parse wrangler.toml to get database name
    const wranglerConfig = fs.readFileSync(WRANGLER_CONFIG_PATH, 'utf8');
    const dbMatch = wranglerConfig.match(/database_name\s*=\s*"([^"]+)"/);
    const databaseName = dbMatch ? dbMatch[1] : 'ctv-management';

    console.log('💾 Database:', databaseName);
    console.log('\n📋 Migration Steps:');
    console.log('  1. Add created_at_unix column (if not exists)');
    console.log('  2. Update from created_at');
    console.log('  3. Update from order_date');
    console.log('  4. Create index');
    console.log('  5. Verify results\n');

    // Split SQL into individual statements
    const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s && !s.startsWith('--'));

    console.log(`📝 Found ${statements.length} SQL statements\n`);

    // Execute using wrangler d1 execute
    const { execSync } = require('child_process');

    for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        if (!statement) continue;

        console.log(`\n⚙️  Executing statement ${i + 1}/${statements.length}...`);
        
        try {
            // Write statement to temp file
            const tempFile = path.join(__dirname, 'temp_migration.sql');
            fs.writeFileSync(tempFile, statement + ';');

            // Execute using wrangler
            const command = `wrangler d1 execute ${databaseName} --file="${tempFile}" --local`;
            console.log(`   Command: ${command}`);
            
            const output = execSync(command, { encoding: 'utf8' });
            console.log('   ✅ Success');
            
            if (output.trim()) {
                console.log('   Output:', output.trim());
            }

            // Clean up temp file
            fs.unlinkSync(tempFile);
        } catch (error) {
            console.error('   ❌ Error:', error.message);
            
            // Continue with next statement for non-critical errors
            if (statement.includes('ALTER TABLE') && error.message.includes('duplicate column')) {
                console.log('   ℹ️  Column already exists, continuing...');
            } else if (statement.includes('CREATE INDEX') && error.message.includes('already exists')) {
                console.log('   ℹ️  Index already exists, continuing...');
            } else {
                console.error('   ⚠️  Migration may be incomplete');
            }
        }
    }

    console.log('\n✅ Migration completed!\n');
    console.log('📊 Next steps:');
    console.log('  1. Test the application: npm run dev');
    console.log('  2. Open test_timezone_debug.html to verify timestamps');
    console.log('  3. Check orders page to ensure times display correctly\n');
}

// Run migration
runMigration().catch(error => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
});
