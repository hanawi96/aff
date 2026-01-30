// Activate a flash sale
import { createClient } from '@libsql/client';
import 'dotenv/config';

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
});

async function activateFlashSale() {
    try {
        console.log('🔥 Activating flash sale...\n');
        
        // Get the latest flash sale
        const flashSales = await client.execute('SELECT * FROM flash_sales ORDER BY id DESC LIMIT 1');
        
        if (flashSales.rows.length === 0) {
            console.log('❌ No flash sales found!');
            return;
        }
        
        const flashSale = flashSales.rows[0];
        console.log(`📋 Flash sale: ${flashSale.name} (ID: ${flashSale.id})`);
        console.log(`   Current status: ${flashSale.status}`);
        
        // Update to active status and extend end time
        const now = Math.floor(Date.now() / 1000);
        const endTime = now + (7 * 24 * 60 * 60); // 7 days from now
        
        await client.execute({
            sql: `UPDATE flash_sales 
                  SET status = 'active', 
                      start_time = ?,
                      end_time = ?,
                      updated_at_unix = ?
                  WHERE id = ?`,
            args: [now, endTime, now, flashSale.id]
        });
        
        console.log(`\n✅ Flash sale activated!`);
        console.log(`   Status: active`);
        console.log(`   Start: ${new Date(now * 1000).toLocaleString()}`);
        console.log(`   End: ${new Date(endTime * 1000).toLocaleString()}`);
        
        // Check products
        const products = await client.execute({
            sql: 'SELECT COUNT(*) as count FROM flash_sale_products WHERE flash_sale_id = ?',
            args: [flashSale.id]
        });
        
        console.log(`\n📦 Products in this flash sale: ${products.rows[0].count}`);
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        client.close();
    }
}

activateFlashSale();
