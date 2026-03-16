const { createClient } = require('@libsql/client');

// Database configuration from wrangler.toml
const client = createClient({
    url: "libsql://vdt-yendev96.aws-ap-northeast-1.turso.io",
    authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NjgzNjk1NjEsImlkIjoiYmUyMWFlNjItYjNjYi00MjVjLTkwYTQtNjc3NzczN2I0YjU3IiwicmlkIjoiNDk5MWI3YTgtYjQwYi00NTY1LWJhM2ItZjI3ZDM2NTkwY2UzIn0.L2xPFAjyo1A_8UZ0uAaNX-EnFTexiUTCEOS1qA3jpu4uEsTRPiDlnv0KVAbJr1K4zVr2DDkbAK3SiURzdnahCg"
});

async function checkMigration() {
    try {
        console.log('🔍 Checking products table structure...');

        // Get table info
        const result = await client.execute(`PRAGMA table_info(products)`);
        
        console.log('📋 Products table columns:');
        result.rows.forEach(row => {
            console.log(`  - ${row.name}: ${row.type} ${row.notnull ? 'NOT NULL' : ''} ${row.dflt_value ? `DEFAULT ${row.dflt_value}` : ''}`);
        });

        // Check if new columns exist
        const hasNewColumns = result.rows.some(row => 
            row.name === 'pricing_method' || row.name === 'target_profit'
        );

        if (hasNewColumns) {
            console.log('✅ New columns found! Testing query...');
            
            const testResult = await client.execute(`
                SELECT id, name, pricing_method, target_profit 
                FROM products 
                LIMIT 3
            `);
            
            console.log('🧪 Sample data:');
            testResult.rows.forEach(row => {
                console.log(`  ID: ${row.id}, Name: ${row.name}, Method: ${row.pricing_method}, Target: ${row.target_profit}`);
            });
        } else {
            console.log('❌ New columns not found. Running migration...');
            
            // Run migration
            await client.execute(`
                ALTER TABLE products ADD COLUMN pricing_method TEXT DEFAULT 'markup' CHECK (pricing_method IN ('markup', 'profit'))
            `);
            
            await client.execute(`
                ALTER TABLE products ADD COLUMN target_profit REAL DEFAULT NULL
            `);
            
            await client.execute(`
                UPDATE products SET pricing_method = 'markup' WHERE pricing_method IS NULL
            `);
            
            console.log('✅ Migration completed!');
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        client.close();
    }
}

checkMigration();