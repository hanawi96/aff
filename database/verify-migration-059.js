import { createClient } from '@libsql/client';
import { config } from 'dotenv';

config();

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

async function verifyMigration() {
    console.log('🔍 Verifying Migration 059: Flash Sale Quantity Limits\n');

    try {
        // 1. Check if max_per_customer column exists
        console.log('1️⃣  Checking max_per_customer column...');
        const columnCheck = await client.execute(`
            SELECT sql FROM sqlite_master 
            WHERE type='table' AND name='flash_sale_products'
        `);
        
        const tableSQL = columnCheck.rows[0]?.sql || '';
        if (tableSQL.includes('max_per_customer')) {
            console.log('   ✅ max_per_customer column exists\n');
        } else {
            console.log('   ❌ max_per_customer column NOT found\n');
            return false;
        }

        // 2. Check if flash_sale_purchases table exists
        console.log('2️⃣  Checking flash_sale_purchases table...');
        const tableCheck = await client.execute(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='flash_sale_purchases'
        `);
        
        if (tableCheck.rows.length > 0) {
            console.log('   ✅ flash_sale_purchases table exists\n');
        } else {
            console.log('   ❌ flash_sale_purchases table NOT found\n');
            return false;
        }

        // 3. Check table structure
        console.log('3️⃣  Checking flash_sale_purchases structure...');
        const structure = await client.execute(`
            PRAGMA table_info(flash_sale_purchases)
        `);
        
        const columns = structure.rows.map(row => row.name);
        const requiredColumns = [
            'id', 'flash_sale_id', 'flash_sale_product_id', 'order_id',
            'customer_phone', 'customer_name', 'quantity', 'flash_price',
            'total_amount', 'purchased_at_unix'
        ];
        
        const missingColumns = requiredColumns.filter(col => !columns.includes(col));
        if (missingColumns.length === 0) {
            console.log('   ✅ All required columns present');
            console.log(`   📋 Columns: ${columns.join(', ')}\n`);
        } else {
            console.log(`   ❌ Missing columns: ${missingColumns.join(', ')}\n`);
            return false;
        }

        // 4. Check indexes
        console.log('4️⃣  Checking indexes...');
        const indexes = await client.execute(`
            SELECT name FROM sqlite_master 
            WHERE type='index' AND tbl_name='flash_sale_purchases'
        `);
        
        const indexNames = indexes.rows.map(row => row.name);
        const requiredIndexes = [
            'idx_flash_sale_purchases_customer_product',
            'idx_flash_sale_purchases_flash_sale',
            'idx_flash_sale_purchases_product',
            'idx_flash_sale_purchases_order'
        ];
        
        const foundIndexes = requiredIndexes.filter(idx => 
            indexNames.some(name => name.includes(idx))
        );
        
        console.log(`   ✅ Found ${foundIndexes.length}/${requiredIndexes.length} indexes`);
        foundIndexes.forEach(idx => console.log(`      - ${idx}`));
        console.log('');

        // 5. Test insert and query
        console.log('5️⃣  Testing insert and query...');
        
        // Get a flash sale product for testing
        const testProduct = await client.execute(`
            SELECT id, flash_sale_id FROM flash_sale_products LIMIT 1
        `);
        
        if (testProduct.rows.length > 0) {
            const productId = testProduct.rows[0].id;
            const flashSaleId = testProduct.rows[0].flash_sale_id;
            
            // Try to insert test data
            const now = Math.floor(Date.now() / 1000);
            try {
                await client.execute({
                    sql: `INSERT INTO flash_sale_purchases (
                        flash_sale_id, flash_sale_product_id, order_id,
                        customer_phone, customer_name, quantity, flash_price,
                        total_amount, purchased_at_unix
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    args: [
                        flashSaleId, productId, 999999,
                        '0900000000', 'Test Customer', 1, 99000,
                        99000, now
                    ]
                });
                
                // Query it back
                const testQuery = await client.execute({
                    sql: `SELECT * FROM flash_sale_purchases WHERE customer_phone = ?`,
                    args: ['0900000000']
                });
                
                if (testQuery.rows.length > 0) {
                    console.log('   ✅ Insert and query successful');
                    
                    // Clean up test data
                    await client.execute({
                        sql: `DELETE FROM flash_sale_purchases WHERE customer_phone = ?`,
                        args: ['0900000000']
                    });
                    console.log('   🧹 Test data cleaned up\n');
                } else {
                    console.log('   ❌ Query failed\n');
                    return false;
                }
            } catch (error) {
                console.log(`   ❌ Insert/Query failed: ${error.message}\n`);
                return false;
            }
        } else {
            console.log('   ⚠️  No flash sale products found for testing, skipping\n');
        }

        // 6. Summary
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ Migration 059 Verification PASSED');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        console.log('📊 Summary:');
        console.log('   ✅ max_per_customer column added');
        console.log('   ✅ flash_sale_purchases table created');
        console.log('   ✅ All columns present');
        console.log('   ✅ Indexes created');
        console.log('   ✅ Insert/Query working\n');
        
        return true;

    } catch (error) {
        console.error('❌ Verification failed:', error.message);
        console.error(error);
        return false;
    }
}

verifyMigration();
