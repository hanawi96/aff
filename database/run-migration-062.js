const { createClient } = require('@libsql/client');
const fs = require('fs');
const path = require('path');

// Database configuration from wrangler.toml
const client = createClient({
    url: "libsql://vdt-yendev96.aws-ap-northeast-1.turso.io",
    authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NjgzNjk1NjEsImlkIjoiYmUyMWFlNjItYjNjYi00MjVjLTkwYTQtNjc3NzczN2I0YjU3IiwicmlkIjoiNDk5MWI3YTgtYjQwYi00NTY1LWJhM2ItZjI3ZDM2NTkwY2UzIn0.L2xPFAjyo1A_8UZ0uAaNX-EnFTexiUTCEOS1qA3jpu4uEsTRPiDlnv0KVAbJr1K4zVr2DDkbAK3SiURzdnahCg"
});

async function runMigration062() {
    try {
        console.log('🚀 Starting migration 062: Add pricing_method to products...');

        // Read migration SQL
        const migrationSQL = fs.readFileSync(
            path.join(__dirname, 'migrations', '062_add_pricing_method_to_products.sql'), 
            'utf8'
        );

        // Split by semicolon and execute each statement
        const statements = migrationSQL
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

        for (const statement of statements) {
            console.log('📝 Executing:', statement.substring(0, 100) + '...');
            await client.execute(statement);
        }

        // Verify the migration
        const result = await client.execute(`
            PRAGMA table_info(products)
        `);

        console.log('✅ Migration 062 completed successfully!');
        
        // Check for new columns
        const newColumns = result.rows.filter(row => 
            row.name === 'pricing_method' || row.name === 'target_profit'
        );
        console.log('📊 New columns added:', newColumns.map(row => row.name));

        // Test the new columns if they exist
        if (newColumns.length > 0) {
            const testResult = await client.execute(`
                SELECT pricing_method, target_profit 
                FROM products 
                LIMIT 1
            `);
            console.log('🧪 Test query result:', testResult.rows[0]);
        }

    } catch (error) {
        console.error('❌ Migration 062 failed:', error);
        throw error;
    } finally {
        client.close();
    }
}

// Run migration if called directly
if (require.main === module) {
    runMigration062()
        .then(() => {
            console.log('🎉 Migration 062 finished successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Migration 062 failed:', error);
            process.exit(1);
        });
}

module.exports = { runMigration062 };