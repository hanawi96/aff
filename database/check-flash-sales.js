// Check flash sales in database
import { createClient } from '@libsql/client';
import 'dotenv/config';

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
});

async function checkFlashSales() {
    try {
        console.log('🔍 Checking flash sales in database...\n');
        
        // Check all flash sales
        const allFlashSales = await client.execute('SELECT * FROM flash_sales');
        console.log(`📊 Total flash sales: ${allFlashSales.rows.length}`);
        
        if (allFlashSales.rows.length > 0) {
            console.log('\n📋 Flash sales:');
            allFlashSales.rows.forEach(fs => {
                console.log(`  - ID: ${fs.id}, Name: ${fs.name}, Status: ${fs.status}`);
                console.log(`    Start: ${new Date(fs.start_time * 1000).toLocaleString()}`);
                console.log(`    End: ${new Date(fs.end_time * 1000).toLocaleString()}`);
            });
            
            // Check products for each flash sale
            for (const fs of allFlashSales.rows) {
                const products = await client.execute({
                    sql: 'SELECT * FROM flash_sale_products WHERE flash_sale_id = ?',
                    args: [fs.id]
                });
                console.log(`\n  📦 Products in flash sale ${fs.id}: ${products.rows.length}`);
            }
        } else {
            console.log('\n⚠️  No flash sales found in database!');
            console.log('💡 You need to create a flash sale first.');
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        client.close();
    }
}

checkFlashSales();
